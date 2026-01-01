import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ijbhaxxuctkhckuvoqrr.supabase.co'
const supabaseKey = 'sb_publishable_xb8zbTbAaEVPvmJlBWHDRg_uKNyHg-r'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    const { data: lists, error: listsError } = await supabase.from('lists').select('*').limit(1)
    const { data: folders, error: foldersError } = await supabase.from('folders').select('*').limit(1)

    if (lists && lists.length > 0) console.log('Lists columns:', Object.keys(lists[0]))
    if (folders && folders.length > 0) console.log('Folders columns:', Object.keys(folders[0]))
}

checkSchema()
