/**
 * Local Storage Utilities for Image Persistence
 * 
 * PRIVACY: All data stays in the browser's localStorage - never sent to any server.
 * This ensures compliance with the privacy policy.
 * 
 * STRATEGY: Save ONE completed image at a time (not batch saves).
 * Only save coloringUrl (the result), not original images.
 */

const STORAGE_KEY = 'coloringbook_completed_images';

export interface StoredImage {
    id: string;
    name: string;
    coloringUrl: string; // Only save completed images with coloringUrl
    createdAt: string;
    overlayText?: string;
    overlayPosition?: 'top' | 'bottom';
}

/**
 * Check available localStorage space
 */
function getAvailableSpace(): number {
    try {
        // Estimate: localStorage limit is typically 5-10MB
        // Check how much we're using
        let totalSize = 0;
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
            }
        }
        // Assume 5MB limit (conservative)
        const limit = 5 * 1024 * 1024;
        return Math.max(0, limit - totalSize);
    } catch {
        return 0;
    }
}

/**
 * Get all saved completed images from localStorage
 */
export function getLocalImages(): StoredImage[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const images = JSON.parse(stored);
        // Filter out any invalid entries
        return images.filter((img: StoredImage) => img.id && img.coloringUrl);
    } catch (error) {
        console.error('Failed to load images from localStorage:', error);
        return [];
    }
}

/**
 * Save a SINGLE completed image to localStorage
 * Only call this when an image finishes processing successfully
 */
export function saveCompletedImage(
    id: string,
    name: string,
    coloringUrl: string,
    overlayText?: string,
    overlayPosition?: 'top' | 'bottom'
): boolean {
    try {
        // Don't save if coloringUrl is missing or not base64
        if (!coloringUrl || !coloringUrl.startsWith('data:')) {
            console.warn('⚠️ Skipping save - invalid coloringUrl');
            return false;
        }

        const images = getLocalImages();

        // Check if this image already exists
        const existingIndex = images.findIndex(img => img.id === id);

        const newImage: StoredImage = {
            id,
            name,
            coloringUrl,
            createdAt: new Date().toISOString(),
            overlayText,
            overlayPosition
        };

        if (existingIndex >= 0) {
            images[existingIndex] = newImage;
        } else {
            images.push(newImage);
        }

        // Try to save
        const jsonData = JSON.stringify(images);

        // Check size before saving (rough estimate)
        const estimatedSize = jsonData.length * 2; // UTF-16
        const available = getAvailableSpace();

        if (estimatedSize > available + 100000) { // Allow some buffer
            console.warn('⚠️ Storage nearly full, removing oldest image...');
            // Remove oldest image to make room
            if (images.length > 1) {
                images.shift();
            }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
        console.log('✅ Saved completed image to localStorage:', id);
        return true;
    } catch (error: any) {
        // Handle quota exceeded specifically
        if (error.name === 'QuotaExceededError' ||
            error.message?.includes('quota') ||
            error.code === 22) {
            console.warn('⚠️ localStorage quota exceeded, clearing old images...');
            try {
                // Remove oldest images until we can save
                const images = getLocalImages();
                while (images.length > 0) {
                    images.shift(); // Remove oldest
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
                        console.log('✅ Cleared space, now have', images.length, 'images');
                        return false; // Return false since we didn't save the new one
                    } catch {
                        // Still not enough, keep removing
                    }
                }
                // Last resort: clear everything
                localStorage.removeItem(STORAGE_KEY);
                console.log('⚠️ Cleared all localStorage images due to quota');
            } catch (clearError) {
                console.error('Failed to clear localStorage:', clearError);
            }
        } else {
            console.error('Failed to save image to localStorage:', error);
        }
        return false;
    }
}

/**
 * Update an existing stored image (e.g., after adding text overlay)
 */
export function updateStoredImage(
    imageId: string,
    updates: Partial<Pick<StoredImage, 'coloringUrl' | 'overlayText' | 'overlayPosition'>>
): boolean {
    try {
        const images = getLocalImages();
        const index = images.findIndex(img => img.id === imageId);

        if (index < 0) {
            console.warn('Image not found in localStorage:', imageId);
            return false;
        }

        images[index] = { ...images[index], ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
        console.log('✅ Updated stored image:', imageId);
        return true;
    } catch (error: any) {
        if (error.name === 'QuotaExceededError') {
            console.warn('⚠️ Could not update - quota exceeded');
        } else {
            console.error('Failed to update image in localStorage:', error);
        }
        return false;
    }
}

/**
 * Delete image from localStorage
 */
export function deleteStoredImage(imageId: string): boolean {
    try {
        const images = getLocalImages();
        const filtered = images.filter(img => img.id !== imageId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        console.log('✅ Deleted stored image:', imageId);
        return true;
    } catch (error) {
        console.error('Failed to delete image from localStorage:', error);
        return false;
    }
}

/**
 * Clear all saved images from localStorage
 */
export function clearAllStoredImages(): boolean {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log('✅ All stored images cleared');
        return true;
    } catch (error) {
        console.error('Failed to clear localStorage:', error);
        return false;
    }
}

/**
 * Get storage info for debugging
 */
export function getStorageInfo(): { imageCount: number; estimatedSizeKB: number } {
    try {
        const stored = localStorage.getItem(STORAGE_KEY) || '[]';
        const images = JSON.parse(stored);
        return {
            imageCount: images.length,
            estimatedSizeKB: Math.round(stored.length / 1024)
        };
    } catch {
        return { imageCount: 0, estimatedSizeKB: 0 };
    }
}
