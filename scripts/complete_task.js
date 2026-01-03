
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function markTaskAsCompleted(taskId) {
    console.log(`Marking task with ID ${taskId} as completed...`)
    const { data, error } = await supabase
        .from('tasks')
        .update({ is_completed: true })
        .eq('id', taskId)
        .select()

    if (error) {
        console.error('Error updating task:', error)
    } else {
        console.log('Task successfully marked as completed:', data)
    }
}

const args = process.argv.slice(2);
const idString = args[0];
if (idString) {
    markTaskAsCompleted(parseInt(idString));
} else {
    console.log('Please provide a task ID.');
}
