import { useEffect, useState } from 'react'
import { supabase, type Profile } from '../lib/supabase'
import { clearAllStoredImages } from '../lib/localStorage'
import { API_BASE } from '../../services/apiConfig'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthContextType {
    user: User | null
    profile: Profile | null
    session: Session | null
    loading: boolean
    signUp: (email: string, password: string, metadata: { display_name: string; tier: string }) => Promise<{ data: { user: User | null; session: Session | null } | null; error: Error | null }>
    signIn: (email: string, password: string) => Promise<{ data: { user: User | null; session: Session | null } | null; error: Error | null }>
    signOut: () => Promise<void>
    deleteAccount: () => Promise<{ error: Error | null }>
    updateProfile: (updates: Partial<Profile>) => Promise<void>
}

/**
 * Custom hook for authentication
 * Manages user session, profile, and auth operations
 */
export function useAuth(): AuthContextType {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoadingInternal] = useState(true)

    // Wrapper to log loading state changes
    const setLoading = (value: boolean | ((prev: boolean) => boolean)) => {
        const newValue = typeof value === 'function' ? value(loading) : value;
        console.log(`🔄 Loading state changing: ${loading} → ${newValue}`);
        setLoadingInternal(newValue);
    };

    useEffect(() => {
        console.log('🚀 useAuth hook initializing...');

        // Safety timeout to prevent infinite loading
        const safetyTimer = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.warn('⏰ Auth loading forced completion via timeout');
                    return false;
                }
                return prev;
            });
        }, 5000);

        // Get initial session
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                console.log('📱 Initial session check:', session ? 'Session found' : 'No session')
                setSession(session)
                setUser(session?.user ?? null)

                if (session?.user) {
                    console.log('👤 User found in initial session, loading profile...');
                    loadProfile(session.user.id)
                } else {
                    console.log('👤 No user in initial session, setting loading=false');
                    setLoading(false)
                }
            })
            .catch((error) => {
                console.error('❌ Failed to get initial session:', error)
                setLoading(false)
            })

        // Listen for auth state changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔔 Auth state change event:', event);
            console.log('  Session:', session ? 'Present' : 'Null');
            console.log('  User:', session?.user ? session.user.email : 'None');

            setSession(session)
            setUser(session?.user ?? null)

            if (session?.user) {
                console.log('👤 User present in auth state change, loading profile...');
                await loadProfile(session.user.id)
            } else {
                console.log('👤 No user in auth state change, clearing profile and setting loading=false');
                setProfile(null)
                setLoading(false)
            }
        })

        return () => {
            console.log('🧹 Cleaning up useAuth hook');
            subscription.unsubscribe()
            clearTimeout(safetyTimer)
        }
    }, [])

    /**
     * Load user profile from database
     * Includes self-healing logic if profile is missing
     */
    const loadProfile = async (userId: string) => {
        console.log('Loading profile for:', userId);

        // Prevent multiple simultaneous profile loads
        if ((loadProfile as any).isLoading) {
            console.log('⏭️ Profile load already in progress, skipping...');
            return;
        }
        (loadProfile as any).isLoading = true;

        // 1. OPTIMISTIC LOAD: Check cache first
        // This prevents "flicker" to free tier or landing page on slow connections
        const cacheKey = `colorable_profile_cache_${userId}`;
        const cachedProfile = localStorage.getItem(cacheKey);

        if (cachedProfile) {
            try {
                const parsed = JSON.parse(cachedProfile);
                console.log('⚡ Loaded profile from local cache (Optimistic UI)');
                setProfile(parsed);
            } catch (e) {
                console.warn('Failed to parse cached profile:', e);
            }
        }

        // Retry logic parameters
        const MAX_RETRIES = 3;
        const INITIAL_TIMEOUT = 15000; // 15s initial timeout

        let data: any = null;
        let error: any = null;
        let attempt = 0;
        let lastError: any = null;

        try {
            while (attempt < MAX_RETRIES) {
                try {
                    attempt++;
                    const timeoutDuration = INITIAL_TIMEOUT * attempt; // Increase timeout on each retry (15s, 30s, 45s)

                    // Add timeout to prevent hanging
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error(`Profile query timeout after ${timeoutDuration / 1000} seconds`)), timeoutDuration);
                    });

                    const queryPromise = supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', userId)
                        .single();

                    console.log(`📡 Executing profile query (Attempt ${attempt}/${MAX_RETRIES})...`);
                    const result: any = await Promise.race([queryPromise, timeoutPromise]);

                    data = result.data;
                    error = result.error;

                    // If successful or specific "Not Found" error (which we handle), break loop
                    if (!error || error.code === 'PGRST116') {
                        break;
                    }

                    // If it's a 5xx error or connection error, throw to trigger retry
                    if (error.code && (error.code.startsWith('5') || error.message.includes('fetch'))) {
                        throw error;
                    }

                    // For other errors (authorization, bad request), don't retry, just accept fate
                    break;

                } catch (err: any) {
                    console.warn(`⚠️ Profile load attempt ${attempt} failed:`, err.message);
                    lastError = err;

                    if (attempt >= MAX_RETRIES) break;

                    // Wait before retrying (exponential backoff: 1s, 2s, 4s)
                    const delay = 1000 * Math.pow(2, attempt - 1);
                    console.log(`⏳ Waiting ${delay}ms before retry...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
            console.log('📬 Profile query response received');

            // Surface exceptions from the retry loop (timeouts, network
            // failures) so the offline-cache fallback below can engage —
            // previously these were swallowed and never reached recovery.
            if (!error && !data && lastError) {
                error = lastError;
            }

            if (error) {
                console.warn('⚠️ Profile load error:', error);

                // If we have a cached profile and the network failed, KEEP the cached profile
                // Do NOT setProfile(null) which would revert user to free tier
                if (cachedProfile && !error.code?.startsWith('PGRST116')) {
                    console.log('🛡️ Network failed but cache exists. Keeping cached profile (Offline Mode).');
                    setLoading(false);
                    (loadProfile as any).isLoading = false;
                    return;
                }
                console.warn('  Error code:', error.code);
                console.warn('  Error message:', error.message);
                console.warn('  Error details:', error.details);

                // If profile not found (PGRST116), attempt to create it automatically
                if (error.code === 'PGRST116') {
                    console.log('🔧 Profile missing (PGRST116), attempting self-healing...');
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        // IMPORTANT: First check if profile already exists (race condition)
                        // This prevents overwriting an existing profile's tier with 'free'
                        const { data: existingProfile } = await supabase
                            .from('profiles')
                            .select('tier')
                            .eq('id', user.id)
                            .maybeSingle();

                        // If profile already exists, use that tier; otherwise use user metadata tier;
                        // NEVER default to 'free' as this can downgrade paying users
                        const existingTier = existingProfile?.tier || user.user_metadata?.tier;

                        // If no tier found at all, we cannot safely create a profile
                        // This prevents accidentally downgrading users
                        if (!existingTier) {
                            console.warn('⚠️ Cannot determine user tier, skipping profile creation to prevent downgrade');
                            setProfile(null);
                            setLoading(false);
                            (loadProfile as any).isLoading = false;
                            return;
                        }

                        const newProfile = {
                            id: user.id,
                            email: user.email!, // Assert non-null as auth requires email
                            display_name: user.user_metadata?.display_name || (user.email ? user.email.split('@')[0] : 'User'),
                            tier: existingTier,
                            terms_accepted_at: new Date().toISOString(),
                            privacy_accepted_at: new Date().toISOString()
                        };

                        console.log('📝 Creating fallback profile:', newProfile);
                        // Attempt fallback insert
                        const { data: insertedData, error: insertError } = await supabase
                            .from('profiles')
                            .insert(newProfile)
                            .select()
                            .single();

                        if (!insertError && insertedData) {
                            console.log('✅ Self-healing successful, profile created.');
                            setProfile(insertedData);
                            // Update cache
                            localStorage.setItem(cacheKey, JSON.stringify(insertedData));

                            setLoading(false);
                            (loadProfile as any).isLoading = false;
                            return;
                        } else {
                            console.error('❌ Error creating fallback profile:', insertError);
                            // Even if profile creation fails, we should still set loading to false
                            // The user can use the app with limited functionality
                            if (!cachedProfile) setProfile(null);
                            setLoading(false);
                            (loadProfile as any).isLoading = false;
                            return;
                        }
                    }
                }
                // For other errors, log but don't block the user
                console.error('❌ Profile error (non-blocking):', error);
                setProfile(null);
                setLoading(false);
                (loadProfile as any).isLoading = false;
                return;
            }

            console.log('✅ Profile loaded successfully:', data);
            setProfile(data);
            // Update cache with fresh data
            localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (error) {
            console.error('❌ Error loading profile:', error)
            // If critical error but we have cache, keep cache
            if (cachedProfile) {
                console.log('🛡️ Critical error but cache exists. Keeping cached profile.');
            } else {
                setProfile(null);
            }
        } finally {
            console.log('🏁 Auth loading sequence complete');
            setLoading(false)
                ; (loadProfile as any).isLoading = false;
        }
    }

    /**
     * Sign up new user
     */
    const signUp = async (
        email: string,
        password: string,
        metadata: { display_name: string; tier: string }
    ): Promise<{ data: { user: User | null; session: Session | null } | null; error: Error | null }> => {
        try {
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: metadata
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error('Failed to create user')

            return { data: authData, error: null }
        } catch (error) {
            return { data: null, error: error as Error }
        }
    }

    /**
     * Sign in existing user
     */
    const signIn = async (
        email: string,
        password: string
    ): Promise<{ data: { user: User | null; session: Session | null } | null; error: Error | null }> => {
        try {
            console.log('🔐 Attempting sign in for:', email)
            console.log('📡 Calling Supabase auth.signInWithPassword...')

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            console.log('📬 Supabase response received')
            console.log('  Data:', data ? 'Present' : 'Null')
            console.log('  Error:', error ? error.message : 'None')
            console.log('  User:', data?.user ? 'Present' : 'Null')
            console.log('  Session:', data?.session ? 'Present' : 'Null')

            if (error) {
                console.error('❌ Supabase auth error:', error)
                throw error
            }

            if (!data?.session) {
                console.warn('⚠️ No session returned from Supabase')
            }

            console.log('✅ Sign in successful')
            return { data, error: null }
        } catch (error) {
            console.error('❌ Sign in failed:', error)

            // Provide more helpful error messages
            if (error instanceof TypeError && error.message.includes('fetch')) {
                const networkError = new Error('Network error: Unable to connect to authentication server. Please check your internet connection and try again.')
                return { data: null, error: networkError }
            }

            return { data: null, error: error as Error }
        }
    }

    /**
     * Sign out current user
     */
    const signOut = async (): Promise<void> => {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setSession(null)
    }

    /**
     * Permanently delete the current user's account.
     *
     * Required by Google Play's account-deletion policy. The actual deletion
     * runs server-side (Netlify function with the Supabase service-role key,
     * see netlify-web-function/delete-account.mjs) after verifying the
     * caller's own JWT — the anon key in this app can never delete users.
     * On success, all locally stored artwork is wiped and the session ends.
     */
    const deleteAccount = async (): Promise<{ error: Error | null }> => {
        if (!session?.access_token) {
            return { error: new Error('No active session. Please sign in again, then retry.') }
        }
        try {
            const res = await fetch(`${API_BASE}/.netlify/functions/delete-account`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({} as any))
                throw new Error(body?.error || `Account deletion failed (HTTP ${res.status}). Please try again or email us.`)
            }

            // Server-side account is gone — wipe local artwork and end the session.
            try { if (user?.id) clearAllStoredImages(user.id) } catch { /* non-fatal */ }
            try { await supabase.auth.signOut() } catch { /* user no longer exists — expected */ }
            setUser(null)
            setProfile(null)
            setSession(null)
            return { error: null }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            // fetch() network failures surface as unhelpful "Failed to fetch"
            const friendly = /fetch|network|load failed/i.test(msg)
                ? 'Could not reach the server. Account deletion requires an internet connection — please check your connection and try again.'
                : msg
            return { error: new Error(friendly) }
        }
    }

    /**
     * Update user profile
     */
    const updateProfile = async (updates: Partial<Profile>): Promise<void> => {
        if (!user) return

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)

        if (!error && profile) {
            setProfile({ ...profile, ...updates })
        }
    }

    return {
        user,
        profile,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        deleteAccount,
        updateProfile,
    }
}
