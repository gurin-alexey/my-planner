import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ijbhaxxuctkhckuvoqrr.supabase.co'
const supabaseKey = 'sb_publishable_xb8zbTbAaEVPvmJlBWHDRg_uKNyHg-r'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data, error } = await supabase.from('folders').select('count')
    if (error) {
        console.error('Test failed:', error)
    } else {
        console.log('Test successful, folders count:', data)
    }
}

test()
