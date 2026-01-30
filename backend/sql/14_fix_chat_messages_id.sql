-- 14_fix_chat_messages_id.sql
-- Fix: AI SDK message IDs are strings (e.g. nanoid), not UUIDs.
-- Change the id column type from UUID to TEXT to avoid insert failures.

-- 1. Change column type
ALTER TABLE public.chat_messages 
  ALTER COLUMN id TYPE TEXT;

-- 2. Drop default (client provides generated IDs)
ALTER TABLE public.chat_messages 
  ALTER COLUMN id DROP DEFAULT;
