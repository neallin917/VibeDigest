-- Allow all authenticated users to view the outputs (summary, script, etc.) for the specific demo task

CREATE POLICY "Allow public read access to demo task outputs"
ON task_outputs
FOR SELECT
USING (task_id = '1e60a06c-ef37-4f82-bffd-1a5135cb45c7');
