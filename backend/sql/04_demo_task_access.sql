-- Allow all authenticated users to view the specific demo task
-- This enables the "Demo Task" feature for new users

CREATE POLICY "Allow public read access to demo task"
ON tasks
FOR SELECT
USING (id = '1e60a06c-ef37-4f82-bffd-1a5135cb45c7');
