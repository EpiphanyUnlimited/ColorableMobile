import { supabase } from '../src/lib/supabase';
import { getOrCreateDeviceId, getDeviceName } from '../utils/deviceFingerprint';
import { TIER_LIMITS } from '../utils/tierLimits';
import type { Tier } from '../types';

export interface Device {
    id: string;
    user_id: string;
    device_id: string;
    device_name: string | null;
    last_seen_at: string;
    created_at: string;
}

/**
 * Register or update the current device for a user
 */
export async function registerDevice(userId: string): Promise<void> {
    const deviceId = getOrCreateDeviceId();
    const deviceName = getDeviceName();

    const { error } = await supabase
        .from('user_devices')
        .upsert(
            {
                user_id: userId,
                device_id: deviceId,
                device_name: deviceName,
                last_seen_at: new Date().toISOString(),
            },
            {
                onConflict: 'user_id,device_id',
            }
        );

    if (error) {
        console.error('Failed to register device:', error);
        throw error;
    }
}

/**
 * Get the number of devices registered for a user
 */
export async function getDeviceCount(userId: string): Promise<number> {
    const { count, error } = await supabase
        .from('user_devices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to get device count:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Check if user can add another device based on their tier
 */
export async function canAddDevice(userId: string, tier: Tier): Promise<boolean> {
    const deviceCount = await getDeviceCount(userId);
    const maxDevices = TIER_LIMITS[tier].maxDevices;

    // Check if current device is already registered
    const currentDeviceId = getOrCreateDeviceId();
    const { data } = await supabase
        .from('user_devices')
        .select('device_id')
        .eq('user_id', userId)
        .eq('device_id', currentDeviceId)
        .single();

    // If current device is already registered, allow
    if (data) return true;

    // Otherwise check if we're under the limit
    return deviceCount < maxDevices;
}

/**
 * Get all devices for a user
 */
export async function getDevices(userId: string): Promise<Device[]> {
    const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', userId)
        .order('last_seen_at', { ascending: false });

    if (error) {
        console.error('Failed to get devices:', error);
        return [];
    }

    return (data as Device[]) || [];
}

/**
 * Remove a device for a user
 */
export async function removeDevice(userId: string, deviceId: string): Promise<void> {
    const { error } = await supabase
        .from('user_devices')
        .delete()
        .eq('user_id', userId)
        .eq('device_id', deviceId);

    if (error) {
        console.error('Failed to remove device:', error);
        throw error;
    }
}

/**
 * Check if current device is registered
 */
export async function isCurrentDeviceRegistered(userId: string): Promise<boolean> {
    const deviceId = getOrCreateDeviceId();

    const { data } = await supabase
        .from('user_devices')
        .select('device_id')
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .single();

    return !!data;
}
