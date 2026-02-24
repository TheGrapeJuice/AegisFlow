import os
from datetime import datetime, timezone
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

INFLUX_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUX_TOKEN = os.getenv("INFLUXDB_TOKEN", "aegisflow-dev-token")
INFLUX_ORG = os.getenv("INFLUXDB_ORG", "aegisflow")
INFLUX_BUCKET = os.getenv("INFLUXDB_BUCKET", "grid_metrics")

_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
_write_api = _client.write_api(write_options=SYNCHRONOUS)
_query_api = _client.query_api()


def write_node_reading(
    node_id: str,
    node_type: str,
    voltage: float,
    frequency: float,
    load: float,
    status: str,
) -> None:
    """Write a single sensor reading for one node to InfluxDB."""
    point = (
        Point("node_reading")
        .tag("node_id", node_id)
        .tag("node_type", node_type)
        .tag("status", status)
        .field("voltage", voltage)
        .field("frequency", frequency)
        .field("load", load)
        .time(datetime.now(timezone.utc), WritePrecision.SECONDS)
    )
    _write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)


def query_node_history(node_id: str, minutes: int = 5) -> list[dict]:
    """
    Query the last N minutes of readings for a node.
    Returns a list of dicts with keys: time, voltage, frequency, load.
    """
    query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -{minutes}m)
  |> filter(fn: (r) => r._measurement == "node_reading")
  |> filter(fn: (r) => r.node_id == "{node_id}")
  |> filter(fn: (r) => r._field == "voltage" or r._field == "frequency" or r._field == "load")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])
'''
    tables = _query_api.query(query, org=INFLUX_ORG)
    results = []
    for table in tables:
        for record in table.records:
            results.append({
                "time": record.get_time().isoformat(),
                "voltage": record.values.get("voltage"),
                "frequency": record.values.get("frequency"),
                "load": record.values.get("load"),
            })
    return results
