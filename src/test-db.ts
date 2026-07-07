import 'dotenv/config'
import { supabase } from './lib/supabase'

async function testConnection() {
    console.log('🔍 Testing Supabase connection...')
    console.log('📍 URL:', process.env.VITE_SUPABASE_URL)
    console.log('🔑 Key (first 20 chars):', process.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...')

    // Test 1: Check connection
    const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)

    if (error) {
        console.error('❌ Database connection failed:', error.message)
        console.error('Full error:', error)
    } else {
        console.log('✅ Database connected successfully!')
        console.log('📊 Query result:', data)
    }
}

testConnection().catch(err => {
    console.error('❌ Test failed:', err)
    process.exit(1)
})