import os
import sys
import psycopg2
from dotenv import load_dotenv

def main():
    # Load .env from project root
    dotenv_path = '/Users/haoran/Documents/coding/VibeDigest/.env'
    print(f"Loading .env from {dotenv_path}")
    load_dotenv(dotenv_path)

    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("Error: DATABASE_URL not found in environment variables")
        sys.exit(1)

    sql_file_path = '/Users/haoran/Documents/coding/VibeDigest/backend/sql/15_optimize_performance.sql'
    
    print(f"Reading SQL file: {sql_file_path}")
    try:
        with open(sql_file_path, 'r') as f:
            sql_content = f.read()
    except Exception as e:
        print(f"Error reading SQL file: {e}")
        sys.exit(1)

    print(f"Connecting to database...")
    try:
        # Connect to an existing database
        conn = psycopg2.connect(db_url)

        # Open a cursor to perform database operations
        cur = conn.cursor()
        
        print("Executing SQL migration...")
        # Execute the SQL command
        cur.execute(sql_content)
        
        # Make the changes to the database persistent
        conn.commit()
        
        # Close communication with the database
        cur.close()
        conn.close()
        print("Migration executed successfully.")
        
    except Exception as e:
        print(f"Database error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
