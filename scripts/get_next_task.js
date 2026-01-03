
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function getNextActiveTask() {
    const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .is('parent_id', null)
        .is('list_id', null)
        .eq('is_completed', false)
        .order('order_index', { ascending: true })
        .limit(1)

    if (taskError) {
        console.error('Error fetching tasks:', taskError)
        return
    }

    if (tasks && tasks.length > 0) {
        const task = tasks[0]
        console.log('\n--- NEXT ACTIVE TASK ---')
        console.log('ID:', task.id)
        console.log('Title:', task.title)
        console.log('Description:', task.description)
        console.log('------------------------\n')
    } else {
        console.log('No active tasks found in Incoming.')
    }
}

getNextActiveTask()
