require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function fix() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Disabling RLS...');
    const sql = fs.readFileSync(path.join(__dirname, '../fix_rls.sql'), 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error applying fix:', error);
        process.exit(1);
    }

    console.log('RLS disabled successfully!');
}

fix();
