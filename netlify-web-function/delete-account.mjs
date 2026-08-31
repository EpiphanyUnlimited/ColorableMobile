/**
 * delete-account — Netlify Function for colorableai.netlify.app
 *
 * Permanently deletes the calling user's Supabase account (Google Play
 * account-deletion requirement). The caller proves their identity with
 * their own JWT; the deletion itself uses the service-role key, which
 * only ever lives in Netlify's environment — never in the app.
 *
 * DEPLOY (one-time):
 *   1. Copy this file into your WEB SITE repo at: netlify/functions/delete-account.mjs
 *   2. In Netlify → Site settings → Environment variables, add:
 *        SUPABASE_URL               = https://YOUR-PROJECT.supabase.co   (or reuse VITE_SUPABASE_URL)
 *        SUPABASE_SERVICE_ROLE_KEY  = <service_role key from Supabase → Settings → API>
 *      ⚠ The service_role key bypasses RLS. Never expose it client-side.
 *   3. Ensure @supabase/supabase-js is in that repo's package.json dependencies.
 *   4. Deploy. Test with an expendable account before submitting to Play.
 */
import { createClient } from '@supabase/supabase-js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { ...CORS, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const authHeader = event.headers.authorization || event.headers.Authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: 'Missing bearer token' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('delete-account: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars')
    return json(500, { error: 'Server is not configured for account deletion' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) Verify the JWT actually belongs to a live user — the caller can
  //    only ever delete themselves.
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  const user = userData?.user
  if (userError || !user) return json(401, { error: 'Invalid or expired session' })

  // 2) Remove the profile row first (ignore errors — the table may not
  //    exist or may cascade automatically via FK).
  try {
    await admin.from('profiles').delete().eq('id', user.id)
  } catch (e) {
    console.warn('delete-account: profiles cleanup skipped:', e?.message)
  }

  // 3) Delete the auth user itself.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('delete-account: deleteUser failed:', deleteError.message)
    return json(500, { error: 'Deletion failed — please try again or contact support' })
  }

  console.log(`delete-account: deleted user ${user.id} (${user.email})`)
  return json(200, { ok: true })
}
