
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Download, Trash2, Palette, Loader2, Sparkles,
  Moon, Sun, XCircle, CheckCircle2, AlertCircle, RefreshCcw,
  ShieldCheck, Zap, Crown, ArrowRight, Mail, ChevronLeft, ToggleLeft, ToggleRight,
  Type, Settings, BookOpen, Save, User as UserIcon, Wand2, LogOut, Lock, UserX
} from 'lucide-react';
import { ImageFile, Tier, User, View } from './types';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { generateLocalColoringPage, downloadLocalModel, initLocalSession } from './services/geminiService';
import { generateColoringBookPDF } from './utils/pdfUtils';
import { useAuth } from './src/hooks/useAuth';
import { getLocalImages } from './src/lib/localStorage';
import ColoringCanvas from './src/components/ColoringCanvas';
import { saveImageToLocal, loadAllImagesFromLocal, deleteLocalImage, updateLocalImage } from './src/utils/localStorageDB';

// --- Shared Constants & UI Helpers ---

const LOGO_GRADIENT = "bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 to-blue-500";

const Logo = ({ size = 64 }: { size?: number }) => (
  <div className="flex items-center gap-[0.6em] text-[clamp(1.35rem,4.5vw,3rem)]">
    <img
      src="/favicon.png"
      alt="Colorable AI"
      style={{ maxWidth: size * 1.5, maxHeight: size * 1.5 }}
      className="object-contain drop-shadow-2xl rounded-2xl w-[1.6em] h-[1.6em]"
    />
    <span className={`font-black tracking-tight whitespace-nowrap ${LOGO_GRADIENT}`}>Colorable AI</span>
  </div>
);

const TIER_RANK: Record<Tier, number> = {
  'free': 0,
  'plus': 1,
  'ultimate': 2
};

// --- Hero Transformation Component with Static Demo Images ---
const HeroTransformation = () => {
  // Offline-first: the bundled photo ships with the app so the hero works
  // with no internet. If the local file is missing (dev), fall back to the
  // original Unsplash source.
  const photoUrl = "/assets/hero-photo.jpg";
  const photoFallbackUrl = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=900";
  // This is the pre-generated coloring page result
  const coloringResultUrl = "/assets/hero-coloring.png";

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 mb-20 w-full max-w-7xl px-6">
      <div className="relative w-full max-w-[450px] aspect-square md:w-[min(450px,36vw)] md:h-[min(450px,36vw)] rounded-[3.5rem] overflow-hidden shadow-2xl transition-transform hover:scale-[1.01] bg-slate-100 border-4 border-white dark:border-slate-800">
        <img
          src={photoUrl}
          alt="Original Photo"
          className="w-full h-full object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== photoFallbackUrl) img.src = photoFallbackUrl;
          }}
        />
        <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 bg-white/95 backdrop-blur-md px-4 py-2 md:px-8 md:py-3 rounded-full font-black text-[12px] uppercase tracking-[0.2em] text-slate-900 shadow-lg">Original Photo</div>
      </div>

      <div className="flex flex-col items-center gap-3 text-indigo-400">
        <div className="relative">
          <Wand2 size={56} className="animate-pulse" />
          <Sparkles size={24} className="absolute -top-2 -right-2 text-yellow-400 animate-bounce" />
        </div>
        <ArrowRight size={40} className="text-indigo-500 animate-[bounce_2s_infinite] hidden md:block" />
        <span className="font-black uppercase tracking-[0.3em] text-[11px] opacity-40 mt-2">
          AI Magic
        </span>
      </div>

      <div className="relative w-full max-w-[450px] aspect-square md:w-[min(450px,36vw)] md:h-[min(450px,36vw)] rounded-[3.5rem] border-4 border-black dark:border-white bg-white shadow-2xl transition-transform hover:scale-[1.01] overflow-hidden">
        <div className="absolute inset-0 bg-white flex items-center justify-center">
          <img
            src={coloringResultUrl}
            alt="AI Coloring Result"
            className="w-full h-full object-contain p-4"
          />
        </div>
        <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 bg-black text-white px-4 py-2 md:px-8 md:py-3 rounded-full font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl z-10">Colorable View</div>
      </div>
    </div>
  );
};

// --- Stable Sub-Views ---

const LandingPage = ({ setView, setIsDarkMode, isDarkMode, setSelectedTier, modelProgress, isInitializingModel }: any) => {
  const contrastText = "text-slate-900 dark:text-white";
  const subText = "text-slate-600 dark:text-slate-400";

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center">
      {/* Model Bootloader Banner */}
      {isInitializingModel && (
        <div className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center py-4 px-6 flex flex-col sm:flex-row items-center justify-center gap-4 shadow-md font-bold">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-white flex-shrink-0" size={24} />
            <span>Downloading local LineArt intelligence engine...</span>
          </div>
          <div className="w-64 bg-indigo-900/50 rounded-full h-4 overflow-hidden border border-indigo-400 relative">
            <div 
              className="bg-emerald-400 h-full transition-all duration-300"
              style={{ width: `${modelProgress || 0}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] uppercase font-black tracking-widest">{modelProgress || 0}%</span>
          </div>
        </div>
      )}
      <nav className="w-full max-w-7xl flex justify-between items-center px-4 md:px-6 py-6 md:py-10 sticky top-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-50 shadow-sm">
        <Logo size={36} />
        <div className="flex items-center gap-3 md:gap-12">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 md:p-3 text-slate-500 hover:text-indigo-600 transition-colors">
            {isDarkMode ? <Sun size={24} className="md:w-8 md:h-8" /> : <Moon size={24} className="md:w-8 md:h-8" />}
          </button>
          <button onClick={() => setView('privacy')} className={`${contrastText} font-black hover:text-indigo-600 transition-colors uppercase text-xs md:text-sm tracking-widest hidden sm:inline-block`}>Privacy</button>
          <button onClick={() => { setSelectedTier('free'); setView('signin'); }} className="px-4 py-2 md:px-10 md:py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-black hover:scale-105 transition-all shadow-lg text-sm md:text-lg uppercase tracking-wider">Login</button>
        </div>
      </nav>

      <div className="flex flex-col items-center text-center px-4 sm:px-6 py-12 md:py-28 max-w-[120rem] w-full">
        <h1 className={`text-[clamp(2.6rem,13vw,13.5rem)] font-black mb-8 md:mb-16 leading-[0.85] tracking-tighter ${LOGO_GRADIENT}`}>
          Colorable AI
        </h1>
        <p className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl ${subText} mb-12 md:mb-24 max-w-6xl font-bold leading-relaxed`}>
          The world's first AI coloring book engine that preserves exact composition.
          Turning uploaded images into professional line-art in seconds!
        </p>

        {/* Transformation Section */}
        <HeroTransformation />

        {/* Local Storage Notice */}
        <div className="mt-16 mb-8 px-6 max-w-3xl">
          <div className="flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400 text-sm md:text-base">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p className="font-medium">
              Your images and creations are stored <span className="font-bold text-slate-700 dark:text-slate-300">locally on this device only</span>.
              No cloud sync – your data stays private and under your control.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-8">
          <button
            onClick={() => { setSelectedTier('free'); setView('auth'); }}
            className="px-10 py-5 text-2xl md:px-20 md:py-8 md:text-4xl bg-indigo-600 text-white rounded-[4rem] font-black hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-[0_20px_60px_-15px_rgba(79,70,229,0.5)] uppercase tracking-[0.2em]"
          >
            Try for free
          </button>
          <p className="text-xl font-bold text-slate-400">Join thousands of artists today</p>
        </div>
      </div>
    </div>
  );
};

const PrivacyPage = ({ setView }: { setView: (view: any) => void; isDarkMode: boolean }) => {
  const contrastText = "text-slate-900 dark:text-white";
  const subText = "text-slate-600 dark:text-slate-400";

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <nav className="w-full max-w-7xl mx-auto flex justify-between items-center px-6 py-10">
        <div onClick={() => setView('landing')} className="cursor-pointer">
          <Logo size={36} />
        </div>
        <button
          onClick={() => setView('landing')}
          className="px-8 py-3 bg-indigo-600 text-white rounded-full font-black hover:bg-indigo-700 transition-all shadow-lg"
        >
          ← Back to Home
        </button>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className={`text-6xl font-black mb-12 ${contrastText}`}>Privacy Policy</h1>

        {/* Local Storage Section */}
        <section className="mb-12">
          <h2 className={`text-3xl font-black mb-6 ${contrastText}`}>🔒 Local Storage Only</h2>
          <div className="space-y-4 text-lg">
            <p className={subText}>
              <strong className={contrastText}>Colorable AI stores all your images and workspace data locally in your browser.</strong>
              Your data is <strong>NOT synced to the cloud</strong> and will only be available on the device you're currently using.
            </p>
            <p className={subText}>
              This means:
            </p>
            <ul className={`list-disc ml-8 space-y-2 ${subText}`}>
              <li>Your images and creations are stored on <strong className={contrastText}>this device only</strong></li>
              <li>If you use a different device or browser, your data <strong className={contrastText}>will not sync</strong></li>
              <li>Clearing your browser data will <strong className={contrastText}>delete your saved work</strong></li>
              <li>Your privacy is maximally protected – we can't access your images</li>
            </ul>
          </div>
        </section>

        {/* Authentication Section */}
        <section className="mb-12">
          <h2 className={`text-3xl font-black mb-6 ${contrastText}`}>👤 Account Information</h2>
          <p className={subText + " text-lg"}>
            When you create an account, we collect:
          </p>
          <ul className={`list-disc ml-8 space-y-2 mt-4 text-lg ${subText}`}>
            <li>Email address (for authentication)</li>
            <li>Display name (optional)</li>
            <li>Subscription tier (Free, Plus, or Ultimate)</li>
          </ul>
          <p className={subText + " mt-4 text-lg"}>
            This information is managed through <a href="https://supabase.com/privacy" className="text-indigo-600 hover:underline">Supabase</a>,
            our secure authentication provider.
          </p>
        </section>

        {/* Payments Section */}
        <section className="mb-12">
          <h2 className={`text-3xl font-black mb-6 ${contrastText}`}>💳 Payments</h2>
          <p className={subText + " text-lg"}>
            This app does not process payments and contains no in-app purchases.
            If your account has a subscription that was purchased on our website, that payment was processed
            by <a href="https://stripe.com/privacy" className="text-indigo-600 hover:underline">Stripe</a>;
            we never see or store your card details.
          </p>
        </section>

        {/* Data Sharing Section */}
        <section className="mb-12">
          <h2 className={`text-3xl font-black mb-6 ${contrastText}`}>🤝 Data Sharing</h2>
          <p className={subText + " text-lg"}>
            We <strong className={contrastText}>do not sell, rent, or share</strong> your personal information with third parties, except:
          </p>
          <ul className={`list-disc ml-8 space-y-2 mt-4 text-lg ${subText}`}>
            <li>Service providers (Supabase, Stripe) as necessary for platform functionality</li>
            <li>When required by law</li>
          </ul>
        </section>

        {/* AI Processing Section */}
        <section className="mb-12">
          <h2 className={`text-3xl font-black mb-6 ${contrastText}`}>🤖 AI Processing</h2>
          <p className={subText + " text-lg"}>
            All photo-to-coloring-page conversion happens 100% on your device, using an AI model that ships
            inside the app. Your photos are never uploaded to our servers or to any third party — coloring page
            generation works even with no internet connection.
          </p>
        </section>

        {/* Contact Section */}
        <section className="mb-12">
          <h2 className={`text-3xl font-black mb-6 ${contrastText}`}>📧 Contact</h2>
          <p className={subText + " text-lg"}>
            If you have questions about your privacy or data, please contact us through our support channels.
          </p>
        </section>

        <div className="text-center mt-16">
          <button
            onClick={() => setView('landing')}
            className="px-12 py-4 bg-indigo-600 text-white rounded-full font-black hover:bg-indigo-700 transition-all shadow-lg text-lg"
          >
            Back to Colorable AI
          </button>
        </div>
      </div>
    </div>
  );
};

const AuthPage = ({ selectedTier, signUp, signIn, setBookTitle, setView, initialMode = 'signup' }: any) => {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const contrastText = "text-slate-900 dark:text-white";

  const handleAuth = async () => {
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!userName) throw new Error('Name is required');
        const { data, error } = await signUp(userEmail, password, {
          display_name: userName,
          tier: selectedTier
        });
        if (error) throw error;

        if (data?.user && !data.session) {
          setSuccessMessage(`We've sent a confirmation email to ${userEmail}. Please verify your email to continue.`);
          setLoading(false);
          return;
        }

      } else {
        const { error } = await signIn(userEmail, password);
        if (error) throw error;
      }

      if (userName) {
        setBookTitle(`${userName}'s Colorable`);
      }

      // SUCCESS! Clear the local loading state
      // The useAuth hook will handle navigation via the useEffect in App.tsx
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-12 md:p-24 rounded-[2rem] sm:rounded-[4rem] md:rounded-[6rem] shadow-2xl w-full max-w-[95vw] sm:max-w-md md:max-w-3xl border border-slate-100 dark:border-slate-800 text-center">
        <Logo size={80} />
        <div className="h-20" />
        <h2 className={`text-7xl font-black mb-12 ${contrastText} tracking-tighter`}>
          {isSignUp ? 'Join Us' : 'Welcome Back'}
        </h2>

        {error && (
          <div className="mb-10 p-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-3xl font-bold flex items-center gap-4">
            <AlertCircle size={32} />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-10 p-6 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-3xl font-bold flex items-center gap-4 text-left">
            <CheckCircle2 size={32} className="shrink-0" />
            <div>
              <p className="text-xl">{successMessage}</p>
              <p className="text-sm font-normal mt-2 opacity-80">Once confirmed, return here or refresh the page.</p>
            </div>
          </div>
        )}

        {!successMessage && (
          <div className="space-y-10 text-left">
            {isSignUp && (
              <div className="w-full">
                <label className="flex items-center gap-3 mb-3 text-sm font-black uppercase tracking-widest opacity-60">
                  <UserIcon size={20} />
                  <span>Your Artist Name</span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 border-none rounded-full outline-none ring-2 ring-transparent focus:ring-indigo-500 transition-all font-semibold text-base text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
            )}

            <div className="w-full">
              <label className="flex items-center gap-3 mb-3 text-sm font-black uppercase tracking-widest opacity-60">
                <Mail size={20} />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 border-none rounded-full outline-none ring-2 ring-transparent focus:ring-indigo-500 transition-all font-semibold text-base text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div className="w-full">
              <label className="flex items-center gap-3 mb-3 text-sm font-black uppercase tracking-widest opacity-60">
                <Lock size={20} />
                <span>Password</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 border-none rounded-full outline-none ring-2 ring-transparent focus:ring-indigo-500 transition-all font-semibold text-base text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <button
              disabled={loading || !userEmail || !password || (isSignUp && !userName)}
              onClick={handleAuth}
              className="w-full py-5 mt-6 bg-indigo-600 text-white rounded-full font-black text-lg shadow-2xl shadow-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading && <Loader2 className="animate-spin" size={24} />}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            <div className="flex flex-col gap-4 mt-10">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-slate-500 dark:text-slate-400 font-bold hover:text-indigo-600 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Join Now"}
              </button>
              <button
                onClick={() => setView('landing')}
                className="text-slate-400 font-black uppercase text-base tracking-widest text-center hover:text-indigo-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div >
  );
};

// --- Real Workspace Component ---

const Workspace = ({ user, kidsMode, setView, logout, deleteAccount, isDarkMode, setIsDarkMode, bookTitle, setBookTitle, images, setImages }: any) => {
  // Account-deletion confirm dialog state (Google Play requirement)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteAccountError(null);
    const { error } = await deleteAccount();
    if (error) {
      setDeleteAccountError(error.message);
      setDeletingAccount(false);
    }
    // On success the app root navigates back to the landing page.
  };
  const [isSaving, setIsSaving] = useState(false);
  const [vibrantEnabled, setVibrantEnabled] = useState(() => {
    return localStorage.getItem('colorable_vibrant_enabled') === 'true';
  });

  // Save vibrant enabled state
  useEffect(() => {
    localStorage.setItem('colorable_vibrant_enabled', String(vibrantEnabled));
  }, [vibrantEnabled]);
  const [vibrantColors, setVibrantColors] = useState<[string, string, string]>(() => {
    const saved = localStorage.getItem('colorable_vibrant_colors');
    return saved ? JSON.parse(saved) : ['#ff5f6d', '#ffc371', '#ff5f6d'];
  });

  // Save vibrant colors to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('colorable_vibrant_colors', JSON.stringify(vibrantColors));
  }, [vibrantColors]);
  const [coverTemplate, setCoverTemplate] = useState('standard');
  const [fontFamily, setFontFamily] = useState('generic');

  const processingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Abort controllers for cancelling processing operations
  const [abortControllers, setAbortControllers] = useState<Map<string, AbortController>>(new Map());
  const [textOverlayPreviews, setTextOverlayPreviews] = useState<Map<string, string>>(new Map());
  const [coloringImageId, setColoringImageId] = useState<string | null>(null);
  // Touch flow: first tap on a tile reveals the action overlay; actions are
  // explicit buttons. Prevents blind taps hitting invisible hover controls.
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  // Check if any image is currently processing or remixing
  const isProcessingQueue = images.some((img: ImageFile) => img.status === 'processing' || img.status === 'remixing');

  // 2-minute timeout for processing
  const PROCESSING_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

  // Constants for file validation
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_RETRY_COUNT = 3;

  const limit = user?.tier === 'free' ? 10 : user?.tier === 'plus' ? 20 : 30;
  const isPaid = user?.tier !== 'free';
  const isUltimate = user?.tier === 'ultimate';

  // Cleanup blob URLs when images are removed to prevent memory leaks
  useEffect(() => {
    return () => {
      images.forEach((img: ImageFile) => {
        if (img.originalUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.originalUrl);
        }
      });
    };
  }, []);

  // NOTE: localStorage persistence disabled to restore core functionality
  // The localStorage save was causing crashes with multiple images
  // Clear any stale localStorage data on mount to prevent blob URL errors
  useEffect(() => {
    // Clear stale localStorage data that may contain expired blob URLs
    try {
      localStorage.removeItem('coloringbook_images');
      console.log('✅ Cleared stale localStorage data on mount');
    } catch (e) {
      console.warn('Could not clear localStorage:', e);
    }

    // Reset processingRef in case component remounted after a crash
    processingRef.current = false;
  }, []);

  // Reset any images stuck in processing/remixing state on mount (after crash recovery)
  useEffect(() => {
    const stuckImages = images.filter((img: ImageFile) =>
      img.status === 'processing' || img.status === 'remixing'
    );
    if (stuckImages.length > 0) {
      console.log('⚠️ Found stuck images, resetting to idle:', stuckImages.map((i: ImageFile) => i.id));
      setImages((prev: ImageFile[]) => prev.map((img: ImageFile) =>
        (img.status === 'processing' || img.status === 'remixing')
          ? { ...img, status: 'idle' as const }
          : img
      ));
    }
  }, []); // Only run once on mount

  // --- Sequential Processing Logic ---
  useEffect(() => {
    const processQueue = async () => {
      if (processingRef.current) return;
      const idleImage = images.find((img: ImageFile) => img.status === 'idle');
      if (!idleImage) return;

      processingRef.current = true;
      try {
        await processSingleImage(idleImage);
      } finally {
        await new Promise(r => setTimeout(r, 2000));
        processingRef.current = false;
        setImages((prev: ImageFile[]) => [...prev]);
      }
    };
    processQueue();
  }, [images]);

  const processSingleImage = async (img: ImageFile) => {
    // Create abort controller for this image
    const controller = new AbortController();
    setAbortControllers(prev => new Map(prev).set(img.id, controller));

    // Set timeout to auto-cancel after 2 minutes
    const timeoutId = setTimeout(() => {
      controller.abort();
      updateImageStatus(img.id, 'error', 'Processing timed out after 2 minutes');
    }, PROCESSING_TIMEOUT);

    updateImageStatus(img.id, 'processing');
    try {
      const response = await fetch(img.originalUrl, { signal: controller.signal });
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        if (controller.signal.aborted) {
          reject(new Error('Cancelled'));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const coloringUrl = await generateLocalColoringPage(base64);

      if (!controller.signal.aborted) {
        setImages((prev: ImageFile[]) => prev.map(i => i.id === img.id ? { ...i, coloringUrl, status: 'done' as const, retryCount: 0 } : i));

        // Save completed image to local IndexedDB (persistent & private)
        try {
          // We pass the whole image object, but we need to make sure urls are valid
          // The helper expects { ...img, originalUrl, coloringUrl }
          if (user?.id) {
            await saveImageToLocal(user.id, { ...img, coloringUrl, status: 'done', overlay: img.overlay });
            console.log('✅ Image saved to local device storage');
          }
        } catch (e) {
          console.error('Failed to save to local storage:', e);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        console.log('Processing cancelled for:', img.id);
        // Set to idle so user can retry - don't leave in processing state
        updateImageStatus(img.id, 'idle', undefined);
      } else {
        const errorMessage = error instanceof Error ? error.message : "Conversion failed";
        console.error('❌ Processing failed:', img.name, '|', errorMessage, '|', error?.stack || error);
        updateImageStatus(img.id, 'error', errorMessage);
      }
    } finally {
      clearTimeout(timeoutId);
      setAbortControllers(prev => {
        const next = new Map(prev);
        next.delete(img.id);
        return next;
      });
    }
  };

  const cancelProcessing = (imgId: string) => {
    const controller = abortControllers.get(imgId);
    if (controller) {
      controller.abort();
      setAbortControllers(prev => {
        const next = new Map(prev);
        next.delete(imgId);
        return next;
      });
    }

    // Always update status to 'idle' even if no controller exists
    // This handles old stuck images that don't have abort controllers
    updateImageStatus(imgId, 'idle', undefined);

    // Clear processing ref to allow next image
    processingRef.current = false;
  };

  // Generate text overlay preview using canvas
  const generateTextOverlayPreview = async (imageUrl: string, text: string, position: string = 'top'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx!.drawImage(img, 0, 0);

        // Draw text overlay
        const fontSize = Math.max(img.height / 15, 24);
        ctx!.font = `bold ${fontSize}px ${fontFamily === 'generic' ? 'Arial' : fontFamily}`;
        ctx!.fillStyle = 'black';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'top';
        const y = position === 'top' ? fontSize : img.height - fontSize * 2;
        ctx!.fillText(text, img.width / 2, y);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image for text overlay'));
      img.src = imageUrl;
    });
  };

  // Get preview URL with text overlay if applicable
  const getPreviewUrl = (img: ImageFile): string => {
    if (img.overlay?.text && img.coloringUrl) {
      const previewKey = `${img.id}-${img.overlay.text}-${img.overlay.position || 'top'}`;
      return textOverlayPreviews.get(previewKey) || img.coloringUrl;
    }
    return img.coloringUrl || img.originalUrl;
  };

  const updateImageStatus = (id: string, status: ImageFile['status'], errorDetail?: string) => {
    setImages((prev: ImageFile[]) => prev.map(i => i.id === id ? { ...i, status, errorDetail } : i));
  };

  // On Android the WebView's <input type=file> chooser can lose its result
  // when the activity is stopped behind the system photo picker, so native
  // platforms go through the Camera plugin instead (photos stay on-device).
  const pickImagesNative = async () => {
    try {
      const result = await Camera.pickImages({ quality: 90 });
      const validFiles: ImageFile[] = result.photos.map(photo => ({
        id: Math.random().toString() + Date.now(),
        originalUrl: photo.webPath!,
        status: 'idle' as const,
        name: `photo.${photo.format || 'jpeg'}`,
        retryCount: 0
      })).filter(f => f.originalUrl);
      const newImgs = validFiles.slice(0, limit - images.length);
      if (newImgs.length > 0) setImages([...images, ...newImgs]);
    } catch (e: any) {
      // User cancelled the picker — not an error
      if (!/cancel/i.test(e?.message || '')) {
        console.error('Native image pick failed:', e?.message || e);
        alert('Could not open the photo picker. Please try again.');
      }
    }
  };

  const handleAddPage = () => {
    if (isProcessingQueue) return;
    if (Capacitor.isNativePlatform()) {
      pickImagesNative();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles: ImageFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file: File) => {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only JPEG, PNG, and WebP are allowed.`);
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large. Maximum size is 10MB.`);
        return;
      }

      validFiles.push({
        id: Math.random().toString() + Date.now(),
        originalUrl: URL.createObjectURL(file),
        status: 'idle' as const,
        name: file.name,
        retryCount: 0
      });
    });

    if (errors.length > 0) {
      alert('Some files were rejected:\n\n' + errors.join('\n'));
    }

    const newImgs = validFiles.slice(0, limit - images.length);
    setImages([...images, ...newImgs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = async (id: string) => {
    // Cancel processing if image is in processing/remixing state
    if (abortControllers.has(id)) {
      cancelProcessing(id);
    }

    const img = images.find((i: ImageFile) => i.id === id);
    // Revoke blob URL to prevent memory leak
    if (img?.originalUrl.startsWith('blob:')) {
      URL.revokeObjectURL(img.originalUrl);
    }
    if (img?.coloringUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(img.coloringUrl);
    }

    // Remove from local persistent storage
    if (user?.id) deleteLocalImage(user.id, id).catch(err => console.error("Failed to delete local image", err));

    setImages(images.filter((i: ImageFile) => i.id !== id));
  };


  // Load images from local device storage on mount
  useEffect(() => {
    if (!user?.id) return; // No account, no local library
    const loadLocalImages = async () => {
      try {
        const localImages = await loadAllImagesFromLocal(user.id);
        if (localImages && localImages.length > 0) {
          // Merge with current images if any (though usually empty on start)
          setImages((prev: ImageFile[]) => {
            // Avoid duplicates based on ID
            const textIds = new Set(prev.map(p => p.id));
            const newOnes = localImages.filter(l => !textIds.has(l.id));
            return [...prev, ...newOnes];
          });
          console.log(`Loaded ${localImages.length} images from local device storage`);
        }
      } catch (error) {
        console.error("Failed to load local images:", error);
      }
    };

    // Slight delay to ensure DB is ready, though not strictly necessary
    loadLocalImages();
  }, [user?.id]); // Reload when the signed-in account changes

  const handleSetOverlay = async (imgId: string, currentText: string) => {
    const txt = window.prompt("Enter text for this coloring page:", currentText);
    if (txt !== null) {
      setImages((prev: ImageFile[]) => prev.map(i => i.id === imgId ? { ...i, overlay: { text: txt, position: 'bottom' } } : i));

      // Generate text overlay preview
      const img = images.find((i: ImageFile) => i.id === imgId);
      if (img?.coloringUrl && txt) {
        try {
          const previewUrl = await generateTextOverlayPreview(img.coloringUrl, txt, 'bottom');
          const previewKey = `${imgId}-${txt}-bottom`;
          setTextOverlayPreviews(prev => new Map(prev).set(previewKey, previewUrl));
        } catch (error) {
          console.error('Failed to generate text overlay preview:', error);
        }
      }
    }
  };

  const handleRemix = async (imgId: string) => {
    const img = images.find((i: ImageFile) => i.id === imgId);
    if (!img || img.status !== 'done') {
      console.log('Cannot remix - image not ready:', { status: img?.status });
      return;
    }

    // Re-trace the original photo through the on-device model. (The old
    // cloud path took a text scenario; the local model cannot use one, so we
    // no longer ask — an input the app ignores is worse than no input.)
    if (!window.confirm('Re-trace this page from the original photo?')) return;

    // Save original coloringUrl to restore on failure
    const originalColoringUrl = img.coloringUrl;

    // Create abort controller
    const controller = new AbortController();
    setAbortControllers((prev: Map<string, AbortController>) => new Map(prev).set(imgId, controller));

    // Set timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
      // Restore original image on timeout
      setImages((prev: ImageFile[]) => prev.map(i =>
        i.id === imgId ? { ...i, coloringUrl: originalColoringUrl, status: 'done' as const } : i
      ));
    }, PROCESSING_TIMEOUT);

    updateImageStatus(imgId, 'remixing');
    try {
      // Determine the source image to use for remix
      // Priority: originalUrl (blob or base64) > coloringUrl (for saved images)
      let base64: string;

      if (img.originalUrl && img.originalUrl.length > 0 && !img.originalUrl.startsWith('blob:')) {
        // originalUrl is already base64
        base64 = img.originalUrl;
      } else if (img.originalUrl && img.originalUrl.startsWith('blob:')) {
        // Convert from blob URL
        try {
          const response = await fetch(img.originalUrl, { signal: controller.signal });
          const blob = await response.blob();
          base64 = await new Promise<string>((resolve, reject) => {
            if (controller.signal.aborted) {
              reject(new Error('Cancelled'));
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (fetchErr) {
          // Blob URL expired or failed, fall back to coloringUrl
          console.log('originalUrl blob fetch failed, falling back to coloringUrl');
          if (img.coloringUrl) {
            base64 = img.coloringUrl;
          } else {
            throw new Error('No valid image source available for remix');
          }
        }
      } else if (img.coloringUrl) {
        // For saved images from localStorage where originalUrl is empty, use coloringUrl
        console.log('Using coloringUrl as source for remix (originalUrl unavailable)');
        base64 = img.coloringUrl;
      } else {
        throw new Error('No image source available for remix');
      }

      if (controller.signal.aborted) return;

      // Since offline local models do not natively support complex language scenario remixing in < 100MB,
      // we can inform the mobile user we will perform a stylized high-contrast outline blend of the visual structure.
      const remixedUrls = [await generateLocalColoringPage(base64)];
      if (!controller.signal.aborted && remixedUrls.length > 0) {
        setImages((prev: ImageFile[]) => prev.map(i => i.id === imgId ? { ...i, coloringUrl: remixedUrls[0], status: 'done' as const } : i));
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        console.log('Remix cancelled for:', imgId);
        // Restore original image
        setImages((prev: ImageFile[]) => prev.map(i =>
          i.id === imgId ? { ...i, coloringUrl: originalColoringUrl, status: 'done' as const } : i
        ));
      } else {
        console.error('Remix error:', error);
        // Restore original image and keep in 'done' state for retry
        setImages((prev: ImageFile[]) => prev.map(i =>
          i.id === imgId ? { ...i, coloringUrl: originalColoringUrl, status: 'done' as const } : i
        ));

        // Show error message to user
        const errorMsg = error.message || 'Remix failed';
        alert(`Remix failed: ${errorMsg}\n\nYour original image is preserved. Try a different scenario or be more specific in your description.`);
      }
    } finally {
      clearTimeout(timeoutId);
      setAbortControllers((prev: Map<string, AbortController>) => {
        const next = new Map(prev);
        next.delete(imgId);
        return next;
      });
    }
  };

  const retryImage = (id: string) => {
    const img = images.find((i: ImageFile) => i.id === id);
    const currentRetries = img?.retryCount || 0;

    if (currentRetries >= MAX_RETRY_COUNT) {
      alert(`Maximum retry limit (${MAX_RETRY_COUNT}) reached for this image. Please try a different image or upload again.`);
      return;
    }

    setImages((prev: ImageFile[]) => prev.map(i =>
      i.id === id
        ? { ...i, status: 'idle' as const, errorDetail: undefined, retryCount: currentRetries + 1 }
        : i
    ));
  };

  const restoreOriginalImage = (id: string) => {
    setImages((prev: ImageFile[]) => prev.map(i =>
      i.id === id
        ? { ...i, status: 'done' as const, errorDetail: undefined }
        : i
    ));
  };

  const handleDownload = async () => {
    const pdf = await generateColoringBookPDF(
      images.filter((i: ImageFile) => i.status === 'done').map((i: ImageFile) => i.coloringUrl!),
      bookTitle,
      coverTemplate,
      fontFamily,
      images.map((i: ImageFile) => i.overlay?.text || null),
      user?.tier !== 'free'
    );
    pdf.save(`${bookTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  };

  const inputTextColor = vibrantEnabled ? 'text-white' : 'text-slate-950 dark:text-white';
  const inputBgColor = vibrantEnabled ? 'bg-black/20' : 'bg-slate-200 dark:bg-[#1e293b]';

  return (
    <div
      className={`min-h-screen flex flex-col transition-all duration-1000 ${vibrantEnabled ? 'text-white' : 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'}`}
      style={vibrantEnabled ? { background: `linear-gradient(135deg, ${vibrantColors[0]}, ${vibrantColors[1]}, ${vibrantColors[2]})` } : {}}
    >
      <header className={`p-4 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 backdrop-blur-md sticky top-0 z-50 border-b ${vibrantEnabled ? 'border-white/20' : 'border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center gap-4 md:gap-12 overflow-x-auto w-full md:w-auto">
          <Logo size={32} />
          <div className={`h-8 md:h-12 w-px ${vibrantEnabled ? 'bg-white/20' : 'bg-slate-300 dark:bg-slate-700'}`} />
          <div className="flex items-center gap-3 md:gap-5 px-4 md:px-6 py-2 md:py-3 bg-indigo-600 text-white rounded-full font-black uppercase text-xs md:text-sm tracking-widest shadow-xl whitespace-nowrap">
            <Settings size={14} className="md:w-[18px] md:h-[18px]" /> {user?.tier ? (user.tier.charAt(0).toUpperCase() + user.tier.slice(1)) : 'Free'}
          </div>
          {/* Play Store build: no in-app upgrade CTA. Tier upgrades are not
              purchasable in the Android app (Play payments policy) — existing
              subscribers get their tier automatically after sign-in. */}
        </div>
        <div className="flex items-center gap-4 md:gap-10 w-full md:w-auto justify-between md:justify-end">
          {!vibrantEnabled && (
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 opacity-60 hover:opacity-100 transition-all">
              {isDarkMode ? <Sun size={28} className="md:w-10 md:h-10" /> : <Moon size={28} className="md:w-10 md:h-10" />}
            </button>
          )}
          {isPaid && (
            <div className="flex items-center gap-3 md:gap-6 bg-white/10 dark:bg-slate-800/50 p-2 md:p-3 rounded-full border border-white/20 shadow-inner overflow-x-auto">
              <div className="flex gap-2 md:gap-3 px-2 md:px-3">
                {vibrantColors.map((c, i) => (
                  <input key={i} type="color" value={c} onChange={e => {
                    const n = [...vibrantColors] as [string, string, string];
                    n[i] = e.target.value;
                    setVibrantColors(n);
                  }} className="w-8 h-8 md:w-12 md:h-12 rounded-full cursor-pointer border-2 border-white/50 bg-transparent overflow-hidden" />
                ))}
              </div>
              <button onClick={() => setVibrantEnabled(!vibrantEnabled)} className={`flex items-center gap-2 md:gap-3 px-4 md:px-8 py-2 md:py-4 rounded-full text-xs md:text-sm font-black uppercase transition-all shadow-md whitespace-nowrap ${vibrantEnabled ? 'bg-white text-indigo-600 shadow-xl' : 'bg-white/20 text-slate-400'}`}>
                {vibrantEnabled ? <ToggleRight size={20} className="md:w-8 md:h-8" /> : <ToggleLeft size={20} className="md:w-8 md:h-8" />}
                <span className="hidden sm:inline">Vibrant</span>
              </button>
            </div>
          )}
          {kidsMode ? (
            <button onClick={logout} className="flex items-center gap-2 font-black uppercase text-xs md:text-sm tracking-widest opacity-60 hover:opacity-100 transition-all">
              <Settings size={18} className="md:w-6 md:h-6" /> <span className="hidden sm:inline">Grown-Ups</span>
            </button>
          ) : (
            <>
              <button onClick={logout} className="flex items-center gap-2 font-black uppercase text-xs md:text-sm tracking-widest opacity-60 hover:opacity-100 transition-all hover:text-red-500">
                <LogOut size={18} className="md:w-6 md:h-6" /> <span className="hidden sm:inline">Logout</span>
              </button>
              <button
                onClick={() => { setShowDeleteAccount(true); setDeleteConfirmText(''); setDeleteAccountError(null); }}
                title="Delete account"
                aria-label="Delete account"
                className="flex items-center gap-2 font-black uppercase text-xs md:text-sm tracking-widest opacity-40 hover:opacity-100 transition-all hover:text-red-600"
              >
                <UserX size={18} className="md:w-6 md:h-6" />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-12 max-w-[1900px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16">
        <aside className="lg:col-span-3 space-y-6 md:space-y-12">
          <div className={`p-12 rounded-[5rem] border shadow-2xl ${vibrantEnabled ? 'bg-white/10 border-white/20' : 'bg-slate-50 dark:bg-[#0f172a] border-slate-200 dark:border-slate-800'}`}>
            <h3 className="font-black mb-12 flex items-center gap-5 uppercase text-xl tracking-[0.2em] opacity-80">
              <BookOpen size={24} /> Book Design
            </h3>
            <div className="space-y-12">
              <div>
                <label className="text-xl font-black uppercase opacity-60 mb-4 block tracking-widest ml-4">Title</label>
                <div className={`rounded-[2rem] px-8 py-6 transition-all ${inputBgColor}`}>
                  <input
                    value={bookTitle}
                    onChange={e => setBookTitle(e.target.value)}
                    className={`w-full bg-transparent outline-none font-black text-base selection:bg-indigo-500 selection:text-white ${inputTextColor}`}
                  />
                </div>
              </div>

              {isUltimate && (
                <div>
                  <label className="text-xl font-black uppercase opacity-60 mb-4 block tracking-widest ml-4">Cover Typography</label>
                  <div className={`rounded-[2rem] px-8 py-5 transition-all ${inputBgColor}`}>
                    <select value={coverTemplate} onChange={e => setCoverTemplate(e.target.value)} className={`w-full bg-transparent outline-none font-black appearance-none text-base ${inputTextColor}`}>
                      <option value="standard" className="text-black bg-white">Standard Bold</option>
                      <option value="playful" className="text-black bg-white">Playful Courier</option>
                      <option value="elegant" className="text-black bg-white">Elegant Serif</option>
                      <option value="modern" className="text-black bg-white">Modern Minimal</option>
                      <option value="bold" className="text-black bg-white">Ultra Heavy</option>
                    </select>
                  </div>
                </div>
              )}

              {isPaid && (
                <div>
                  <label className="text-xl font-black uppercase opacity-60 mb-4 block tracking-widest ml-4">Interior Font</label>
                  <div className={`rounded-[2rem] px-8 py-5 transition-all ${inputBgColor}`}>
                    <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className={`w-full bg-transparent outline-none font-black appearance-none text-base ${inputTextColor}`}>
                      <option value="generic" className="text-black bg-white">Standard Colorable</option>
                      {isUltimate && (
                        <>
                          <option value="courier" className="text-black bg-white">Fun Monospace</option>
                          <option value="times" className="text-black bg-white">Traditional Serif</option>
                          <option value="helvetica" className="text-black bg-white">Professional Sans</option>
                          <option value="cursive" className="text-black bg-white">Artistic Script</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-10 border-t border-black/5 dark:border-white/5 relative">
                <div className="flex justify-between items-baseline mb-4">
                  <span className="text-xs font-black uppercase opacity-40 ml-4">Pages</span>
                  <div className="flex items-baseline gap-1 mr-4">
                    <span className={`text-2xl font-black ${inputTextColor}`}>{images.length}</span>
                    <span className={`text-xs font-black opacity-30 ${inputTextColor}`}>/ {limit}</span>
                  </div>
                </div>
                <div className="h-4 w-full bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-400 via-yellow-400 to-blue-400 transition-all duration-500" style={{ width: `${(images.length / limit) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <button
              disabled={images.length === 0 || images.some((img: ImageFile) => img.status === 'processing')}
              onClick={handleDownload}
              className="w-full py-8 bg-emerald-500 text-white rounded-[4rem] font-black text-xl flex items-center justify-center gap-6 shadow-2xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50"
            >
              <Download size={32} /> {images.some((img: ImageFile) => img.status === 'processing') ? 'Processing...' : 'Download PDF'}
            </button>
            <button
              disabled={images.length === 0 || isSaving}
              onClick={() => { setIsSaving(true); setTimeout(() => setIsSaving(false), 2000); }}
              className="w-full py-8 bg-indigo-600/20 text-indigo-400 border-2 border-indigo-600/40 rounded-[4rem] font-black text-xl flex items-center justify-center gap-6 hover:bg-indigo-600/30 transition-all uppercase tracking-widest disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={32} className="animate-spin" /> : <Save size={32} />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </aside>

        <section className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-16">
          {images.map((img: ImageFile) => (
            <div key={img.id} className={`rounded-[5rem] overflow-hidden border shadow-2xl transition-all duration-500 group ${img.status === 'error' ? 'border-red-500' : 'hover:-translate-y-4'} ${vibrantEnabled ? 'bg-white/10 border-white/20' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
              <div
                className="aspect-[3/4] relative bg-white dark:bg-slate-950 p-10 flex items-center justify-center overflow-hidden"
                onClick={() => { if (isTouchDevice && img.status === 'done' && selectedImageId !== img.id) setSelectedImageId(img.id); }}
              >
                {img.status === 'processing' || img.status === 'remixing' ? (
                  <div className="flex flex-col items-center gap-8">
                    <Loader2 size={80} className="animate-spin text-indigo-500" />
                    <span className="text-base font-black uppercase opacity-50 animate-pulse">{img.status === 'remixing' ? 'Remixing Persona...' : 'Converting...'}</span>
                    <button
                      onClick={() => cancelProcessing(img.id)}
                      className="px-8 py-4 bg-red-500 text-white rounded-full font-black uppercase text-xs tracking-widest hover:bg-red-600 transition-all shadow-lg flex items-center gap-2"
                    >
                      <XCircle size={18} /> Cancel
                    </button>
                  </div>
                ) : img.status === 'error' ? (
                  <div className="flex flex-col items-center gap-6 text-center px-10">
                    <AlertCircle size={80} className="text-red-500" />
                    <span className="text-red-500 font-black uppercase text-sm tracking-widest">{img.errorDetail || "Something went wrong"}</span>
                    <div className="flex flex-col gap-3 w-full max-w-sm">
                      <button
                        onClick={() => restoreOriginalImage(img.id)}
                        className="w-full px-8 py-4 bg-blue-500 text-white rounded-full font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <RefreshCcw size={16} /> Restore Original
                      </button>
                      <button
                        onClick={() => retryImage(img.id)}
                        className="w-full px-8 py-4 bg-red-500 text-white rounded-full font-black uppercase text-xs tracking-widest hover:bg-red-600 transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <RefreshCcw size={16} /> Retry
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Delete this page? This cannot be undone.')) removeImage(img.id); }}
                        className="w-full px-8 py-4 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-full font-black uppercase text-xs tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <img src={getPreviewUrl(img)} className="w-full h-full object-contain" />
                )}

                {/* INTERACTION OVERLAY: Only visible when status is 'done' and NOT in error */}
                {img.status === 'done' && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isTouchDevice) { setSelectedImageId(null); return; } // tap off the buttons dismisses
                      setColoringImageId(img.id);
                    }}
                    className={`absolute inset-0 bg-slate-950/40 transition-all flex flex-col items-center justify-center gap-12 backdrop-blur-sm z-40 cursor-pointer ${selectedImageId === img.id ? 'opacity-100' : `opacity-0 pointer-events-none ${isTouchDevice ? '' : 'group-hover:opacity-100 group-hover:pointer-events-auto'}`}`}
                  >
                    <div className="flex items-center justify-center gap-8">
                      {isPaid && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetOverlay(img.id, img.overlay?.text || ""); }}
                          className="p-8 bg-white text-indigo-600 rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all cursor-pointer pointer-events-auto"
                        >
                          <Type size={48} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedImageId(null); setColoringImageId(img.id); }}
                        className="p-8 bg-indigo-600 text-white rounded-full shadow-2xl animate-bounce hover:scale-110 active:scale-90 transition-all cursor-pointer pointer-events-auto"
                      >
                        <Palette size={48} />
                      </button>
                      {isUltimate && (
                        <button
                          type="button"
                          disabled={isProcessingQueue}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); !isProcessingQueue && handleRemix(img.id); }}
                          className={`p-8 bg-indigo-500 text-white rounded-full shadow-2xl transition-all ${isProcessingQueue ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-90 cursor-pointer pointer-events-auto'}`}
                        >
                          <Sparkles size={48} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isProcessingQueue}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isProcessingQueue && window.confirm('Delete this page? This cannot be undone.')) { setSelectedImageId(null); removeImage(img.id); } }}
                      className={`px-12 py-5 bg-red-500/10 border-2 border-red-500 text-white rounded-full font-black uppercase text-base tracking-widest transition-all ${isProcessingQueue ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500 hover:text-white cursor-pointer pointer-events-auto'}`}
                    >
                      Delete Page
                    </button>
                  </div>
                )}
              </div>
              <div className="p-12 border-t border-black/5 dark:border-white/5 flex items-center justify-between bg-slate-100/30 dark:bg-black/20">
                <span className="text-sm font-black opacity-40 uppercase truncate max-w-[200px]">{img.name}</span>
                {img.status === 'done' && <CheckCircle2 size={32} className="text-emerald-500" />}
              </div>
            </div>
          ))}

          {images.length < limit && (
            <div
              onClick={handleAddPage}
              className={`aspect-[3/4] border-4 border-dashed rounded-[5rem] flex flex-col items-center justify-center transition-all group ${vibrantEnabled ? 'border-white/20 hover:border-white/50 hover:bg-white/5' : 'border-slate-300 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-900/50'} ${isProcessingQueue ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="p-12 rounded-full bg-indigo-600/10 text-indigo-600 group-hover:scale-110 transition-transform mb-10">
                {isProcessingQueue ? <Loader2 size={96} className="animate-spin" /> : <Plus size={96} className="stroke-[3px]" />}
              </div>
              <span className="font-black uppercase tracking-[0.4em] text-base opacity-50">{isProcessingQueue ? 'Processing...' : 'Add Page'}</span>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} disabled={isProcessingQueue} />
            </div>
          )}
        </section>
      </main>

      {/* Delete Account confirmation (Google Play requirement) */}
      {showDeleteAccount && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 md:p-10">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <UserX size={28} />
              <h3 className="text-2xl font-black">Delete account?</h3>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              This permanently deletes your Colorable account and profile from our servers,
              and removes all artwork saved on this device. <strong className="text-slate-900 dark:text-white">This cannot be undone.</strong>
            </p>
            <label className="block text-xs font-black uppercase tracking-widest opacity-60 mb-2">
              Type DELETE to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              autoCapitalize="characters"
              className="w-full px-5 py-3 mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black tracking-widest outline-none focus:border-red-500"
            />
            {deleteAccountError && (
              <p className="text-red-500 text-sm font-bold mb-4">{deleteAccountError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAccount(false)}
                disabled={deletingAccount}
                className="flex-1 py-3 rounded-full font-black uppercase text-sm tracking-widest bg-slate-200 dark:bg-slate-800 hover:opacity-80 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount}
                className="flex-1 py-3 rounded-full font-black uppercase text-sm tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deletingAccount ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Coloring Canvas */}
      {coloringImageId && (() => {
        const targetImg = images.find((i: ImageFile) => i.id === coloringImageId);
        if (!targetImg || !targetImg.coloringUrl) return null;

        return (
          <ColoringCanvas
            imageUrl={targetImg.coloringUrl}
            userTier={user?.tier || 'free'}
            onClose={() => setColoringImageId(null)}
            onSave={async (dataUrl) => {
              // Update the image with the new colored version (which includes the outline)
              // We keep the original ID but update the coloringUrl
              const newImages = images.map((i: ImageFile) =>
                i.id === coloringImageId
                  ? { ...i, coloringUrl: dataUrl }
                  : i
              );
              setImages(newImages);

              // Update local storage
              try {
                const updatedImg = newImages.find((i: ImageFile) => i.id === coloringImageId);
                if (updatedImg && user?.id) {
                  await updateLocalImage(user.id, updatedImg);
                }
              } catch (e) {
                console.error("Failed to update local image", e);
              }

              setColoringImageId(null);
            }}
          />
        );
      })()}
    </div>
  );
};

// --- Main Application Component ---

// Neutral age screen (Google Play Families / mixed-audience requirement).
// Must not hint at which answer unlocks what, and must run before any data
// collection. The answer is stored per-device so it persists across launches.
const AgeGate = ({ onPick }: { onPick: (mode: 'kid' | 'full') => void }) => {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState<string>('');

  const submit = () => {
    const y = parseInt(year, 10);
    if (!y || y < thisYear - 120 || y > thisYear) return;
    const age = thisYear - y;
    onPick(age < 13 ? 'kid' : 'full');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950 px-6">
      <div className="w-full max-w-sm text-center space-y-8">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white">Welcome to Colorable</h1>
        <p className="text-slate-500 font-medium">What year were you born?</p>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="w-full text-center text-2xl font-black p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
        >
          <option value="">Select year</option>
          {Array.from({ length: 100 }, (_, i) => thisYear - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={submit}
          disabled={!year}
          className="w-full py-4 bg-indigo-600 text-white rounded-full font-black uppercase tracking-widest disabled:opacity-40 hover:bg-indigo-700 transition-all shadow-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('landing');
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [isInitializingModel, setIsInitializingModel] = useState(false);

  // Trigger Local LineArt Model Downloader & Session bootstrap on App Init
  useEffect(() => {
    const initWeights = async () => {
      setIsInitializingModel(true);
      try {
        const buffer = await downloadLocalModel((pct) => setModelProgress(pct));
        await initLocalSession(buffer);
        console.log('🎉 Local neural edge model initialized fully!');
      } catch (err) {
        console.error('Failed to trigger background local model caching:', err);
      } finally {
        setIsInitializingModel(false);
        setModelProgress(null);
      }
    };
    initWeights();
  }, []);
  const [selectedTier, setSelectedTier] = useState<Tier>('free');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [bookTitle, setBookTitle] = useState('My Coloring Book');

  // Initialize dark mode from localStorage
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('colorable_dark_mode');
    return saved ? JSON.parse(saved) : false;
  });

  const { profile, loading, signOut, signUp, signIn, deleteAccount } = useAuth();

  // Map Supabase profile to App User type
  const user: User | null = profile ? {
    id: profile.id,
    name: profile.display_name || '',
    email: profile.email,
    tier: profile.tier,
    downloadsThisMonth: profile.pdf_downloads_this_month,
    isVerified: true
  } : null;

  // --- Kids Mode (Play Families compliance) ---
  // Under-13 users get a fully local, accountless experience: no signup, no
  // email, nothing transmitted. Local artwork is namespaced under a fixed id.
  const [ageMode, setAgeMode] = useState<'unknown' | 'kid' | 'full'>(() => {
    const stored = localStorage.getItem('colorable_age_mode');
    return stored === 'kid' || stored === 'full' ? stored : 'unknown';
  });
  const KID_USER: User = { id: 'kids-local', name: 'Artist', email: '', tier: 'free', downloadsThisMonth: 0, isVerified: true };
  const effectiveUser: User | null = ageMode === 'kid' ? KID_USER : user;

  // Parental gate: a random arithmetic challenge an early reader can't pass.
  const exitKidsMode = async () => {
    const a = Math.floor(Math.random() * 5) + 5;
    const b = Math.floor(Math.random() * 5) + 4;
    const answer = window.prompt(`Ask a grown-up to answer: what is ${a} \u00d7 ${b}?`);
    if (answer !== null && parseInt(answer.trim(), 10) === a * b) {
      localStorage.removeItem('colorable_age_mode');
      setAgeMode('unknown');
      setImages([]);
      setView('landing');
    }
  };

  // Kids Mode never leaves the workspace (privacy stays reachable)
  useEffect(() => {
    if (ageMode === 'kid' && view !== 'workspace' && view !== 'privacy') setView('workspace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageMode, view]);

  // Persistence Key strictly tied to the email
  const storageKey = user ? `colorable_data_v2_${user.email}` : null;

  // Redirect to workspace if logged in and on landing/auth page ONLY on initial mount
  // This runs once when user is loaded, not on every view change
  useEffect(() => {
    if (ageMode !== 'kid' && user && (view === 'landing' || view === 'auth' || view === 'signin')) {
      // User is logged in but on a public page, redirect to workspace
      setView('workspace');
    }
    // Only run when user auth state changes, not on view changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Persist dark mode preference
  useEffect(() => {
    localStorage.setItem('colorable_dark_mode', JSON.stringify(isDarkMode));
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDarkMode]);

  // NOTE: localStorage persistence DISABLED - was causing QuotaExceededError crashes
  // The localStorage save was trying to store base64 image data which exceeds browser limits
  // This needs to be reimplemented with cloud storage (Supabase) instead
  // 
  // Load user-specific data from localStorage (DISABLED)
  // useEffect(() => {
  //   if (storageKey) {
  //     const saved = localStorage.getItem(storageKey);
  //     if (saved) {
  //       try {
  //         const parsed = JSON.parse(saved);
  //         setImages(parsed.images || []);
  //         setBookTitle(parsed.title || `${user?.name}'s Colorable`);
  //       } catch (e) {
  //         setImages([]);
  //       }
  //     } else {
  //       setImages([]);
  //     }
  //   }
  // }, [storageKey]);

  // Save user-specific data to localStorage (DISABLED - now done per-image in Workspace)
  // The old approach saved ALL images on every change, which caused quota errors
  // New approach: save ONE image when it finishes processing (in processSingleImage)

  // Load completed images from localStorage on mount
  useEffect(() => {
    if (!effectiveUser?.id) return; // No account, no saved images
    try {
      const savedImages = getLocalImages(effectiveUser.id);
      if (savedImages.length > 0) {
        console.log('✅ Loaded', savedImages.length, 'completed images from localStorage');
        // Convert StoredImage to ImageFile format
        const restoredImages: ImageFile[] = savedImages.map(stored => ({
          id: stored.id,
          name: stored.name,
          originalUrl: '', // Original not saved - only the completed result
          coloringUrl: stored.coloringUrl,
          status: 'done' as const,
          retryCount: 0,
          overlayText: stored.overlayText,
          overlayPosition: stored.overlayPosition
        }));
        setImages(restoredImages);
      }
    } catch (e) {
      console.warn('Could not load from localStorage:', e);
    }
  }, [effectiveUser?.id]); // Reload when the signed-in account changes

  // Clear the OLD user-specific storage key if it exists (clean up old format)
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
        console.log('✅ Cleared user localStorage data to prevent quota errors:', storageKey);
      } catch (e) {
        console.warn('Could not clear user localStorage:', e);
      }
    }
  }, [storageKey]);

  const handleLogout = async () => {
    await signOut();
    setView('landing');
    setImages([]);
  };

  // Google Play account-deletion requirement: permanently removes the
  // account server-side, then clears everything locally.
  const handleDeleteAccount = async (): Promise<{ error: Error | null }> => {
    const { error } = await deleteAccount();
    if (!error) {
      setImages([]);
      setView('landing');
    }
    return { error };
  };

  if (ageMode === 'unknown') {
    return <AgeGate onPick={(mode) => { localStorage.setItem('colorable_age_mode', mode); setAgeMode(mode); }} />;
  }

  if (loading && ageMode !== 'kid') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950 space-y-6">
        <Loader2 className="animate-spin text-indigo-600" size={64} />
        <div className="text-center space-y-2">
          <p className="text-slate-500 font-medium">Loading your workspace...</p>
          <button
            onClick={async () => {
              await signOut();
              localStorage.clear(); // Force clear everything
              window.location.reload();
            }}
            className="text-xs text-red-500 hover:text-red-600 font-semibold uppercase tracking-wider hover:underline"
          >
            Stuck? Click to Reset
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      {view === 'landing' && (
        <LandingPage
          setView={setView}
          setIsDarkMode={setIsDarkMode}
          isDarkMode={isDarkMode}
          setSelectedTier={setSelectedTier}
          modelProgress={modelProgress}
          isInitializingModel={isInitializingModel}
        />
      )}
      {view === 'privacy' && (
        <PrivacyPage
          setView={setView}
          isDarkMode={isDarkMode}
        />
      )}
      {view === 'auth' && (
        <AuthPage
          selectedTier={selectedTier}
          signUp={signUp}
          signIn={signIn}
          setBookTitle={setBookTitle}
          setView={setView}
          initialMode="signup"
        />
      )}
      {view === 'signin' && (
        <AuthPage
          selectedTier={selectedTier}
          signUp={signUp}
          signIn={signIn}
          setBookTitle={setBookTitle}
          setView={setView}
          initialMode="signin"
        />
      )}
      {view === 'workspace' && (
        <Workspace
          user={effectiveUser}
          kidsMode={ageMode === 'kid'}
          setView={setView}
          logout={ageMode === 'kid' ? exitKidsMode : handleLogout}
          deleteAccount={handleDeleteAccount}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          bookTitle={bookTitle}
          setBookTitle={setBookTitle}
          images={images}
          setImages={setImages}
        />
      )}
    </div>
  );
};

export default App;
