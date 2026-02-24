from pydantic import BaseModel
from typing import Literal

NodeStatus = Literal["normal", "warning", "critical"]
NodeType = Literal["substation", "transformer", "junction", "generator"]


class NodeState(BaseModel):
    id: str
    name: str
    type: NodeType
    status: NodeStatus
    lng: float
    lat: float
    voltage: float
    frequency: float
    load: float


class TopologyResponse(BaseModel):
    nodes: list[NodeState]
    edges: list[dict]
