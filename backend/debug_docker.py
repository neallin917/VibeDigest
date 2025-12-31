import logging
from testcontainers.postgres import PostgresContainer
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

print("Starting Postgres Container...")
try:
    postgres = PostgresContainer("postgres:15-alpine")
    postgres.start()
    print("Container started!")
    print("URL:", postgres.get_connection_url())
    postgres.stop()
    print("Container stopped!")
except Exception as e:
    print(f"Failed: {e}")
