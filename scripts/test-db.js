
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function testConnection() {
    console.log('Проверка подключения и структуры...')
    const { data, error } = await supabase.from('tasks').select('*').limit(1)

    if (error) {
        console.error('Ошибка:', error.message)
    } else if (data && data.length > 0) {
        console.log('Подключение успешно! Колонки в таблице:', Object.keys(data[0]))
        if (Object.keys(data[0]).includes('description')) {
            console.log('✅ Колонка "description" найдена!')
        } else {
            console.log('❌ Колонка "description" НЕ найдена.')
        }
    } else {
        console.log('Таблица пуста, но подключение работает.')
    }
}

testConnection()
