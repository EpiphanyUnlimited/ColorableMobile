import { createClient } from '@supabase/supabase-js'

// Service role client for administrative operations (bypasses RLS)
// ONLY use this in secure server environments (Netlify Functions)
// NEVER expose this key to the browser

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase service role configuration!')
    console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
}

// Service role client bypasses Row Level Security
// Use ONLY for admin operations like webhook handling
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})
