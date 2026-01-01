-- Migration: Rename stripe_customer_id to creem_customer_id
-- Run this AFTER deploying the new code

-- Step 1: Add new creem_customer_id column (if needed for gradual migration)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creem_customer_id text unique;

-- Step 2: Rename column directly (recommended for clean migration)
ALTER TABLE profiles RENAME COLUMN stripe_customer_id TO creem_customer_id;

-- Verify the change
-- \d profiles
