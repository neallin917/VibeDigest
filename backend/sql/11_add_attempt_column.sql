-- Migration: Add attempt column to task_outputs table
-- Description: Tracks the number of processing attempts for retry logic.

ALTER TABLE public.task_outputs
ADD COLUMN IF NOT EXISTS attempt INTEGER DEFAULT 0;

COMMENT ON COLUMN public.task_outputs.attempt IS 'Number of processing attempts/retries';
