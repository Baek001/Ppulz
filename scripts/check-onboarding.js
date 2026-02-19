const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOnboarding() {
    const { data, error } = await supabase
        .from('user_onboarding')
        .select('*');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('User Onboarding Data:', JSON.stringify(data, null, 2));
    }
}

checkOnboarding();
