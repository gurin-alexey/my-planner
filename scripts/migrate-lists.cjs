require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase environment variables');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Applying lists migration...');
    const sql = fs.readFileSync(path.join(__dirname, '../migration_lists.sql'), 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error applying migration via RPC:', error);
        process.exit(1);
    }

    console.log('Migration successfully applied!');
}

migrate();
