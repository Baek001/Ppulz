const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReferences() {
    console.log('Checking recent analysis...');

    // Fetch last 5 items
    const { data, error } = await supabase
        .from('hourly_analysis')
        .select('*')
        .order('analyzed_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    console.log('Recent items:', data.length);
    if (data.length > 0) {
        data.forEach(item => {
            console.log(`\nID: ${item.id}`);
            console.log(`Sub: ${item.sub_category} (${item.country})`);
            console.log(`Score: ${item.score}`);
            console.log(`References: ${JSON.stringify(item.references || 'NULL', null, 2)}`);
        });
    } else {
        console.log('No data found.');
    }
}

checkReferences();
