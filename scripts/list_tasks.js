
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function getAvailableTasks() {
    const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .is('parent_id', null)
        .is('list_id', null)
        .eq('is_completed', false)
        .order('order_index', { ascending: true })

    if (taskError) {
        console.error('Error fetching tasks:', taskError)
        return
    }

    console.log('\n--- ACTIVE TASKS ---')
    tasks.forEach(task => {
        if (!task.title.includes('This is a very long task title')) {
            console.log(`[ID ${task.id}] ${task.title}`)
        }
    })
    console.log('--------------------\n')
}

getAvailableTasks()
