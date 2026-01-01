-- Создание таблицы списков
CREATE TABLE IF NOT EXISTS lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#4f46e5',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавление колонки list_id в таблицу tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES lists(id) ON DELETE SET NULL;

-- Добавление начальных списков (опционально)
INSERT INTO lists (name, color) VALUES 
('Личное', '#10b981'),
('Работа', '#3b82f6'),
('Покупки', '#f59e0b')
ON CONFLICT DO NOTHING;
