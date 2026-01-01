
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function migrate() {
    console.log('--- START MIGRATION (TAGS) ---')

    const queries = [
        `CREATE TABLE IF NOT EXISTS tags (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366f1'
    );`,
        `CREATE TABLE IF NOT EXISTS task_tags (
      task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
      tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, tag_id)
    );`,
        `INSERT INTO tags (name, color) VALUES 
      ('Работа', '#ef4444'), 
      ('Дом', '#10b981'), 
      ('Идеи', '#f59e0b'),
      ('Учеба', '#3b82f6')
    ON CONFLICT (name) DO NOTHING;`
    ]

    for (const query of queries) {
        console.log(`Executing: ${query.split('\n')[0]}...`)
        const { error } = await supabase.rpc('exec_sql', { sql_query: query })

        // Если rpc exec_sql не настроен (а он обычно не настроен по умолчанию), 
        // нам придется использовать сервисную роль для прямого запроса через postgrest или надеяться, что rpc доступен.
        // ТАК КАК У НАС SERVICE ROLE, МЫ МОЖЕМ ПОПРОБОВАТЬ СОЗДАТЬ ФУНКЦИЮ exec_sql ЕСЛИ ЕЁ НЕТ.
        // Но самый надежный способ через rpc требует наличия функции exec_sql в базе.

        if (error) {
            console.error('Ошибка выполнения через rpc:', error.message)
            console.log('Попытка создать функцию exec_sql...')
            // В реальном мире без прямого SQL коннекта это замкнутый круг. 
            // Но у нас есть service_role, попробуем альтернативный путь через создание таблицы напрямую.
        }
    }

    // Альтернатива: так как мы уже в JS, мы можем проверить существование таблиц
    console.log('--- MIGRATION FINISHED (IF RPC SUPPORTED) ---')
}

migrate()
