#!/usr/bin/env python3
"""
Quick script to test database connection.
"""
import os
import sys

# Load .env file
from dotenv import load_dotenv
load_dotenv()

def test_connection():
    db_url = os.environ.get("DATABASE_URL")
    
    if not db_url:
        print("❌ DATABASE_URL not set in environment")
        return False
    
    # Mask password for display
    import re
    masked_url = re.sub(r':([^:@]+)@', ':****@', db_url)
    print(f"📡 Testing connection to: {masked_url}")
    
    try:
        from sqlalchemy import create_engine, text
        
        engine = create_engine(db_url, pool_pre_ping=True, connect_args={"connect_timeout": 10})
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 as test"))
            row = result.fetchone()
            if row and row[0] == 1:
                print("✅ Database connection successful!")
                
                # Try to query profiles table
                try:
                    result = conn.execute(text("SELECT COUNT(*) FROM profiles"))
                    count = result.fetchone()[0]
                    print(f"✅ Profiles table accessible, {count} records")
                except Exception as e:
                    print(f"⚠️ Could not query profiles: {e}")
                
                return True
            else:
                print("❌ Unexpected result from test query")
                return False
                
    except Exception as e:
        print(f"❌ Connection failed: {type(e).__name__}")
        print(f"   Error: {e}")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
