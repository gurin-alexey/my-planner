
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function getIncomingTask() {
    // 1. Get the list ID for "Входящие"
    const { data: lists, error: listError } = await supabase
        .from('lists')
        .select('*')
        .ilike('name', 'Входящие')

    if (listError) {
        console.error('Error fetching lists:', listError)
        return
    }

    let incomingListId = null
    if (lists && lists.length > 0) {
        incomingListId = lists[0].id
        console.log(`Found "Входящие" list with ID: ${incomingListId}`)
    } else {
        console.log('"Входящие" list not found by name, checking tasks with null list_id...')
    }

    // 2. Fetch the first task
    let query = supabase.from('tasks').select('*').is('parent_id', null)

    if (incomingListId) {
        query = query.eq('list_id', incomingListId)
    } else {
        query = query.is('list_id', null)
    }

    const { data: tasks, error: taskError } = await query
        .order('order_index', { ascending: true })
        .limit(1)

    if (taskError) {
        console.error('Error fetching tasks:', taskError)
        return
    }

    if (tasks && tasks.length > 0) {
        const task = tasks[0]
        console.log('\n--- FIRST TASK IN INCOMING ---')
        console.log('ID:', task.id)
        console.log('Title:', task.title)
        console.log('Description:', task.description)
        console.log('------------------------------\n')
    } else {
        console.log('No tasks found in "Входящие".')
        // Let's list all tasks to see what's there
        const { data: allTasks } = await supabase.from('tasks').select('title, list_id').limit(5)
        console.log('Sample tasks in DB:', allTasks)
    }
}

getIncomingTask()
