-- Drop the existing inefficient policy
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;

-- Create the optimized policy
-- This uses (select auth.uid()) to prevent re-evaluation for every row
CREATE POLICY "Users can view their own tasks"
ON public.tasks
FOR ALL
USING (
  (select auth.uid()) = user_id
);
