import os
import sys
from sqlalchemy import text

# Add the project root to the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.db_client import DBClient

def main():
    print("Checking database connection...")
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL environment variable is not set.")
        return

    print(f"DATABASE_URL is set (starts with {db_url.split('://')[0]}://...)")

    client = DBClient()
    if not client.engine:
        print("ERROR: Failed to initialize DBClient engine.")
        return

    try:
        # Simple query to check connection
        result = client._execute_query("SELECT 1")
        print("Successfully connected to the database!")
    except Exception as e:
        print(f"ERROR: Failed to execute query: {e}")

if __name__ == "__main__":
    main()
