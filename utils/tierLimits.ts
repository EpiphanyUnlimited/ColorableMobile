import type { Tier } from '../types';

/**
 * Tier limits configuration
 */
export const TIER_LIMITS = {
    free: {
        maxPagesPerBook: 10,
        maxDownloadsPerMonth: 10,
        maxDevices: 1,
        hasTrial: false,
        trialDays: 0,
        features: {
            imageConversion: true,
            textOverlay: false,
            scenarioRemix: false,
            customFonts: 0,
            coverTemplates: 1,
        },
    },
    plus: {
        maxPagesPerBook: 20,
        maxDownloadsPerMonth: Infinity, // Unlimited
        maxDevices: 3,
        hasTrial: false,
        trialDays: 0,
        features: {
            imageConversion: true,
            textOverlay: true,
            scenarioRemix: false,
            customFonts: 1,
            coverTemplates: 1,
        },
    },
    ultimate: {
        maxPagesPerBook: 30,
        maxDownloadsPerMonth: Infinity, // Unlimited
        maxDevices: 5,
        hasTrial: true,
        trialDays: 3,
        features: {
            imageConversion: true,
            textOverlay: true,
            scenarioRemix: true,
            customFonts: 5,
            coverTemplates: 5,
        },
    },
} as const;

/**
 * Check if user can add another page to their book
 */
export function canAddPage(tier: Tier, currentPageCount: number): boolean {
    return currentPageCount < TIER_LIMITS[tier].maxPagesPerBook;
}

/**
 * Check if user can download
 */
export function canDownload(tier: Tier, downloadsThisMonth: number): boolean {
    return downloadsThisMonth < TIER_LIMITS[tier].maxDownloadsPerMonth;
}

/**
 * Check if user can use a specific feature
 */
export function canUseFeature(tier: Tier, feature: keyof typeof TIER_LIMITS.free.features): boolean {
    return TIER_LIMITS[tier].features[feature] as boolean;
}

/**
 * Get the maximum pages allowed for a tier
 */
export function getMaxPages(tier: Tier): number {
    return TIER_LIMITS[tier].maxPagesPerBook;
}

/**
 * Get the maximum downloads allowed for a tier
 */
export function getMaxDownloads(tier: Tier): number | 'Unlimited' {
    const limit = TIER_LIMITS[tier].maxDownloadsPerMonth;
    return limit === Infinity ? 'Unlimited' : limit;
}

/**
 * Get remaining pages available
 */
export function getRemainingPages(tier: Tier, currentPageCount: number): number {
    return Math.max(0, TIER_LIMITS[tier].maxPagesPerBook - currentPageCount);
}

/**
 * Get remaining downloads available
 */
export function getRemainingDownloads(tier: Tier, downloadsThisMonth: number): number | 'Unlimited' {
    const limit = TIER_LIMITS[tier].maxDownloadsPerMonth;
    if (limit === Infinity) return 'Unlimited';
    return Math.max(0, limit - downloadsThisMonth);
}

/**
 * Get suggested upgrade tier based on current usage
 */
export function getSuggestedUpgrade(tier: Tier, currentPageCount: number): Tier | null {
    if (tier === 'ultimate') return null;

    if (tier === 'free' && currentPageCount >= TIER_LIMITS.free.maxPagesPerBook) {
        return 'plus';
    }

    if (tier === 'plus' && currentPageCount >= TIER_LIMITS.plus.maxPagesPerBook) {
        return 'ultimate';
    }

    return null;
}
