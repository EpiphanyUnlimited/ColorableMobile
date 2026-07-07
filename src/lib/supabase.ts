import { createClient } from '@supabase/supabase-js'

// Supabase configuration
// Works in both Vite (import.meta.env) and Node.js (process.env)
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || process.env.VITE_SUPABASE_ANON_KEY

// Debug logging
console.log('🔧 Supabase Configuration:')
console.log('  Environment:', typeof import.meta !== 'undefined' ? 'Browser (Vite)' : 'Node.js')
console.log('  URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '❌ MISSING')
console.log('  Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : '❌ MISSING')

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables!')
    console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing')
    console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Missing')

    if (typeof import.meta !== 'undefined') {
        console.error('Available env vars:', Object.keys(import.meta.env || {}))
    }

    console.error('⚠️ App will use placeholder values - authentication will NOT work!')
    console.error('👉 Please set environment variables in Netlify: Site settings → Environment variables')
}

// Validate URL format if provided
if (supabaseUrl) {
    try {
        new URL(supabaseUrl)
    } catch (e) {
        console.error(`⚠️ Invalid Supabase URL format: ${supabaseUrl}`)
    }
}

// Create Supabase client with fallback to prevent blank screen
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
    })

// ============================================
// TypeScript Database Types
// ============================================

export interface Profile {
    id: string
    email: string
    display_name: string | null
    tier: 'free' | 'plus' | 'ultimate'
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    subscription_status: string | null
    pdf_downloads_this_month: number
    device_limit: number
    current_period_start: string | null
    current_period_end: string | null
    cancel_at_period_end: boolean
    created_at: string
    updated_at: string
}

export interface DeviceInfo {
    id: string
    user_id: string
    device_id: string
    device_name: string
    last_active: string
    created_at: string
}

export interface Image {
    id: string
    project_id: string
    user_id: string
    name: string
    original_storage_path: string
    coloring_storage_path: string | null
    status: 'idle' | 'processing' | 'done' | 'error' | 'remixing'
    error_detail: string | null
    retry_count: number
    overlay_text: string | null
    overlay_position: 'top' | 'bottom'
    created_at: string
    updated_at: string
}

export interface Subscription {
    id: string
    user_id: string
    stripe_subscription_id: string
    stripe_price_id: string
    tier: 'plus' | 'ultimate'
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
    current_period_start: string
    current_period_end: string
    cancel_at_period_end: boolean
    created_at: string
    updated_at: string
}

// ============================================
// Database Helper Functions
// ============================================

/**
 * Get user profile from database
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (error) {
        console.error('Error fetching user profile:', error)
        return null
    }

    return data
}

/**
 * Update user profile
 */
export async function updateUserProfile(
    userId: string,
    updates: Partial<Profile>
): Promise<boolean> {
    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)

    if (error) {
        console.error('Error updating user profile:', error)
        return false
    }

    return true
}

/**
 * Get user's active devices
 */
export async function getUserDevices(userId: string): Promise<DeviceInfo[]> {
    const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', userId)
        .order('last_active', { ascending: false })

    if (error) {
        console.error('Error fetching devices:', error)
        return []
    }

    return data || []
}

/**
 * Register or update device
 */
export async function registerDevice(
    userId: string,
    deviceId: string,
    deviceName: string
): Promise<boolean> {
    const { error } = await supabase
        .from('devices')
        .upsert({
            user_id: userId,
            device_id: deviceId,
            device_name: deviceName,
            last_active: new Date().toISOString()
        })

    if (error) {
        console.error('Error registering device:', error)
        return false
    }

    return true
}

// ============================================
// Storage Helper Functions
// ============================================

/**
 * Upload image to Supabase Storage
 */
export async function uploadImage(
    userId: string,
    file: File,
    type: 'original' | 'coloring'
): Promise<string | null> {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${type}/${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
        .from(type === 'original' ? 'user-images' : 'generated-images')
        .upload(fileName, file)

    if (error) {
        console.error('Error uploading image:', error)
        return null
    }

    return data.path
}

/**
 * Get signed URL for an image (temporary public URL)
 */
export async function getImageUrl(
    bucket: 'user-images' | 'generated-images',
    path: string,
    expiresIn: number = 3600 // 1 hour
): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn)

    if (error) {
        console.error('Error getting signed URL:', error)
        return null
    }

    return data.signedUrl
}

/**
 * Delete image from storage
 */
export async function deleteImage(
    bucket: 'user-images' | 'generated-images',
    path: string
): Promise<boolean> {
    const { error } = await supabase.storage
        .from(bucket)
        .remove([path])

    if (error) {
        console.error('Error deleting image:', error)
        return false
    }

    return true
}
