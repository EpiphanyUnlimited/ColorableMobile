/// <reference types="vite/client" />

export type Tier = 'free' | 'plus' | 'ultimate';

export type View = 'landing' | 'auth' | 'signin' | 'pricing' | 'workspace' | 'privacy';

export interface User {
  id: string;
  name: string;
  email: string;
  tier: Tier;
  downloadsThisMonth: number;
  isVerified: boolean;
}

export interface TextOverlay {
  text: string;
  position: 'top' | 'bottom';
}

export interface ImageFile {
  id: string;
  originalUrl: string;
  coloringUrl?: string;
  status: 'idle' | 'processing' | 'done' | 'error' | 'remixing';
  name: string;
  errorDetail?: string;
  overlay?: TextOverlay;
  retryCount?: number;
}

export interface ColoringBook {
  id: string;
  title: string;
  images: ImageFile[];
  coverTemplateId: string;
  fontFamily: string;
  gradientColors: [string, string, string];
}
