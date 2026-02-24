#!/usr/bin/env python3
"""
Synthetic sensor data generator.
Writes all 24 grid node readings to InfluxDB every 5 seconds.
Run alongside the FastAPI server: python backend/generator.py
"""
import time
import signal
import sys
from backend.state import NODE_STATES, simulate_sensor_tick
from backend.influx_client import write_node_reading

WRITE_INTERVAL = 5  # seconds between InfluxDB writes


def run():
    print(f"[generator] Starting — writing {len(NODE_STATES)} nodes every {WRITE_INTERVAL}s")
    print("[generator] Press Ctrl+C to stop")

    def _shutdown(sig, frame):
        print("\n[generator] Shutting down")
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    tick = 0
    while True:
        simulate_sensor_tick()
        for node_id, node in NODE_STATES.items():
            try:
                write_node_reading(
                    node_id=node.id,
                    node_type=node.type,
                    voltage=node.voltage,
                    frequency=node.frequency,
                    load=node.load,
                    status=node.status,
                )
            except Exception as e:
                print(f"[generator] Write error for {node_id}: {e}")
        tick += 1
        print(f"[generator] Tick {tick}: wrote {len(NODE_STATES)} nodes")
        time.sleep(WRITE_INTERVAL)


if __name__ == "__main__":
    run()
