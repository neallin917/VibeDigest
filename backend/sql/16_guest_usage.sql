-- Guest usage tracking table
-- Tracks trial usage per guest_id to enforce free-tier quota
CREATE TABLE IF NOT EXISTS public.guest_usage (
    guest_id text PRIMARY KEY,
    usage_count integer DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);
