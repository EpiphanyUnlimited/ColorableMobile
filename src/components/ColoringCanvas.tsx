import React, { useRef, useState, useEffect } from 'react';
import {
    X, Save, Undo, Redo, Eraser,
    Settings, Maximize,
    Brush, ZoomIn, ZoomOut
} from 'lucide-react';

interface ColoringCanvasProps {
    imageUrl: string;
    onClose: () => void;
    onSave: (dataUrl: string) => Promise<void>;
    userTier: 'free' | 'plus' | 'ultimate';
}


// --- Helper: HSL Color Wheel Component ---
const ColorWheel = ({
    onChange
}: {
    color: string,
    onChange: (color: string) => void
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2;

        // Draw Color Wheel
        for (let i = 0; i < 360; i++) {
            const startAngle = (i * Math.PI) / 180;
            const endAngle = ((i + 1) * Math.PI) / 180;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = `hsl(${i}, 100%, 50%)`;
            ctx.fill();
        }

        // Draw Saturation/Lightness Overlay (White to Transparent)
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();

    }, []);

    const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Get pixel data
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            // Convert RGB to Hex
            const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
            onChange(hex);
        }
    };

    return (
        <div className="relative w-48 h-48 rounded-full overflow-hidden shadow-xl border-4 border-white dark:border-slate-800 cursor-crosshair touch-none">
            <canvas
                ref={canvasRef}
                width={192}
                height={192}
                className="w-full h-full"
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={(e) => isDragging && handleInteraction(e)}
                onClick={handleInteraction}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                onTouchMove={(e) => isDragging && handleInteraction(e)}
            />
        </div>
    );
};


const ColoringCanvas: React.FC<ColoringCanvasProps> = ({ imageUrl, onClose, onSave, userTier }) => {
    // Canvas Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const bottomCanvasRef = useRef<HTMLCanvasElement>(null); // White background
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null); // User colors
    const topCanvasRef = useRef<HTMLCanvasElement>(null); // Line art (multiply mode)

    // State
    const [color, setColor] = useState('#ff0000');
    const [brushSize, setBrushSize] = useState(12);
    const [brushOpacity, setBrushOpacity] = useState(1);
    const [brushSoftness, setBrushSoftness] = useState(0.5); // 0 = Hard, 1 = Soft
    const [isEraser, setIsEraser] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showBrushSettings, setShowBrushSettings] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [pressureEnabled, setPressureEnabled] = useState(true);

    // Constants
    const isPremium = userTier !== 'free';

    // --- Initialization ---

    useEffect(() => {
        // Initialize Canvases
        const initCanvas = async () => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = imageUrl;
            await new Promise(r => img.onload = r);

            const width = img.width;
            const height = img.height;

            // Set dimensions for all canvases
            [bottomCanvasRef, drawingCanvasRef, topCanvasRef].forEach(ref => {
                if (ref.current) {
                    ref.current.width = width;
                    ref.current.height = height;
                }
            });

            // 1. Bottom Layer: White Background
            const botCtx = bottomCanvasRef.current?.getContext('2d');
            if (botCtx) {
                botCtx.fillStyle = 'white';
                botCtx.fillRect(0, 0, width, height);
            }

            // 2. Top Layer: Line Art
            const topCtx = topCanvasRef.current?.getContext('2d');
            if (topCtx) {
                topCtx.drawImage(img, 0, 0);
                // Set blend mode for interactive viewing immediately
                // Note: The actual "multiply" effect happens visually via CSS 'mix-blend-mode' 
                // to avoid expensive per-frame canvas composition, but we can also do it here if needed.
                // For drawing *under* lines, the CSS approach is much faster.
            }

            // 3. Drawing Layer: Clear
            const drawCtx = drawingCanvasRef.current?.getContext('2d');
            if (drawCtx) {
                saveHistory(); // Initial blank state
            }

            // Auto-fit 'Zoom' to screen
            if (containerRef.current) {
                const containerH = containerRef.current.clientHeight;
                const scale = (containerH - 100) / height; // Leave some padding
                setZoom(Math.min(scale, 1));
                // Center it
                const containerW = containerRef.current.clientWidth;
                setPan({
                    x: (containerW - width * Math.min(scale, 1)) / 2,
                    y: 50
                });
            }
        };

        initCanvas();
    }, [imageUrl]);


    // --- Drawing Logic ---

    const isDrawing = useRef(false);
    const lastPoint = useRef<{ x: number, y: number } | null>(null);

    const getCoordinates = (e: React.PointerEvent) => {
        if (!drawingCanvasRef.current) return { x: 0, y: 0, pressure: 0.5 };

        const rect = drawingCanvasRef.current.getBoundingClientRect();
        const scaleX = drawingCanvasRef.current.width / rect.width;
        const scaleY = drawingCanvasRef.current.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
            pressure: e.pressure || 0.5 // Default pressure if device doesn't support it
        };
    };

    const startDrawing = (e: React.PointerEvent) => {
        e.preventDefault(); // Prevent scrolling
        isDrawing.current = true;
        const { x, y, pressure } = getCoordinates(e);
        lastPoint.current = { x, y };

        // Initial dot (for clicking without dragging)
        draw(x, y, pressure);
    };

    const draw = (x: number, y: number, pressure: number) => {
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (!ctx || !lastPoint.current) return;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Dynamic Brush Settings
        let currentSize = brushSize;
        let currentOpacity = brushOpacity;

        // Stylus Pressure Logic
        if (pressureEnabled && pressure !== 0.5) { // 0.5 is often the default "mouse" pressure
            currentSize = brushSize * Math.max(0.2, pressure * 1.5); // Vary size
            // currentOpacity = brushOpacity * Math.max(0.2, pressure); // Vary opacity
        }

        ctx.globalAlpha = currentOpacity;
        ctx.lineWidth = currentSize;

        if (isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;

            // Softness (Shadow Blur simulation)
            if (brushSoftness > 0) {
                ctx.shadowBlur = currentSize * brushSoftness;
                ctx.shadowColor = color;
            } else {
                ctx.shadowBlur = 0;
            }
        }

        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        // Quadratic curve for smoother lines
        // For simplicity in this step, we'll just lineTo, but could upgrade to quadratic
        ctx.lineTo(x, y);
        ctx.stroke();

        // Reset settings that might leak
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        lastPoint.current = { x, y };
    };

    const moveDrawing = (e: React.PointerEvent) => {
        if (!isDrawing.current) return;
        const { x, y, pressure } = getCoordinates(e);
        draw(x, y, pressure);
    };

    const stopDrawing = () => {
        if (isDrawing.current) {
            isDrawing.current = false;
            lastPoint.current = null;
            saveHistory(); // Save state after stroke
        }
    };


    // --- History (Undo/Redo) ---
    const saveHistory = () => {
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (!ctx || !drawingCanvasRef.current) return;

        // Cap history at 20 steps to save memory
        const maxHistory = 20;
        const snapshot = ctx.getImageData(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);

        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(snapshot);
            if (newHistory.length > maxHistory) newHistory.shift();
            return newHistory;
        });

        // Update index, handling the shift if max reached
        setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const ctx = drawingCanvasRef.current?.getContext('2d');
            if (ctx) {
                const newIndex = historyIndex - 1;
                ctx.putImageData(history[newIndex], 0, 0);
                setHistoryIndex(newIndex);
            }
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const ctx = drawingCanvasRef.current?.getContext('2d');
            if (ctx) {
                const newIndex = historyIndex + 1;
                ctx.putImageData(history[newIndex], 0, 0);
                setHistoryIndex(newIndex);
            }
        }
    };


    // --- Save / Export ---
    const handleSave = async () => {
        setIsSaving(true);
        // Create a temporary canvas to composite everything
        const canvas = document.createElement('canvas');
        canvas.width = bottomCanvasRef.current!.width;
        canvas.height = bottomCanvasRef.current!.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Draw White Background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height); // Ensure non-transparent background

        // 2. Draw User Colors
        if (drawingCanvasRef.current) {
            ctx.drawImage(drawingCanvasRef.current, 0, 0);
        }

        // 3. Draw Line Art (Multiply Mode)
        // We need to simulate multiply mode manually if we want it roasted into the image
        // OR just draw it on top with 'multiply' global composite operation
        if (topCanvasRef.current) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(topCanvasRef.current, 0, 0);
            ctx.globalCompositeOperation = 'source-over'; // Reset
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // High quality JPEG
        await onSave(dataUrl);
        setIsSaving(false);
    };


    return (
        <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 flex flex-col overflow-hidden">

            {/* --- Toolbar --- */}
            <div className="h-16 md:h-20 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 shadow-sm z-50">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-colors text-slate-500">
                        <X size={24} />
                    </button>
                    <h2 className="font-black uppercase tracking-widest text-slate-900 dark:text-white hidden sm:block">Coloring Studio</h2>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block"></div>

                    <div className="flex items-center gap-2">
                        <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 text-slate-500 disabled:opacity-30 hover:text-indigo-600 transition-colors">
                            <Undo size={20} />
                        </button>
                        <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 text-slate-500 disabled:opacity-30 hover:text-indigo-600 transition-colors">
                            <Redo size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Tool Toggles */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setIsEraser(false)}
                            className={`p-2 rounded-md transition-all ${!isEraser ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-400'}`}
                        >
                            <Brush size={20} />
                        </button>
                        <button
                            onClick={() => setIsEraser(true)}
                            className={`p-2 rounded-md transition-all ${isEraser ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-400'}`}
                        >
                            <Eraser size={20} />
                        </button>
                    </div>

                    <button
                        onClick={() => { setShowColorPicker(!showColorPicker); setShowBrushSettings(false); }}
                        className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-slate-700 shadow-inner overflow-hidden relative"
                        style={{ backgroundColor: color }}
                    >
                        <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-full"></div>
                    </button>

                    <button
                        onClick={() => { setShowBrushSettings(!showBrushSettings); setShowColorPicker(false); }}
                        className={`p-2 rounded-full transition-all ${showBrushSettings ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <Settings size={24} />
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold uppercase tracking-wider text-sm transition-all shadow-lg hover:shadow-indigo-500/30"
                    >
                        {isSaving ? 'Saving...' : 'Save'} <Save size={18} />
                    </button>
                </div>
            </div>

            {/* --- Floating Panels --- */}

            {/* Color Picker Panel */}
            {showColorPicker && (
                <div className="absolute top-24 right-4 z-50 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-4 w-[300px]">
                    <h3 className="font-black uppercase tracking-widest text-xs opacity-50 mb-4">Color Palette</h3>

                    <div className="flex flex-col items-center gap-6">
                        <ColorWheel color={color} onChange={setColor} />

                        {/* Standard Grid Fallback */}
                        <div className="grid grid-cols-6 gap-2 w-full">
                            {[
                                '#ff0000', '#ffa500', '#ffff00', '#008000', '#0000ff', '#4b0082',
                                '#ee82ee', '#ffffff', '#000000', '#808080', '#a52a2a', '#ffc0cb'
                            ].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className="w-8 h-8 rounded-full border border-black/10 shadow-sm"
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>

                        {/* Hex Input */}
                        <div className="flex items-center gap-2 w-full bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">
                            <span className="text-slate-400 font-mono">#</span>
                            <input
                                value={color.replace('#', '')}
                                onChange={(e) => setColor(`#${e.target.value}`)}
                                className="bg-transparent outline-none w-full font-mono uppercase text-sm"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Brush Settings Panel */}
            {showBrushSettings && (
                <div className="absolute top-24 right-4 z-50 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-4 w-[300px]">
                    <h3 className="font-black uppercase tracking-widest text-xs opacity-50 mb-6">Brush Studio</h3>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-bold">Size</label>
                                <span className="text-xs opacity-60">{brushSize}px</span>
                            </div>
                            <input
                                type="range" min="1" max="100"
                                value={brushSize}
                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-bold">Opacity</label>
                                <span className="text-xs opacity-60">{Math.round(brushOpacity * 100)}%</span>
                            </div>
                            <input
                                type="range" min="0.01" max="1" step="0.01"
                                value={brushOpacity}
                                onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-bold flex items-center gap-2">
                                    Softness
                                    {!isPremium && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">PREMIUM</span>}
                                </label>
                                <span className="text-xs opacity-60">{Math.round(brushSoftness * 100)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.1"
                                disabled={!isPremium}
                                value={brushSoftness}
                                onChange={(e) => setBrushSoftness(parseFloat(e.target.value))}
                                className={`w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 ${!isPremium ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold flex items-center gap-2">
                                    Stylus Pressure
                                    {!isPremium && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">PLUS</span>}
                                </label>
                                <button
                                    onClick={() => setPressureEnabled(!pressureEnabled)}
                                    disabled={!isPremium}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${pressureEnabled && isPremium ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${pressureEnabled && isPremium ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">Varies brush size based on screen pressure.</p>
                        </div>

                        {/* Preview Stroke */}
                        <div className="h-20 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center overflow-hidden bg-white">
                            <div
                                style={{
                                    width: brushSize,
                                    height: brushSize,
                                    backgroundColor: color,
                                    opacity: brushOpacity,
                                    filter: `blur(${brushSoftness * 5}px)`,
                                    borderRadius: '50%'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}


            {/* --- Main Canvas Area --- */}
            <div
                ref={containerRef}
                className="flex-1 overflow-hidden relative touch-none bg-slate-200/50 dark:bg-black/50 flex items-center justify-center"
            >
                <div
                    className="relative shadow-2xl bg-white"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                        cursor: isDrawing.current ? 'none' : 'crosshair'
                    }}
                >
                    {/* Bottom Layer */}
                    <canvas ref={bottomCanvasRef} className="absolute inset-0 pointer-events-none" />

                    {/* Drawing Layer - Receives events */}
                    <canvas
                        ref={drawingCanvasRef}
                        className="absolute inset-0 touch-none"
                        onPointerDown={startDrawing}
                        onPointerMove={moveDrawing}
                        onPointerUp={stopDrawing}
                        onPointerLeave={stopDrawing}
                        // Add PointerEvents styling
                        style={{ touchAction: 'none' }}
                    />

                    {/* Top Layer - Line Art (Multiply) */}
                    <canvas
                        ref={topCanvasRef}
                        className="absolute inset-0 pointer-events-none mix-blend-multiply"
                    />
                </div>

                {/* Navigation Controls (Bottom Left) */}
                <div className="absolute bottom-6 left-6 flex flex-col gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-2xl p-2 shadow-lg border border-slate-200 dark:border-slate-700">
                    <button onClick={() => setZoom(z => Math.min(z + 0.1, 5))} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><ZoomIn size={20} /></button>
                    <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><ZoomOut size={20} /></button>
                    <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><Maximize size={20} /></button>
                </div>
            </div>

        </div>
    );
};

export default ColoringCanvas;
