/**
 * Device fingerprinting utility for tracking unique devices
 * Uses lightweight browser characteristics to generate a unique ID
 */

export function generateDeviceId(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Gather device characteristics
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage,
        !!window.localStorage,
    ];

    // Add canvas fingerprint (lightweight)
    if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('fingerprint', 2, 2);
        components.push(canvas.toDataURL());
    }

    // Simple hash function
    const str = components.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
}

export function getDeviceName(): string {
    const ua = navigator.userAgent;

    // Detect device type
    if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone/iPad';
    if (/Android/.test(ua)) return 'Android Device';
    if (/Windows/.test(ua)) return 'Windows PC';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'Linux Device';

    return 'Unknown Device';
}

export function getStoredDeviceId(): string | null {
    return localStorage.getItem('colorable_device_id');
}

export function storeDeviceId(deviceId: string): void {
    localStorage.setItem('colorable_device_id', deviceId);
}

export function getOrCreateDeviceId(): string {
    let deviceId = getStoredDeviceId();

    if (!deviceId) {
        deviceId = generateDeviceId();
        storeDeviceId(deviceId);
    }

    return deviceId;
}
