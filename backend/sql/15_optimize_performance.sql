-- Optimization: Add missing indexes for RLS performance and foreign keys
-- These columns are frequently used in WHERE clauses and RLS policies

-- 1. Tasks: user_id is used in "Users can view their own tasks" RLS policy
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);

-- 2. Payment Orders: user_id is used in "Users can view their own orders" RLS policy
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON public.payment_orders(user_id);

-- 3. Task Outputs: task_id is used in foreign key lookups and RLS policies
CREATE INDEX IF NOT EXISTS idx_task_outputs_task_id ON public.task_outputs(task_id);

-- 4. Chat Threads: user_id and task_id are used in list_chat_threads and RLS
CREATE INDEX IF NOT EXISTS idx_chat_threads_user_id ON public.chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_task_id ON public.chat_threads(task_id);

-- 5. Chat Messages: thread_id is used to fetch messages for a thread
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id);
