"""
AegisFlow GNN inference module.

Loads the trained CascadeGCN model once at import time (module-level singleton).
Exposes predict_cascade() for use by the inference loop and API endpoints.

Contract:
    predict_cascade(anomalous_node_ids, node_states, edges) -> dict with:
        - cascade_chain: list of dicts with node_id, confidence, time_to_cascade_min, hop_distance
        - rerouting_path: list of node IDs avoiding high-risk nodes (Dijkstra)
        - rerouting_summary: human-readable path description
"""

import heapq
import os
from collections import deque

import torch

from backend.ml.gnn_train import (
    CascadeGCN,
    NODE_IDS,
    NODE_TYPE_ENC,
    _NODE_TYPES,
    _build_adjacency,
    _compute_degrees,
    _node_idx,
    build_edge_index,
)

# ─── Module-level singleton ───────────────────────────────────────────────────

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "gnn_model.pt")
_MODEL: CascadeGCN | None = None

# Pre-compute static graph structures (built once at module import)
_EDGE_INDEX: torch.Tensor = build_edge_index()
_DEGREES: list[float] = _compute_degrees()
_ADJ: dict[int, list[int]] = _build_adjacency()


def _load_model() -> CascadeGCN:
    """Load model weights on first call, then return cached singleton."""
    global _MODEL
    if _MODEL is None:
        m = CascadeGCN()
        m.load_state_dict(torch.load(_MODEL_PATH, map_location="cpu"))
        m.eval()
        _MODEL = m
    return _MODEL


# Eagerly load model at import to avoid first-call latency in the inference loop
_load_model()


# ─── Feature extraction ───────────────────────────────────────────────────────

def _build_features(
    anomalous_node_ids: list[str],
    node_states: dict,
) -> torch.Tensor:
    """
    Build [24, 5] feature tensor from current node_states.

    Features (must match gnn_train.py ordering):
        0: load / 100.0 (normalized)
        1: abs(frequency - 60.0) / 1.0 (normalized deviation)
        2: 1.0 if anomalous else 0.0 (anomaly flag)
        3: node type encoding (generator=1.0, substation=0.75, transformer=0.5, junction=0.25)
        4: degree / max_degree (graph connectivity, normalized)
    """
    anomalous_set = set(anomalous_node_ids)
    rows = []
    for node_id in NODE_IDS:
        idx = _node_idx(node_id)
        node_type = _NODE_TYPES[node_id]
        type_enc = NODE_TYPE_ENC[node_type]
        degree_norm = _DEGREES[idx]

        # Get live readings if available, else use defaults
        node = node_states.get(node_id)
        if node is not None:
            load_norm = float(node.load) / 100.0
            freq_dev = abs(float(node.frequency) - 60.0) / 1.0
        else:
            load_norm = 0.5
            freq_dev = 0.0

        # Override anomaly flag for nodes flagged by XGBoost
        anomaly_flag = 1.0 if node_id in anomalous_set else 0.0

        rows.append([load_norm, freq_dev, anomaly_flag, type_enc, degree_norm])

    return torch.tensor(rows, dtype=torch.float32)


# ─── BFS hop distances ────────────────────────────────────────────────────────

def _bfs_hop_distances(seed_indices: list[int]) -> dict[int, int]:
    """BFS from anomalous seed nodes; returns node_idx -> min hop distance."""
    distances: dict[int, int] = {}
    frontier: deque[int] = deque()
    for s in seed_indices:
        if s not in distances:
            distances[s] = 0
            frontier.append(s)
    while frontier:
        node = frontier.popleft()
        for neighbor in _ADJ[node]:
            if neighbor not in distances:
                distances[neighbor] = distances[node] + 1
                frontier.append(neighbor)
    return distances


# ─── Dijkstra rerouting ───────────────────────────────────────────────────────

def _build_capacity_graph(edges: list[dict]) -> dict[str, list[tuple[str, int]]]:
    """Build undirected adjacency with (neighbor, capacity) from EDGES list."""
    graph: dict[str, list[tuple[str, int]]] = {}
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        cap = edge.get("capacity", 100)
        if src and tgt:
            graph.setdefault(src, []).append((tgt, cap))
            graph.setdefault(tgt, []).append((src, cap))
    return graph


def _dijkstra_path(
    graph: dict[str, list[tuple[str, int]]],
    source: str,
    target: str,
    blocked: set[str],
) -> tuple[list[str], int]:
    """
    Dijkstra shortest path from source to target avoiding blocked nodes.
    Uses inverse capacity as edge cost (higher capacity = lower cost).

    Returns:
        (path, min_edge_capacity) — path is empty list if no path found.
    """
    if source == target:
        return [source], 9999
    if source in blocked or target in blocked:
        return [], 0

    # Cost = sum of (10000 / capacity) per edge — lower cost = higher capacity
    INF = float("inf")
    dist: dict[str, float] = {source: 0.0}
    prev: dict[str, str | None] = {source: None}
    edge_caps: dict[str, int] = {}  # node -> capacity of edge from prev[node]
    heap: list[tuple[float, str]] = [(0.0, source)]

    while heap:
        cost, node = heapq.heappop(heap)
        if cost > dist.get(node, INF):
            continue
        if node == target:
            break
        for neighbor, cap in graph.get(node, []):
            if neighbor in blocked:
                continue
            edge_cost = 10000.0 / max(cap, 1)
            new_cost = cost + edge_cost
            if new_cost < dist.get(neighbor, INF):
                dist[neighbor] = new_cost
                prev[neighbor] = node
                edge_caps[neighbor] = cap
                heapq.heappush(heap, (new_cost, neighbor))

    if target not in prev:
        return [], 0

    # Reconstruct path
    path: list[str] = []
    node: str | None = target
    while node is not None:
        path.append(node)
        node = prev.get(node)
    path.reverse()

    # Compute minimum edge capacity along path
    min_cap = min(
        (edge_caps.get(path[i + 1], 100) for i in range(len(path) - 1)),
        default=100,
    )
    return path, min_cap


def _compute_rerouting(
    edges: list[dict],
    anomalous_set: set[str],
    high_risk: set[str],
    node_states: dict,
) -> tuple[list[str], str]:
    """
    Find a rerouting path using Dijkstra, avoiding anomalous and high-risk nodes.

    Source: first non-blocked generator node
    Target: first non-blocked substation/junction node at BFS distance >= 2 from epicenter
    """
    graph = _build_capacity_graph(edges)
    blocked = anomalous_set | high_risk

    # Candidate source: non-blocked generator
    source = None
    for node_id in NODE_IDS:
        if _NODE_TYPES[node_id] == "generator" and node_id not in blocked:
            source = node_id
            break

    if source is None:
        return [], ""

    # Candidate target: non-blocked substation or junction at graph distance >= 2
    # from any anomalous node
    anomalous_indices = [_node_idx(n) for n in anomalous_set if n in {*NODE_IDS}]
    distances = _bfs_hop_distances(anomalous_indices) if anomalous_indices else {}

    target = None
    for node_id in reversed(NODE_IDS):  # iterate from end to find "far" nodes
        if node_id in blocked:
            continue
        if _NODE_TYPES[node_id] not in ("substation", "junction"):
            continue
        idx = _node_idx(node_id)
        if distances.get(idx, 999) >= 2:
            target = node_id
            break

    if target is None or target == source:
        return [], ""

    path, min_cap = _dijkstra_path(graph, source, target, blocked)
    if not path or len(path) < 2:
        return [], ""

    # Build human-readable summary
    node_names: dict[str, str] = {}
    for node_id, node in node_states.items():
        if hasattr(node, "name"):
            node_names[node_id] = node.name
        else:
            node_names[node_id] = node_id

    # Summary: via {node2.name} -> {node3.name}, +margin% margin
    target_node = node_states.get(target)
    target_cap = 100
    if target_node and hasattr(target_node, "load"):
        target_cap = max(100 - int(target_node.load), 10)

    margin = max(0, int((target_cap - min_cap) / max(target_cap, 1) * 100))

    if len(path) >= 3:
        n2_name = node_names.get(path[1], path[1])
        n3_name = node_names.get(path[2], path[2])
        summary = f"via {n2_name} -> {n3_name}, +{margin}% margin"
    elif len(path) == 2:
        n2_name = node_names.get(path[1], path[1])
        summary = f"via {n2_name}, +{margin}% margin"
    else:
        summary = ""

    return path, summary


# ─── Public API ───────────────────────────────────────────────────────────────

def predict_cascade(
    anomalous_node_ids: list[str],
    node_states: dict,
    edges: list[dict],
) -> dict:
    """
    Run GCN forward pass and Dijkstra rerouting to predict cascade failures.

    Args:
        anomalous_node_ids: Node IDs already flagged as anomalous by XGBoost.
        node_states:        NODE_STATES dict from backend/state.py.
        edges:              EDGES list from backend/state.py.

    Returns:
        {
            "cascade_chain": [
                {
                    "node_id": "NODE-07",
                    "confidence": 0.87,          # GCN probability in [0, 1]
                    "time_to_cascade_min": 4.2,  # max(1, (1-conf)*10)
                    "hop_distance": 1             # BFS hops from nearest anomalous node
                },
                ...  # sorted by confidence descending
            ],
            "rerouting_path": ["NODE-01", "NODE-05", "NODE-13"],
            "rerouting_summary": "via Lincoln Park Substation → ..., +12% margin"
        }
    """
    try:
        model = _load_model()
        anomalous_set = set(anomalous_node_ids)
        anomalous_indices = [_node_idx(n) for n in anomalous_node_ids if n in set(NODE_IDS)]

        # ── GCN forward pass ──────────────────────────────────────────────────
        x = _build_features(anomalous_node_ids, node_states)
        with torch.no_grad():
            out = model(x, _EDGE_INDEX)  # [24, 1]

        confidences = out.squeeze(1).tolist()  # list of 24 floats in [0, 1]

        # ── BFS hop distances from anomalous nodes ────────────────────────────
        hop_distances = _bfs_hop_distances(anomalous_indices) if anomalous_indices else {}

        # ── Build cascade chain ───────────────────────────────────────────────
        # Only include nodes with confidence > 0.35, excluding already-anomalous nodes
        cascade_chain: list[dict] = []
        high_risk: set[str] = set()

        for idx, node_id in enumerate(NODE_IDS):
            if node_id in anomalous_set:
                continue
            conf = confidences[idx]
            if conf > 0.35:
                hop = hop_distances.get(idx, 999)
                time_to_cascade = max(1.0, (1.0 - conf) * 10.0)
                cascade_chain.append({
                    "node_id": node_id,
                    "confidence": round(conf, 4),
                    "time_to_cascade_min": round(time_to_cascade, 2),
                    "hop_distance": hop,
                })
                if conf > 0.75:
                    high_risk.add(node_id)

        # Sort by confidence descending
        cascade_chain.sort(key=lambda e: e["confidence"], reverse=True)

        # ── Dijkstra rerouting ────────────────────────────────────────────────
        rerouting_path, rerouting_summary = _compute_rerouting(
            edges, anomalous_set, high_risk, node_states
        )

        return {
            "cascade_chain": cascade_chain,
            "rerouting_path": rerouting_path,
            "rerouting_summary": rerouting_summary,
        }

    except Exception as exc:  # noqa: BLE001 — never crash the inference loop
        print(f"[gnn_inference] predict_cascade error: {exc}")
        return {
            "cascade_chain": [],
            "rerouting_path": [],
            "rerouting_summary": "",
        }
