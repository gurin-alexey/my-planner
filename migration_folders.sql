-- Создание таблицы папок для группировки списков
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавление колонки folder_id в таблицу lists
ALTER TABLE lists ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Добавление начальной папки "ЛИЧНОЕ", как на скриншоте
INSERT INTO folders (name) VALUES ('ЛИЧНОЕ') ON CONFLICT DO NOTHING;

-- Привязка существующих списков к новой папке (опционально)
-- UPDATE lists SET folder_id = (SELECT id FROM folders WHERE name = 'ЛИЧНОЕ' LIMIT 1);
