import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ijbhaxxuctkhckuvoqrr.supabase.co'
const supabaseKey = 'sb_publishable_xb8zbTbAaEVPvmJlBWHDRg_uKNyHg-r'

export const supabase = createClient(supabaseUrl, supabaseKey)