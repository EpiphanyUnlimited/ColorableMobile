/**
 * Base URL of the deployed Colorable web backend (Netlify functions).
 *
 * Inside Capacitor, relative "/.netlify/..." URLs resolve against the
 * local WebView origin (https://localhost) — NOT the deployed site — so
 * every backend call from the app must be absolute.
 */
export const API_BASE = 'https://colorableai.netlify.app';
