-- Elegant Demo Task Solution: Add is_demo column to tasks table
-- This allows managing demo tasks from a single source (database)
-- No code changes needed to add/remove demo tasks

-- Step 1: Add is_demo column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- Step 2: Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_tasks_is_demo ON public.tasks(is_demo) WHERE is_demo = TRUE;

-- Step 3: Set existing demo tasks
UPDATE public.tasks SET is_demo = TRUE WHERE id IN (
    '1e60a06c-ef37-4f82-bffd-1a5135cb45c7',
    '5812fd5f-9fd5-4b94-aaef-9968993e5116',
    '51eb09bb-417f-4b5b-9be3-92a44f1b14d8',
    'af4c4f66-f45c-4138-a93e-8b592e6fc294',
    '8495e0c7-874b-4eee-ba88-b96f5633ce84'
);

-- Step 4: Drop old RLS policies and create new ones based on is_demo field
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tasks' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname);
    END LOOP;

    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'task_outputs' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_outputs', pol.policyname);
    END LOOP;
END $$;

-- --- TABLE: TASKS ---

-- Anonymous users can view demo tasks
CREATE POLICY "Anon can view demo tasks"
ON public.tasks
FOR SELECT
TO anon
USING (is_demo = TRUE);

-- Authenticated users can view own tasks OR demo tasks
CREATE POLICY "Auth can view own tasks or demo"
ON public.tasks
FOR ALL
TO authenticated
USING (
    (SELECT auth.uid()) = user_id
    OR is_demo = TRUE
);

-- --- TABLE: TASK_OUTPUTS ---

-- Anonymous users can view outputs of demo tasks
CREATE POLICY "Anon can view demo task outputs"
ON public.task_outputs
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_outputs.task_id
        AND tasks.is_demo = TRUE
    )
);

-- Authenticated users can view own task outputs OR demo task outputs
CREATE POLICY "Auth can view own task outputs or demo"
ON public.task_outputs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_outputs.task_id
        AND (tasks.user_id = (SELECT auth.uid()) OR tasks.is_demo = TRUE)
    )
);
