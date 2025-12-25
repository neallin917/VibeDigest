-- Template to insert localized content for the Demo Task
-- Task ID: 1e60a06c-ef37-4f82-bffd-1a5135cb45c7

-- Instructions:
-- 1. Replace the 'content' JSON with the actual translated summary for each language.
-- 2. Run this SQL in your Supabase SQL Editor.

-- English (Default - already exists, but ensuring it's marked as 'en')
UPDATE task_outputs 
SET locale = 'en'
WHERE task_id = '1e60a06c-ef37-4f82-bffd-1a5135cb45c7' AND kind = 'summary';

-- Chinese (zh)
INSERT INTO task_outputs (id, task_id, kind, locale, status, progress, content)
VALUES (
    uuid_generate_v4(), 
    '1e60a06c-ef37-4f82-bffd-1a5135cb45c7', 
    'summary', 
    'zh', 
    'completed', 
    100, 
    '{
        "version": 1,
        "language": "zh",
        "overview": "这是一个用于演示的示例任务摘要...",
        "keypoints": [
            {"title": "重点 1", "detail": "详细描述...", "startSeconds": 10, "endSeconds": 20},
            {"title": "重点 2", "detail": "详细描述...", "startSeconds": 30, "endSeconds": 40}
        ]
    }'
);

-- Spanish (es)
INSERT INTO task_outputs (id, task_id, kind, locale, status, progress, content)
VALUES (
    uuid_generate_v4(), 
    '1e60a06c-ef37-4f82-bffd-1a5135cb45c7', 
    'summary', 
    'es', 
    'completed', 
    100, 
    '{
        "version": 1,
        "language": "es",
        "overview": "Este es un resumen de ejemplo para la tarea de demostración...",
        "keypoints": [
            {"title": "Punto clave 1", "detail": "Detalle...", "startSeconds": 10, "endSeconds": 20}
        ]
    }'
);

-- Repeat for other languages: ar, fr, ru, pt, hi, ja, ko
