-- Migration: Add video metadata columns to tasks table
-- Description: Stores rich metadata extracted from video platforms (YouTube, Bilibili, etc.)

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS author TEXT,
ADD COLUMN IF NOT EXISTS author_url TEXT,
ADD COLUMN IF NOT EXISTS author_image_url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS keywords TEXT[],
ADD COLUMN IF NOT EXISTS view_count BIGINT,
ADD COLUMN IF NOT EXISTS upload_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Add comment to explain columns
COMMENT ON COLUMN tasks.author IS 'Uploader name or channel title';
COMMENT ON COLUMN tasks.author_url IS 'URL to the uploader channel/profile';
COMMENT ON COLUMN tasks.view_count IS 'View count at the time of processing';
