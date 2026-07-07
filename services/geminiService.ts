import { InferenceSession, Tensor } from 'onnxruntime-web';
import { API_BASE } from './apiConfig';

// Caches for the model and session so weight loading only happens once
let cachedSession: InferenceSession | null = null;
let cachedModelBuffer: ArrayBuffer | null = null;

const ONNX_MODEL_URL = 'https://models.colorableai.com/lineart_simple_quantized.onnx'; // CDN or Play Asset Directory target

// Same transform prompt the web app uses via the Gemini proxy
const PROMPT_TEMPLATE = `
Transform the provided portrait into a PURE black and white coloring book page.
STRICT RULE: Absolutely NO color. NO grayscale. NO shading. NO shadows. NO backgrounds.
CRITICAL: Maintain the exact facial features, expressions, and likeness of the person in the image.
Style Requirements:
- Use only clean, sharp, black outlines on a pure white background.
- High contrast line art.
- Large, clear empty areas for coloring.
- Do not add any color or artistic textures.
`;

/**
 * Cloud fallback: transforms the photo through the deployed Gemini proxy —
 * the same engine the web app uses. Engaged whenever the on-device ONNX
 * path is unavailable (model not yet published, download failure, WebView
 * without WASM/WebGPU support, inference error).
 */
export async function generateColoringPageViaCloud(base64Image: string): Promise<string> {
  const [header, data] = base64Image.split(',');
  const mimeType = header?.includes(':') ? header.split(';')[0].split(':')[1] : 'image/jpeg';

  const response = await fetch(`${API_BASE}/.netlify/functions/gemini-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: data ?? base64Image,
      mimeType,
      prompt: PROMPT_TEMPLATE,
      model: 'gemini-2.5-flash-image',
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({} as any));
    throw new Error(errData.error || `Cloud transform failed: ${response.statusText}`);
  }

  const result = await response.json();
  return `data:${result.mimeType || 'image/png'};base64,${result.image}`;
}

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

  try {
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
 * Processes an uploaded photo into line art — LOCAL-FIRST with cloud fallback.
 * Tries the on-device ONNX pipeline; if the model is unavailable or fails
 * (it is not yet published to the CDN), transparently falls back to the
 * deployed Gemini proxy so the app works today.
 */
export async function generateLocalColoringPage(base64Image: string): Promise<string> {
  try {
    return await runLocalOnnxPipeline(base64Image);
  } catch (err) {
    console.warn('⚠️ On-device transform unavailable, using cloud fallback:', err);
    return generateColoringPageViaCloud(base64Image);
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
        const width = 512;
        const height = 512;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create local canvas context');

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);

        // Preprocess image to tensor format: [1, 3, 512, 512] Normalized
        const inputData = new Float32Array(3 * width * height);
        for (let i = 0; i < width * height; i++) {
          const r = imgData.data[i * 4];
          const g = imgData.data[i * 4 + 1];
          const b = imgData.data[i * 4 + 2];

          // Normalize [0, 255] to [-1, 1] as required by LineArt Generative models
          inputData[i] = (r / 127.5) - 1.0;
          inputData[width * height + i] = (g / 127.5) - 1.0;
          inputData[2 * width * height + i] = (b / 127.5) - 1.0;
        }

        const inputTensor = new Tensor('float32', inputData, [1, 3, width, height]);
        const feed: { [key: string]: Tensor } = {};
        const inputNames = session.inputNames;
        feed[inputNames[0]] = inputTensor;

        // Run the locally loaded ONNX segmenting weights
        const outputMap = await session.run(feed);
        const outputName = session.outputNames[0];
        const outputTensor = outputMap[outputName];
        const outputData = outputTensor.data as Float32Array;

        // Postprocess tensor back to black and white canvas pixel values
        const outCanvas = document.createElement('canvas');
        outCanvas.width = width;
        outCanvas.height = height;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) throw new Error('Could not create output canvas context');

        const outImgData = outCtx.createImageData(width, height);
        for (let i = 0; i < width * height; i++) {
          // Normalize back to grayscale edge-strength line value
          const val = (outputData[i] + 1.0) * 127.5;
          const pixelVal = val > 128 ? 255 : 0; // High contrast PURE black outline / white fill thresholding

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
