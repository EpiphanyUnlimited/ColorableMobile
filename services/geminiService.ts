import { InferenceSession, Tensor, env as ortEnv } from 'onnxruntime-web';
import { Capacitor } from '@capacitor/core';

// Caches for the model and session so weight loading only happens once
let cachedSession: InferenceSession | null = null;
let cachedModelBuffer: ArrayBuffer | null = null;

// ONNX runtime wasm ships inside the app bundle (public/ort/) so
// inference works fully offline once the model is cached.
ortEnv.wasm.wasmPaths = '/ort/';

// Informative Drawings line-art model — BUNDLED in the app (public/models/),
// so transforms work fully offline with zero download wait
const ONNX_MODEL_URL = '/models/lineart.onnx';


// NOTE: The cloud Gemini fallback was removed from the Android build on
// purpose (Play Store release). All photo processing is on-device via ONNX;
// user photos must never leave the device. Do not re-add a network path
// here without updating the Play Data safety form and privacy policy.

/**
 * Downloads the ONNX model file and reports progress.
 * Caches the array buffer in memory/IndexedDB for future launches.
 */
export async function downloadLocalModel(onProgress: (percent: number) => void): Promise<ArrayBuffer> {
  if (cachedModelBuffer) {
    onProgress(100);
    return cachedModelBuffer;
  }

  // 1. Try Loading from Local IndexedDB Cache
  try {
    const db = await openModelDB();
    const storedBuffer = await getModelFromDB(db);
    if (storedBuffer) {
      console.log('✅ Local LineArt Model Loaded from IndexedDB Storage Cache!');
      cachedModelBuffer = storedBuffer;
      onProgress(100);
      return storedBuffer;
    }
  } catch (err) {
    console.warn('Could not read from IndexedDB, fetching from network instead:', err);
  }

  // 2. Fetch from Network/Play Asset CDN with detailed Progress monitoring
  console.log('🌐 Fetching on-demand ONNX line art model from:', ONNX_MODEL_URL);
  const response = await fetch(ONNX_MODEL_URL);
  if (!response.ok) {
    throw new Error(`Failed to download local edge detection model: ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
  
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('ReadableStream not supported on this device webview browser');
  }

  let receivedBytes = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedBytes += value.length;

    if (totalBytes > 0) {
      const percent = Math.round((receivedBytes / totalBytes) * 100);
      onProgress(percent);
    }
  }

  // Combine chunks into a single ArrayBuffer
  const combined = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const modelBuffer = combined.buffer;
  cachedModelBuffer = modelBuffer;

  // 3. Cache inside local IndexedDB to guarantee offline execution on next run
  try {
    const db = await openModelDB();
    await saveModelToDB(db, modelBuffer);
    console.log('💾 ONNX Local LineArt Model successfully cached in IndexedDB!');
  } catch (err) {
    console.error('Failed to cache model in local IndexedDB:', err);
  }

  return modelBuffer;
}

/**
 * Initializes the ONNX Runtime Web session.
 * Leverages WebGPU fallback to multithreaded WebAssembly depending on silicon capabilities.
 */
export async function initLocalSession(modelBuffer: ArrayBuffer): Promise<InferenceSession> {
  if (cachedSession) return cachedSession;

  // Android WebViews advertise WebGPU but Adreno GPU drivers segfault
  // compiling its compute shaders at first inference (native crash, kills the
  // process, uncatchable from JS) — so native builds go straight to CPU WASM.
  const allowWebGPU = !Capacitor.isNativePlatform();
  try {
    if (!allowWebGPU) throw new Error('WebGPU disabled on native platform');
    // Attempt WebGPU first for instant mobile hardware acceleration
    console.log('⚡ Initializing local ONNX Session with WebGPU acceleration...');
    cachedSession = await InferenceSession.create(modelBuffer, {
      executionProviders: ['webgpu']
    });
    console.log('🚀 ONNX model loaded with WebGPU successfully!');
  } catch (e) {
    console.log('⚠️ WebGPU not supported on this device. Falling back to multi-threaded CPU WASM...', e);
    cachedSession = await InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
      enableCpuMemArena: true,
      enableMemPattern: true
    });
    console.log('🚀 ONNX model loaded with CPU WASM successfully!');
  }

  return cachedSession;
}

/**
 * Processes an uploaded photo into line art — 100% ON-DEVICE.
 * The Android build never uploads user photos anywhere: if the local ONNX
 * pipeline fails, we surface a friendly error instead of falling back to
 * any cloud service. This keeps the Play Store "private & offline" promise
 * (and the Data safety declaration) literally true.
 */
export async function generateLocalColoringPage(base64Image: string): Promise<string> {
  try {
    return await runLocalOnnxPipeline(base64Image);
  } catch (err) {
    console.error('❌ On-device transform failed:', err);
    throw new Error(
      'The on-device AI could not process this photo. Please try a different photo, or restart the app to reload the AI model. (Your photo never leaves your device.)'
    );
  }
}

/**
 * The pure on-device path: preprocess image matrix -> local ONNX model ->
 * postprocess lines -> Base64 coloring page.
 */
async function runLocalOnnxPipeline(base64Image: string): Promise<string> {
  const modelBuffer = cachedModelBuffer || (await downloadLocalModel(() => {}));
  const session = cachedSession || (await initLocalSession(modelBuffer));

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = async () => {
      try {
        // Preserve the photo's aspect ratio at up to 768px on the long side
        // (dims rounded to /4 for the conv net). Fixed 512x512 squashing was
        // the main quality killer: distortion + lost detail.
        const MAX_SIDE = 768;
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const width = Math.max(64, Math.round((img.width * scale) / 4) * 4);
        const height = Math.max(64, Math.round((img.height * scale) / 4) * 4);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create local canvas context');

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);

        // Preprocess image to tensor format: [1, 3, H, W] Normalized
        const inputData = new Float32Array(3 * width * height);
        for (let i = 0; i < width * height; i++) {
          const r = imgData.data[i * 4];
          const g = imgData.data[i * 4 + 1];
          const b = imgData.data[i * 4 + 2];

          // Normalize [0, 255] to [0, 1] as required by Informative Drawings
          inputData[i] = r / 255;
          inputData[width * height + i] = g / 255;
          inputData[2 * width * height + i] = b / 255;
        }

        // NCHW: dims are [batch, channels, HEIGHT, WIDTH]
        const inputTensor = new Tensor('float32', inputData, [1, 3, height, width]);
        const feed: { [key: string]: Tensor } = {};
        const inputNames = session.inputNames;
        feed[inputNames[0]] = inputTensor;

        // Run the locally loaded ONNX segmenting weights
        const outputMap = await session.run(feed);
        const outputName = session.outputNames[0];
        const outputTensor = outputMap[outputName];
        const outputData = outputTensor.data as Float32Array;

        // Postprocess tensor back to black and white canvas pixel values.
        // Read dims from the tensor itself ([..., H, W]) so a layout mismatch
        // can never silently skew the image again.
        const outH = Number(outputTensor.dims[outputTensor.dims.length - 2]);
        const outW = Number(outputTensor.dims[outputTensor.dims.length - 1]);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) throw new Error('Could not create output canvas context');

        const outImgData = outCtx.createImageData(outW, outH);
        for (let i = 0; i < outW * outH; i++) {
          // Output is a 0..1 line map (1 = white paper, 0 = black ink).
          // Smoothstep ramp instead of a hard 1-bit threshold: lines stay
          // dark and paper white, but stroke edges keep anti-aliasing
          // (the hard cutoff produced jagged fax-like output).
          const x = outputData[i];
          let t = (x - 0.45) / (0.8 - 0.45);
          t = Math.max(0, Math.min(1, t));
          t = t * t * (3 - 2 * t);
          const pixelVal = Math.round(t * 255);

          outImgData.data[i * 4] = pixelVal;
          outImgData.data[i * 4 + 1] = pixelVal;
          outImgData.data[i * 4 + 2] = pixelVal;
          outImgData.data[i * 4 + 3] = 255; // Alpha opaque
        }

        outCtx.putImageData(outImgData, 0, 0);
        resolve(outCanvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error('Image failed to load in browser sandbox pipeline'));
  });
}

// ==========================================
// IndexedDB Engine for local model storage
// ==========================================
const DB_NAME = 'ColorableLocalModelDB';
const STORE_NAME = 'models';

function openModelDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getModelFromDB(db: IDBDatabase): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('weights');

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function saveModelToDB(db: IDBDatabase, buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(buffer, 'weights');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
