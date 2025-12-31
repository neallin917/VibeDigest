import pytest
from httpx import AsyncClient, ASGITransport
from main import app, db_client
from typing import AsyncGenerator
import os
import time
from sqlalchemy import create_engine, text


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="session")
def postgres_container():
    """
    Returns DB URL.
    Optimized: Uses TEST_DATABASE_URL if set, or defaults to local docker run.
    """
    # For debugging: Use the manually started container
    db_url = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres:test@localhost:5455/postgres")
    
    # Simple check if ready
    # We yield it. If connection fails in test_db, it will raise there.
    yield db_url
    
    # We do not stop it automatically here if it's external.
    pass

@pytest.fixture(scope="session")
def test_db(postgres_container):
    """
    Apply schema to the test DB and return a connected engine or URL.
    """
    db_url = postgres_container
    engine = create_engine(db_url)
    
    # 1. Read Schema
    # Use path relative to this file (backend/tests/conftest.py)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    schema_path = os.path.join(base_dir, "sql", "full_schema_dump.txt")
    if not os.path.exists(schema_path):
        # Fallback or error
        raise FileNotFoundError(f"Schema dump not found at {schema_path}")
        
    with open(schema_path, "r") as f:
        schema_sql = f.read()
        
    # 2. Apply Schema
    # We need to handle 'auth.users' dependency since we don't have Supabase Auth in container.
    # So we must create a fake auth schema and users table first.
    pre_setup_sql = """
    DROP TABLE IF EXISTS public.task_outputs CASCADE;
    DROP TABLE IF EXISTS public.tasks CASCADE;
    DROP TABLE IF EXISTS auth.users CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY,
        email text,
        created_at timestamptz DEFAULT now()
    );
    -- Mock extensions if needed
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    
    -- Mock Supabase Roles
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      GRANT usage ON SCHEMA public TO anon, authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    END
    $$;
    
    -- Mock Supabase auth functions used in Policies
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      -- Return the generic test user ID or null
      SELECT '00000000-0000-0000-0000-000000000001'::uuid;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      SELECT 'authenticated';
    $$ LANGUAGE sql STABLE;
    
    -- Create missing tables that policies depend on
    CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        tier text DEFAULT 'free',
        credits_total integer DEFAULT 30,
        credits_used integer DEFAULT 0,
        usage_limit integer DEFAULT 100,
        usage_count integer DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.tasks (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id uuid REFERENCES auth.users(id),
        video_url text,
        status text DEFAULT 'pending',
        progress integer DEFAULT 0,
        video_title text,
        thumbnail_url text,
        error_message text,
        author text,
        author_url text,
        author_image_url text,
        description text,
        keywords text[],
        view_count bigint,
        upload_date timestamptz,
        duration integer,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        is_demo boolean DEFAULT false,
        summary_language text
    );

    CREATE TABLE IF NOT EXISTS public.task_outputs (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES auth.users(id),
        kind text,
        locale text,
        status text DEFAULT 'pending',
        progress integer DEFAULT 0,
        content jsonb,
        error_message text,
        attempt integer DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );

    -- Insert Demo Task to satisfy Foreign Keys in schema dump
    -- But first, ensure the user exists!
    INSERT INTO auth.users (id, email)
    VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, tier, usage_limit, usage_count)
    VALUES ('00000000-0000-0000-0000-000000000001', 'free', 100, 0)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.tasks (id, user_id, video_url, video_title, is_demo)
    VALUES (
        '1e60a06c-ef37-4f82-bffd-1a5135cb45c7',
        '00000000-0000-0000-0000-000000000001', 
        'https://example.com/demo.mp4',
        'Demo Task',
        true
    ) ON CONFLICT (id) DO NOTHING;
    """
    
    print("DEBUG: Connecting to DB...")
    with engine.connect() as conn:
        print("DEBUG: Applying pre-setup SQL...")
        conn.execute(text(pre_setup_sql))
        conn.commit()
        
        try:
             print("DEBUG: Applying Full Schema...")
             # text() with multiple statements works if the driver allows it. 
             # psycopg2 usually needs autocommit or special handling, but execute() often works unless it's huge.
             conn.execute(text(schema_sql))
             conn.commit()
             print("DEBUG: Schema Applied!")
        except Exception as e:
             print(f"DEBUG: Schema application warning/error: {e}")

    print("DEBUG: test_db fixture done.")
    return db_url

@pytest.fixture(scope="module")
async def async_client(test_db) -> AsyncGenerator[AsyncClient, None]:
    """
    Fixture for creating an async client.
    Overrides the DBClient to point to the test container.
    """
    # Override Global DBClient's engine
    # We need to patch the instance 'db_client' in main.
    os.environ["DATABASE_URL"] = test_db
    
    # Re-init engine (hacky but effective for singleton pattern in main.py)
    # Actually db_client is instantiated at module level in main.py.
    # We can manually replace its inner engine.
    from main import db_client
    db_client.db_url = test_db
    db_client.engine = create_engine(test_db)
    db_client.Session = None # Clear session factory
    from sqlalchemy.orm import sessionmaker, scoped_session
    db_client.Session = scoped_session(sessionmaker(bind=db_client.engine))
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
