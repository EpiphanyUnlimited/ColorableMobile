
const DB_NAME = 'MagicColoringBookDB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

interface LocalImage {
    id: string;
    originalBlob: Blob;
    coloringBlob?: Blob;
    name: string;
    status: 'idle' | 'processing' | 'remixing' | 'done' | 'error';
    overlay?: { text: string; position: 'top' | 'bottom' };
    createdAt: number;
}

// One IndexedDB database per signed-in user so accounts never see each other's images
export const initDB = (userId: string): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(`${DB_NAME}_${userId}`, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveImageToLocal = async (userId: string, img: any) => { // Using any for compatibility with App.tsx types temporarily
    const db = await initDB(userId);
    return new Promise<void>(async (resolve, reject) => {
        try {
            // Convert URLs to Blobs for storage if they aren't already
            let originalBlob: Blob;
            let coloringBlob: Blob | undefined;

            if (img.originalUrl) {
                const resp = await fetch(img.originalUrl);
                originalBlob = await resp.blob();
            } else {
                // Fallback or skip
                return resolve();
            }

            if (img.coloringUrl) {
                const resp = await fetch(img.coloringUrl);
                coloringBlob = await resp.blob();
            }

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            const record: LocalImage = {
                id: img.id,
                originalBlob: originalBlob,
                coloringBlob: coloringBlob,
                name: img.name,
                status: img.status,
                overlay: img.overlay,
                createdAt: Date.now()
            };

            const req = store.put(record);

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        } catch (e) {
            console.error("Error saving to IndexedDB", e);
            reject(e);
        }
    });
};

export const loadAllImagesFromLocal = async (userId: string): Promise<any[]> => {
    const db = await initDB(userId);
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const records = request.result as LocalImage[];
            // Convert Blobs back to ObjectURLs for the app
            const appImages = records.map(rec => ({
                id: rec.id,
                originalUrl: URL.createObjectURL(rec.originalBlob),
                coloringUrl: rec.coloringBlob ? URL.createObjectURL(rec.coloringBlob) : undefined,
                status: rec.status,
                name: rec.name,
                overlay: rec.overlay
            }));
            // Sort by newest first
            resolve(appImages.reverse());
        };
        request.onerror = () => reject(request.error);
    });
};

export const deleteLocalImage = async (userId: string, id: string) => {
    const db = await initDB(userId);
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export const updateLocalImage = async (userId: string, img: any) => {
    const db = await initDB(userId);
    return new Promise<void>(async (resolve, reject) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            // get existing record first to preserve createdAt and other fields
            const getReq = store.get(img.id);

            getReq.onsuccess = async () => {
                const existingRecord = getReq.result as LocalImage;
                if (!existingRecord) {
                    reject(new Error(`Image with id ${img.id} not found`));
                    return;
                }

                // Prepare updates
                let coloringBlob = existingRecord.coloringBlob;
                if (img.coloringUrl) {
                    // specific check to avoid fetching if it's already a blob url from the same session, 
                    // but here we need to persist it, so we fetch it to get a fresh blob
                    const resp = await fetch(img.coloringUrl);
                    coloringBlob = await resp.blob();
                }

                const updatedRecord: LocalImage = {
                    ...existingRecord,
                    name: img.name || existingRecord.name,
                    status: img.status || existingRecord.status,
                    overlay: img.overlay || existingRecord.overlay,
                    coloringBlob: coloringBlob
                };

                const putReq = store.put(updatedRecord);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);

        } catch (e) {
            console.error("Error updating IndexedDB", e);
            reject(e);
        }
    });
};
