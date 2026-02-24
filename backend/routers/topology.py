from fastapi import APIRouter
from backend.state import NODE_STATES, EDGES
from backend.models import TopologyResponse, NodeState

router = APIRouter()


@router.get("/api/topology", response_model=TopologyResponse)
async def get_topology():
    return TopologyResponse(
        nodes=list(NODE_STATES.values()),
        edges=EDGES,
    )
