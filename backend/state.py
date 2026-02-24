"""
Shared in-memory node state for AegisFlow backend.
Seeded from the same Chicago-area grid topology as the frontend.
NODE_STATES is the single source of truth for WebSocket broadcasts and storm injection.
"""
import random
from backend.models import NodeState

# 24-node Chicago-area grid topology
# 4 generators, 8 substations, 8 transformers, 4 junctions
NODE_STATES: dict[str, NodeState] = {
    # --- GENERATORS (4) ---
    "NODE-01": NodeState(
        id="NODE-01", name="Lakeshore Generator", type="generator",
        status="normal", lng=-87.5971, lat=41.9211,
        voltage=345.0, frequency=60.0, load=78.0,
    ),
    "NODE-02": NodeState(
        id="NODE-02", name="Southwest Power Station", type="generator",
        status="normal", lng=-87.7341, lat=41.8312,
        voltage=345.0, frequency=59.9, load=82.0,
    ),
    "NODE-03": NodeState(
        id="NODE-03", name="Northwest Generation Plant", type="generator",
        status="warning", lng=-87.7512, lat=41.9381,
        voltage=345.0, frequency=59.7, load=94.0,
    ),
    "NODE-04": NodeState(
        id="NODE-04", name="South Harbor Generator", type="generator",
        status="normal", lng=-87.6021, lat=41.8101,
        voltage=345.0, frequency=60.1, load=71.0,
    ),

    # --- SUBSTATIONS (8) ---
    "NODE-05": NodeState(
        id="NODE-05", name="Lincoln Park Substation", type="substation",
        status="normal", lng=-87.6394, lat=41.9201,
        voltage=138.0, frequency=60.0, load=65.0,
    ),
    "NODE-06": NodeState(
        id="NODE-06", name="West Town Substation", type="substation",
        status="normal", lng=-87.6891, lat=41.9011,
        voltage=138.0, frequency=60.0, load=58.0,
    ),
    "NODE-07": NodeState(
        id="NODE-07", name="Pilsen Substation", type="substation",
        status="critical", lng=-87.6701, lat=41.8551,
        voltage=138.0, frequency=59.5, load=98.0,
    ),
    "NODE-08": NodeState(
        id="NODE-08", name="Hyde Park Substation", type="substation",
        status="normal", lng=-87.6001, lat=41.8021,
        voltage=138.0, frequency=60.0, load=60.0,
    ),
    "NODE-09": NodeState(
        id="NODE-09", name="Wicker Park Substation", type="substation",
        status="warning", lng=-87.6821, lat=41.9131,
        voltage=138.0, frequency=59.8, load=88.0,
    ),
    "NODE-10": NodeState(
        id="NODE-10", name="Bridgeport Substation", type="substation",
        status="normal", lng=-87.6441, lat=41.8401,
        voltage=138.0, frequency=60.0, load=72.0,
    ),
    "NODE-11": NodeState(
        id="NODE-11", name="Humboldt Park Substation", type="substation",
        status="normal", lng=-87.7101, lat=41.9001,
        voltage=138.0, frequency=60.1, load=55.0,
    ),
    "NODE-12": NodeState(
        id="NODE-12", name="South Shore Substation", type="substation",
        status="normal", lng=-87.5811, lat=41.8251,
        voltage=138.0, frequency=60.0, load=67.0,
    ),

    # --- TRANSFORMERS (8) ---
    "NODE-13": NodeState(
        id="NODE-13", name="River North Transformer", type="transformer",
        status="normal", lng=-87.6361, lat=41.8941,
        voltage=69.0, frequency=60.0, load=51.0,
    ),
    "NODE-14": NodeState(
        id="NODE-14", name="Loop Transformer", type="transformer",
        status="normal", lng=-87.6321, lat=41.8811,
        voltage=69.0, frequency=60.0, load=74.0,
    ),
    "NODE-15": NodeState(
        id="NODE-15", name="Bucktown Transformer", type="transformer",
        status="normal", lng=-87.6711, lat=41.9181,
        voltage=69.0, frequency=60.0, load=48.0,
    ),
    "NODE-16": NodeState(
        id="NODE-16", name="Bridgeview Transformer", type="transformer",
        status="warning", lng=-87.6641, lat=41.8711,
        voltage=69.0, frequency=59.8, load=91.0,
    ),
    "NODE-17": NodeState(
        id="NODE-17", name="Southport Transformer", type="transformer",
        status="normal", lng=-87.6631, lat=41.9001,
        voltage=69.0, frequency=60.0, load=62.0,
    ),
    "NODE-18": NodeState(
        id="NODE-18", name="Chinatown Transformer", type="transformer",
        status="normal", lng=-87.6321, lat=41.8541,
        voltage=69.0, frequency=60.1, load=58.0,
    ),
    "NODE-19": NodeState(
        id="NODE-19", name="Lawndale Transformer", type="transformer",
        status="normal", lng=-87.7121, lat=41.8681,
        voltage=69.0, frequency=60.0, load=44.0,
    ),
    "NODE-20": NodeState(
        id="NODE-20", name="Kenwood Transformer", type="transformer",
        status="critical", lng=-87.6051, lat=41.8151,
        voltage=69.0, frequency=59.4, load=99.0,
    ),

    # --- JUNCTIONS (4) ---
    "NODE-21": NodeState(
        id="NODE-21", name="North Central Junction", type="junction",
        status="normal", lng=-87.6521, lat=41.9071,
        voltage=34.0, frequency=60.0, load=70.0,
    ),
    "NODE-22": NodeState(
        id="NODE-22", name="South Central Junction", type="junction",
        status="normal", lng=-87.6421, lat=41.8631,
        voltage=34.0, frequency=60.0, load=76.0,
    ),
    "NODE-23": NodeState(
        id="NODE-23", name="West Loop Junction", type="junction",
        status="normal", lng=-87.6621, lat=41.8831,
        voltage=34.0, frequency=60.0, load=68.0,
    ),
    "NODE-24": NodeState(
        id="NODE-24", name="Midway Junction", type="junction",
        status="normal", lng=-87.6521, lat=41.8441,
        voltage=34.0, frequency=60.0, load=63.0,
    ),
}

# 39 edges in ring + radial mesh pattern
EDGES: list[dict] = [
    # Generator -> Substation feeds (radial trunk lines)
    {"id": "EDGE-01", "source": "NODE-01", "target": "NODE-05", "capacity": 400},
    {"id": "EDGE-02", "source": "NODE-01", "target": "NODE-12", "capacity": 350},
    {"id": "EDGE-03", "source": "NODE-02", "target": "NODE-07", "capacity": 400},
    {"id": "EDGE-04", "source": "NODE-02", "target": "NODE-10", "capacity": 380},
    {"id": "EDGE-05", "source": "NODE-03", "target": "NODE-06", "capacity": 400},
    {"id": "EDGE-06", "source": "NODE-03", "target": "NODE-11", "capacity": 350},
    {"id": "EDGE-07", "source": "NODE-04", "target": "NODE-08", "capacity": 400},
    {"id": "EDGE-08", "source": "NODE-04", "target": "NODE-12", "capacity": 380},
    # Substation ring (outer loop)
    {"id": "EDGE-09", "source": "NODE-05", "target": "NODE-06", "capacity": 250},
    {"id": "EDGE-10", "source": "NODE-06", "target": "NODE-11", "capacity": 220},
    {"id": "EDGE-11", "source": "NODE-11", "target": "NODE-07", "capacity": 240},
    {"id": "EDGE-12", "source": "NODE-07", "target": "NODE-10", "capacity": 260},
    {"id": "EDGE-13", "source": "NODE-10", "target": "NODE-08", "capacity": 230},
    {"id": "EDGE-14", "source": "NODE-08", "target": "NODE-12", "capacity": 210},
    {"id": "EDGE-15", "source": "NODE-09", "target": "NODE-05", "capacity": 200},
    {"id": "EDGE-16", "source": "NODE-09", "target": "NODE-06", "capacity": 200},
    # Substation -> Transformer feeds
    {"id": "EDGE-17", "source": "NODE-05", "target": "NODE-13", "capacity": 180},
    {"id": "EDGE-18", "source": "NODE-05", "target": "NODE-15", "capacity": 160},
    {"id": "EDGE-19", "source": "NODE-06", "target": "NODE-17", "capacity": 170},
    {"id": "EDGE-20", "source": "NODE-07", "target": "NODE-16", "capacity": 175},
    {"id": "EDGE-21", "source": "NODE-08", "target": "NODE-20", "capacity": 165},
    {"id": "EDGE-22", "source": "NODE-10", "target": "NODE-18", "capacity": 155},
    {"id": "EDGE-23", "source": "NODE-11", "target": "NODE-19", "capacity": 160},
    {"id": "EDGE-24", "source": "NODE-12", "target": "NODE-20", "capacity": 150},
    # Transformer -> Junction connections
    {"id": "EDGE-25", "source": "NODE-13", "target": "NODE-21", "capacity": 120},
    {"id": "EDGE-26", "source": "NODE-14", "target": "NODE-21", "capacity": 130},
    {"id": "EDGE-27", "source": "NODE-14", "target": "NODE-22", "capacity": 125},
    {"id": "EDGE-28", "source": "NODE-15", "target": "NODE-21", "capacity": 110},
    {"id": "EDGE-29", "source": "NODE-16", "target": "NODE-23", "capacity": 115},
    {"id": "EDGE-30", "source": "NODE-17", "target": "NODE-23", "capacity": 120},
    {"id": "EDGE-31", "source": "NODE-18", "target": "NODE-22", "capacity": 105},
    {"id": "EDGE-32", "source": "NODE-18", "target": "NODE-24", "capacity": 100},
    {"id": "EDGE-33", "source": "NODE-19", "target": "NODE-23", "capacity": 110},
    {"id": "EDGE-34", "source": "NODE-20", "target": "NODE-24", "capacity": 100},
    # Junction interconnects (inner mesh)
    {"id": "EDGE-35", "source": "NODE-21", "target": "NODE-22", "capacity": 90},
    {"id": "EDGE-36", "source": "NODE-21", "target": "NODE-23", "capacity": 85},
    {"id": "EDGE-37", "source": "NODE-22", "target": "NODE-24", "capacity": 80},
    {"id": "EDGE-38", "source": "NODE-23", "target": "NODE-24", "capacity": 80},
    # Additional cross-link for mesh topology
    {"id": "EDGE-39", "source": "NODE-13", "target": "NODE-14", "capacity": 140},
]

# Nominal voltage by node type (kV)
_NOMINAL_VOLTAGE: dict[str, float] = {
    "generator": 345.0,
    "substation": 138.0,
    "transformer": 69.0,
    "junction": 34.0,
}


def simulate_sensor_tick() -> None:
    """
    Apply small random noise to each node's voltage, frequency, and load.
    Recompute status based on thresholds:
      - load > 96% or frequency outside 59.0-61.0 Hz -> critical
      - load > 90% or frequency outside 59.5-60.5 Hz -> warning
      - else -> normal
    Called once per second by the WebSocket broadcast loop.
    """
    for node in NODE_STATES.values():
        nominal_v = _NOMINAL_VOLTAGE.get(node.type, 138.0)

        # Voltage: +/- 0.5 kV, clamped to +/-5% of nominal
        node.voltage = max(
            nominal_v * 0.95,
            min(nominal_v * 1.05, node.voltage + random.uniform(-0.5, 0.5)),
        )

        # Frequency: +/- 0.05 Hz, clamped to 59.0-61.0 Hz
        node.frequency = max(
            59.0,
            min(61.0, node.frequency + random.uniform(-0.05, 0.05)),
        )

        # Load: +/- 2%, clamped to 0-100%
        node.load = max(0.0, min(100.0, node.load + random.uniform(-2.0, 2.0)))

        # Recompute status
        if node.load > 96.0 or not (59.0 <= node.frequency <= 61.0):
            node.status = "critical"
        elif node.load > 90.0 or not (59.5 <= node.frequency <= 60.5):
            node.status = "warning"
        else:
            node.status = "normal"
