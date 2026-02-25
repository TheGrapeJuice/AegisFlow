"""
WebSocket broadcast loop and storm injection endpoint.
The broadcast loop runs as a background asyncio task started by the lifespan in main.py.
"""
import asyncio
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from backend.state import NODE_STATES, simulate_sensor_tick

router = APIRouter()

# Connected WebSocket clients
_clients: set[WebSocket] = set()


@router.websocket("/ws/nodes")
async def ws_nodes(websocket: WebSocket):
    await websocket.accept()
    _clients.add(websocket)
    try:
        while True:
            # Keep the connection alive — the broadcast loop drives outbound messages
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        _clients.discard(websocket)


async def _broadcast_loop():
    """Broadcast current node state to all WebSocket clients every 1 second."""
    while True:
        simulate_sensor_tick()
        payload = [n.model_dump() for n in NODE_STATES.values()]
        dead: set[WebSocket] = set()
        for ws in _clients.copy():
            try:
                await ws.send_json(payload)
            except Exception:
                dead.add(ws)
        _clients.difference_update(dead)
        await asyncio.sleep(1)


async def _inference_loop():
    """Run XGBoost inference every 5 seconds, updating NODE_STATES anomaly fields in-place."""
    from backend.ml.inference import predict_anomalies
    while True:
        await asyncio.sleep(5)
        try:
            results = predict_anomalies(NODE_STATES)
            for node_id, (score, flag) in results.items():
                if node_id in NODE_STATES:
                    NODE_STATES[node_id].anomaly_score = score
                    NODE_STATES[node_id].is_anomalous = flag
        except Exception as e:
            # Never crash the loop — log and continue
            print(f"[inference] error: {e}")


@router.post("/api/storm")
async def inject_storm():
    """
    Inject a fault: pick 1 generator as epicenter, set 4 nearby nodes to warning/critical.
    Returns which nodes were affected.
    """
    node_ids = list(NODE_STATES.keys())
    generator_ids = [nid for nid in node_ids if NODE_STATES[nid].type == "generator"]
    epicenter_id = random.choice(generator_ids)

    other_ids = [nid for nid in node_ids if nid != epicenter_id]
    affected = random.sample(other_ids, k=4)

    # Epicenter goes critical
    NODE_STATES[epicenter_id].status = "critical"
    NODE_STATES[epicenter_id].load = min(99.0, NODE_STATES[epicenter_id].load + 20.0)
    NODE_STATES[epicenter_id].frequency = 59.1

    # Two nearby nodes go warning
    for nid in affected[:2]:
        NODE_STATES[nid].status = "warning"
        NODE_STATES[nid].load = min(92.0, NODE_STATES[nid].load + 15.0)

    # Two more go critical
    for nid in affected[2:]:
        NODE_STATES[nid].status = "critical"
        NODE_STATES[nid].load = min(97.0, NODE_STATES[nid].load + 18.0)

    return JSONResponse({"injected": True, "epicenter": epicenter_id, "affected": affected})
