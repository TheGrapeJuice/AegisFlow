"""
AegisFlow GNN training script.

Trains a 2-layer Graph Convolutional Network (GCN) on synthetic grid failure
propagation data generated from the Chicago-area grid topology defined in
backend/state.py.

Run offline to produce gnn_model.pt:
    python -m backend.ml.gnn_train
"""

import os
import random
from collections import deque

import torch
import torch.nn.functional as F
from torch_geometric.nn import GCNConv

# ─── Grid topology constants ──────────────────────────────────────────────────
# 24 nodes: NODE-01 to NODE-24
# Node index = int(node_id.split('-')[1]) - 1
NODE_IDS = [f"NODE-{i:02d}" for i in range(1, 25)]

# Node type encoding
NODE_TYPE_ENC = {
    "generator": 1.0,
    "substation": 0.75,
    "transformer": 0.5,
    "junction": 0.25,
}

# Node types from state.py
_NODE_TYPES = {
    "NODE-01": "generator",
    "NODE-02": "generator",
    "NODE-03": "generator",
    "NODE-04": "generator",
    "NODE-05": "substation",
    "NODE-06": "substation",
    "NODE-07": "substation",
    "NODE-08": "substation",
    "NODE-09": "substation",
    "NODE-10": "substation",
    "NODE-11": "substation",
    "NODE-12": "substation",
    "NODE-13": "transformer",
    "NODE-14": "transformer",
    "NODE-15": "transformer",
    "NODE-16": "transformer",
    "NODE-17": "transformer",
    "NODE-18": "transformer",
    "NODE-19": "transformer",
    "NODE-20": "transformer",
    "NODE-21": "junction",
    "NODE-22": "junction",
    "NODE-23": "junction",
    "NODE-24": "junction",
}

# 39 directed edges from state.py (source, target) as node indices
_EDGE_LIST = [
    # Generator -> Substation feeds
    ("NODE-01", "NODE-05"), ("NODE-01", "NODE-12"),
    ("NODE-02", "NODE-07"), ("NODE-02", "NODE-10"),
    ("NODE-03", "NODE-06"), ("NODE-03", "NODE-11"),
    ("NODE-04", "NODE-08"), ("NODE-04", "NODE-12"),
    # Substation ring
    ("NODE-05", "NODE-06"), ("NODE-06", "NODE-11"),
    ("NODE-11", "NODE-07"), ("NODE-07", "NODE-10"),
    ("NODE-10", "NODE-08"), ("NODE-08", "NODE-12"),
    ("NODE-09", "NODE-05"), ("NODE-09", "NODE-06"),
    # Substation -> Transformer feeds
    ("NODE-05", "NODE-13"), ("NODE-05", "NODE-15"),
    ("NODE-06", "NODE-17"), ("NODE-07", "NODE-16"),
    ("NODE-08", "NODE-20"), ("NODE-10", "NODE-18"),
    ("NODE-11", "NODE-19"), ("NODE-12", "NODE-20"),
    # Transformer -> Junction connections
    ("NODE-13", "NODE-21"), ("NODE-14", "NODE-21"),
    ("NODE-14", "NODE-22"), ("NODE-15", "NODE-21"),
    ("NODE-16", "NODE-23"), ("NODE-17", "NODE-23"),
    ("NODE-18", "NODE-22"), ("NODE-18", "NODE-24"),
    ("NODE-19", "NODE-23"), ("NODE-20", "NODE-24"),
    # Junction interconnects
    ("NODE-21", "NODE-22"), ("NODE-21", "NODE-23"),
    ("NODE-22", "NODE-24"), ("NODE-23", "NODE-24"),
    # Cross-link
    ("NODE-13", "NODE-14"),
]

NUM_NODES = 24


def _node_idx(node_id: str) -> int:
    """Convert NODE-XX to zero-based index."""
    return int(node_id.split("-")[1]) - 1


def _compute_degrees() -> list[float]:
    """Compute undirected degree for each node, normalized by max degree."""
    degree = [0] * NUM_NODES
    for src, tgt in _EDGE_LIST:
        degree[_node_idx(src)] += 1
        degree[_node_idx(tgt)] += 1
    max_deg = max(degree) if degree else 1
    return [d / max_deg for d in degree]


def _build_adjacency() -> dict[int, list[int]]:
    """Build undirected adjacency list for BFS."""
    adj: dict[int, list[int]] = {i: [] for i in range(NUM_NODES)}
    for src, tgt in _EDGE_LIST:
        s, t = _node_idx(src), _node_idx(tgt)
        adj[s].append(t)
        adj[t].append(s)
    return adj


def build_edge_index() -> torch.Tensor:
    """
    Build bidirectional edge_index tensor from the 39 EDGES.
    Returns shape [2, 2*39] = [2, 78] long tensor.
    """
    src_list, tgt_list = [], []
    for src, tgt in _EDGE_LIST:
        s, t = _node_idx(src), _node_idx(tgt)
        src_list.append(s)
        tgt_list.append(t)
        # Add reverse direction for undirected GCN message passing
        src_list.append(t)
        tgt_list.append(s)
    return torch.tensor([src_list, tgt_list], dtype=torch.long)


# ─── GCN model ────────────────────────────────────────────────────────────────

class CascadeGCN(torch.nn.Module):
    """2-layer GCN for per-node cascade failure probability prediction."""

    def __init__(self, in_channels: int = 5, hidden: int = 32, out_channels: int = 1):
        super().__init__()
        self.conv1 = GCNConv(in_channels, hidden)
        self.conv2 = GCNConv(hidden, out_channels)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        x = F.relu(self.conv1(x, edge_index))
        x = F.dropout(x, p=0.3, training=self.training)
        return torch.sigmoid(self.conv2(x, edge_index))


# ─── Synthetic data generation ────────────────────────────────────────────────

def _bfs_distances(seed_indices: list[int], adj: dict[int, list[int]]) -> dict[int, int]:
    """BFS from multiple seeds; returns dict of node_idx -> min hop distance."""
    distances: dict[int, int] = {}
    frontier = deque()
    for s in seed_indices:
        distances[s] = 0
        frontier.append(s)
    while frontier:
        node = frontier.popleft()
        for neighbor in adj[node]:
            if neighbor not in distances:
                distances[neighbor] = distances[node] + 1
                frontier.append(neighbor)
    return distances


def _generate_sample(
    edge_index: torch.Tensor,
    adj: dict[int, list[int]],
    degrees: list[float],
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Generate one synthetic training sample.

    Returns:
        x: [24, 5] feature tensor
        y: [24, 1] binary cascade label tensor
    """
    # Pick 1-3 random fault seed nodes
    num_seeds = random.randint(1, 3)
    seed_indices = random.sample(range(NUM_NODES), num_seeds)

    # BFS distances from seeds
    distances = _bfs_distances(seed_indices, adj)

    # Assign labels: fault seeds are always at-risk; neighbors with probability decay
    labels = [0.0] * NUM_NODES
    for idx in range(NUM_NODES):
        if idx in seed_indices:
            labels[idx] = 1.0
        else:
            dist = distances.get(idx, 999)
            if dist <= 3:
                prob = 0.7 * (1.0 / dist)
                if random.random() < prob:
                    labels[idx] = 1.0

    # Add 5% label noise for robustness
    for idx in range(NUM_NODES):
        if random.random() < 0.05:
            labels[idx] = 1.0 - labels[idx]

    # Build feature tensor (5 features per node)
    features = []
    for idx in range(NUM_NODES):
        node_id = NODE_IDS[idx]
        node_type = _NODE_TYPES[node_id]
        type_enc = NODE_TYPE_ENC[node_type]

        # Base features with random perturbation N(0, 0.05)
        load_norm = 0.65 + random.gauss(0, 0.05)  # normalized load / 100
        freq_dev = abs(60.0 + random.gauss(0, 0.1) - 60.0) / 1.0  # freq deviation
        anomaly_flag = 1.0 if idx in seed_indices else 0.0
        degree_norm = degrees[idx]

        # Clamp to valid ranges
        load_norm = max(0.0, min(1.0, load_norm))
        freq_dev = max(0.0, min(2.0, freq_dev))

        # Add perturbation noise to non-binary features
        features.append([
            load_norm + random.gauss(0, 0.05),
            freq_dev + random.gauss(0, 0.05),
            anomaly_flag,
            type_enc,
            degree_norm + random.gauss(0, 0.02),
        ])

    x = torch.tensor(features, dtype=torch.float32)
    y = torch.tensor([[l] for l in labels], dtype=torch.float32)
    return x, y


# ─── Training ─────────────────────────────────────────────────────────────────

def train() -> None:
    """Generate synthetic data, train GCN, and save model weights."""
    print("Building graph topology...")
    edge_index = build_edge_index()
    adj = _build_adjacency()
    degrees = _compute_degrees()

    print(f"Graph: {NUM_NODES} nodes, {edge_index.shape[1]} directed edges (bidirectional)")

    print("Generating 2000 synthetic training samples...")
    random.seed(42)
    samples = [_generate_sample(edge_index, adj, degrees) for _ in range(2000)]
    print(f"Generated {len(samples)} samples")

    model = CascadeGCN(in_channels=5, hidden=32, out_channels=1)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    criterion = torch.nn.BCELoss()

    print("Training GCN (100 epochs)...")
    model.train()
    for epoch in range(1, 101):
        epoch_loss = 0.0
        for x, y in samples:
            optimizer.zero_grad()
            out = model(x, edge_index)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()

        if epoch % 20 == 0:
            avg_loss = epoch_loss / len(samples)
            print(f"  Epoch {epoch:3d} | avg loss: {avg_loss:.4f}")

    # Save model weights
    output_path = os.path.join(os.path.dirname(__file__), "gnn_model.pt")
    torch.save(model.state_dict(), output_path)
    print(f"Saved model to {output_path} ({os.path.getsize(output_path)} bytes)")


if __name__ == "__main__":
    train()
