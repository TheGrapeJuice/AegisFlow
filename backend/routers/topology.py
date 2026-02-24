from fastapi import APIRouter, HTTPException
from backend.state import NODE_STATES, EDGES
from backend.models import TopologyResponse, NodeState
from backend.influx_client import query_node_history

router = APIRouter()


@router.get("/api/topology", response_model=TopologyResponse)
async def get_topology():
    return TopologyResponse(
        nodes=list(NODE_STATES.values()),
        edges=EDGES,
    )


@router.get("/api/nodes/{node_id}/history")
async def get_node_history(node_id: str, minutes: int = 5) -> list[dict]:
    """Return the last N minutes of time-series readings for a node from InfluxDB."""
    if node_id not in NODE_STATES:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")
    return query_node_history(node_id, minutes=minutes)
