-- Comprehensive RLS Policy Fix (v4)
-- This script resolves "Multiple Permissive Policies" by strictly separating policies by ROLE.
-- ANON users get: Demo content access only.
-- AUTH users get: Own content access OR Demo content access (consolidated into one policy).
-- This ensures no single role triggers multiple policies for the same action.

DO $$
DECLARE
    pol record;
BEGIN
    -- 1. DROP ALL existing policies on relevant tables to start fresh
    -- This includes the "Demo" policies which caused overlaps
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tasks' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname);
    END LOOP;

    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'task_outputs' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_outputs', pol.policyname);
    END LOOP;

    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;

    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'payment_orders' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_orders', pol.policyname);
    END LOOP;
END $$;

-- --- 1. TABLE: TASKS ---

-- Policy for ANONYMOUS users (Demo only)
CREATE POLICY "Anon can view demo task"
ON public.tasks
FOR SELECT
TO anon
USING (
  id = '1e60a06c-ef37-4f82-bffd-1a5135cb45c7'
);

-- Policy for AUTHENTICATED users (Own tasks + Demo task)
-- Consolidating both logic prevents "Multiple Permissive Policies" warning
CREATE POLICY "Auth can view own tasks or demo"
ON public.tasks
FOR ALL
TO authenticated
USING (
  (select auth.uid()) = user_id
  OR
  id = '1e60a06c-ef37-4f82-bffd-1a5135cb45c7'
);

-- --- 2. TABLE: TASK_OUTPUTS ---

-- Policy for ANONYMOUS users (Demo only)
CREATE POLICY "Anon can view demo task outputs"
ON public.task_outputs
FOR SELECT
TO anon
USING (
  task_id = '1e60a06c-ef37-4f82-bffd-1a5135cb45c7'
);

-- Policy for AUTHENTICATED users (Own outputs + Demo outputs)
CREATE POLICY "Auth can view own task outputs or demo"
ON public.task_outputs
FOR ALL
TO authenticated
USING (
  -- Own inputs (via parent task user_id)
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_outputs.task_id
      AND tasks.user_id = (SELECT auth.uid())
  )
  OR
  -- Demo outputs
  task_id = '1e60a06c-ef37-4f82-bffd-1a5135cb45c7'
);

-- --- 3. TABLE: PROFILES ---

-- Policy for AUTHENTICATED users (Own profile)
-- No demo needed here usually? Assuming profiles are private.
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR ALL
TO authenticated
USING (
  (select auth.uid()) = id
);

-- --- 4. TABLE: PAYMENT_ORDERS ---

-- Policy for AUTHENTICATED users (Own orders)
CREATE POLICY "Users can view own orders"
ON public.payment_orders
FOR ALL
TO authenticated
USING (
  (select auth.uid()) = user_id
);
