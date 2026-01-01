-- Add parent_id to tasks for subtasks (using bigint to match id type)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE;
