

import React, { useRef, useEffect, useState } from 'react';
import { X, RotateCcw, Check, Brush, Wand2, AlertCircle, Layers, Move, Eraser, Plus, Maximize, Minimize, Upload, FolderSearch, HelpCircle, MousePointer2, MoveHorizontal, Download, Undo2, Scissors, Sun, Ghost } from 'lucide-react';
import { GeneratedImage } from '../types';
import { GoogleGenAI } from "@google/genai";
import { cleanBase64, blobToBase64 } from '../utils';
import GalleryPicker from './GalleryPicker';

interface Props {
  image: GeneratedImage;
  onClose: () => void;
  onSave: (originalId: string, newImageUrl: string) => void;
  apiKey: string;
  images: GeneratedImage[];
}

interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

// Reusable Slider
const BeforeAfterSlider: React.FC<{ before: string; after: string; className?: string }> = ({ before, after, className }) => {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let clientX;
        
        if ('touches' in e) {
             clientX = e.touches[0].clientX;
        } else {
             clientX = (e as React.MouseEvent).clientX;
        }

        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        setSliderPos((x / rect.width) * 100);
    };

    return (
        <div 
            ref={containerRef}
            className={`relative w-full h-full select-none cursor-ew-resize overflow-hidden ${className}`}
            onMouseMove={(e) => { if (e.buttons === 1) handleMove(e) }} 
            onClick={handleMove}
            onTouchMove={handleMove}
        >
            <img src={after} className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none" alt="After" />
            <div 
                className="absolute inset-0 w-full h-full"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
                <img src={before} className="w-full h-full object-contain select-none pointer-events-none" alt="Before" />
                <div className="absolute top-4 left-4 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20">BEFORE</div>
            </div>
             <div className="absolute top-4 right-4 bg-amber-600/80 text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20">AFTER</div>
            <div 
                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                style={{ left: `${sliderPos}%` }}
            >
                 <div className="absolute top-1/2 -translate-y-1/2 -left-4 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-800 shadow-xl border border-slate-300">
                    <MoveHorizontal size={16} />
                 </div>
            </div>
        </div>
    );
};

const ImageEditor: React.FC<Props> = ({ image, onClose, onSave, apiKey, images }) => {
  // Main Canvases
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Source Images
  const baseImageRef = useRef<HTMLImageElement>(new Image());
  const overlayImageRef = useRef<HTMLImageElement | null>(null);

  // Input Refs
  const overlayInputRef = useRef<HTMLInputElement>(null);

  // Offscreen Canvases (Layers)
  const overlayLayerRef = useRef<HTMLCanvasElement | null>(null); // Holds the edited overlay (erased parts)
  
  // State
  const [activeTool, setActiveTool] = useState<'brush' | 'move' | 'eraser' | 'remove_bg'>('brush');
  const [brushSize, setBrushSize] = useState(40);
  const [opacity, setOpacity] = useState(1);
  const [editPrompt, setEditPrompt] = useState('');
  
  // BG Removal State
  const [keepShadows, setKeepShadows] = useState(true);
  
  // Transform State
  const [overlayTransform, setOverlayTransform] = useState<Transform>({ x: 0, y: 0, scale: 1, rotation: 0 });
  const [hasOverlay, setHasOverlay] = useState(false);

  // Mask State (For Inpaint)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null); // Separate canvas for Red Mask
  const [isDrawingMask, setIsDrawingMask] = useState(false);

  // System State
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Mouse Tracking
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // UNDO History State
  const [maskHistory, setMaskHistory] = useState<ImageData[]>([]);
  const [overlayHistory, setOverlayHistory] = useState<ImageData[]>([]);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Load Base Image
    baseImageRef.current.crossOrigin = "anonymous"; // Important for CORS if loading from URL
    baseImageRef.current.src = image.url;
    baseImageRef.current.onload = () => {
       renderCanvas();
    };
  }, [image.url]);

  // Fix: Force redraw when preview is cleared (Retry clicked) to prevent black canvas
  useEffect(() => {
    if (previewUrl === null) {
        // Short timeout to allow canvas to mount back into DOM
        setTimeout(() => {
            renderCanvas();
        }, 50);
    }
  }, [previewUrl]);

  // Keyboard Shortcuts (Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            handleUndo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, hasOverlay]); 

  // --- RENDERING LOOP ---
  const renderCanvas = () => {
     const canvas = mainCanvasRef.current;
     if (!canvas) return;
     const ctx = canvas.getContext('2d');
     if (!ctx) return;

     // 1. Set Dimensions (Only if changed to avoid clearing unintentionally)
     if (canvas.width !== baseImageRef.current.naturalWidth || canvas.height !== baseImageRef.current.naturalHeight) {
         if (baseImageRef.current.naturalWidth > 0) {
            canvas.width = baseImageRef.current.naturalWidth;
            canvas.height = baseImageRef.current.naturalHeight;
         }
     }

     // 2. Clear
     ctx.clearRect(0, 0, canvas.width, canvas.height);

     // 3. Draw Base
     if (baseImageRef.current.complete && baseImageRef.current.naturalWidth > 0) {
         ctx.drawImage(baseImageRef.current, 0, 0);
     }

     // 4. Draw Overlay (If exists)
     if (hasOverlay && overlayLayerRef.current) {
         ctx.save();
         ctx.globalAlpha = opacity;
         
         const cx = canvas.width / 2 + overlayTransform.x;
         const cy = canvas.height / 2 + overlayTransform.y;
         
         ctx.translate(cx, cy);
         ctx.rotate((overlayTransform.rotation * Math.PI) / 180);
         ctx.scale(overlayTransform.scale, overlayTransform.scale);
         
         const ox = -overlayLayerRef.current.width / 2;
         const oy = -overlayLayerRef.current.height / 2;
         
         ctx.drawImage(overlayLayerRef.current, ox, oy);
         ctx.restore();
     }

     // 5. Draw Mask (If Inpaint mode)
     if (maskCanvasRef.current) {
         ctx.drawImage(maskCanvasRef.current, 0, 0);
     }
  };

  // Re-render when transforms change or tool changes
  useEffect(() => {
      renderCanvas();
  }, [overlayTransform, opacity, hasOverlay, activeTool]);


  // --- OVERLAY HANDLING ---
  const handleSelectOverlay = (url: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => {
          overlayImageRef.current = img;
          
          // Create offscreen canvas for this layer
          const offCanvas = document.createElement('canvas');
          offCanvas.width = img.naturalWidth;
          offCanvas.height = img.naturalHeight;
          const offCtx = offCanvas.getContext('2d');
          offCtx?.drawImage(img, 0, 0);
          
          overlayLayerRef.current = offCanvas;
          setOverlayHistory([]); // Reset history for new overlay
          
          setHasOverlay(true);
          setOverlayTransform({ x: 0, y: 0, scale: 0.5, rotation: 0 }); // Reset transform
          setActiveTool('move');
          renderCanvas();
      };
      setPickerOpen(false);
  };

  const handleOverlayFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const base64 = await blobToBase64(e.target.files[0]);
          handleSelectOverlay(base64);
      }
  };

  // --- UNDO HANDLER ---
  const handleUndo = () => {
      if (activeTool === 'brush') {
          if (maskHistory.length === 0) return;
          const prev = maskHistory[maskHistory.length - 1];
          const newHist = maskHistory.slice(0, -1);
          setMaskHistory(newHist);
          
          if (maskCanvasRef.current) {
              const ctx = maskCanvasRef.current.getContext('2d');
              ctx?.putImageData(prev, 0, 0);
              renderCanvas();
          }
      } else if (activeTool === 'eraser' && hasOverlay) {
          if (overlayHistory.length === 0) return;
          const prev = overlayHistory[overlayHistory.length - 1];
          const newHist = overlayHistory.slice(0, -1);
          setOverlayHistory(newHist);

          if (overlayLayerRef.current) {
              const ctx = overlayLayerRef.current.getContext('2d');
              ctx?.putImageData(prev, 0, 0);
              renderCanvas();
          }
      }
  };

  const saveHistoryState = () => {
      if (activeTool === 'brush' && maskCanvasRef.current) {
           const ctx = maskCanvasRef.current.getContext('2d');
           if (!ctx) return;
           const data = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
           setMaskHistory(prev => [...prev, data]);
      } else if (activeTool === 'eraser' && hasOverlay && overlayLayerRef.current) {
           const ctx = overlayLayerRef.current.getContext('2d');
           if (!ctx) return;
           const data = ctx.getImageData(0, 0, overlayLayerRef.current.width, overlayLayerRef.current.height);
           setOverlayHistory(prev => [...prev, data]);
      }
  };

  // --- MOUSE HANDLERS ---
  
  const getMousePos = (e: React.MouseEvent) => {
     const canvas = mainCanvasRef.current;
     if (!canvas) return { x: 0, y: 0 };
     
     const cssWidth = canvas.clientWidth;
     const cssHeight = canvas.clientHeight;
     
     if (cssWidth === 0 || cssHeight === 0) return { x: 0, y: 0 };

     const scaleX = canvas.width / cssWidth;
     const scaleY = canvas.height / cssHeight;

     return {
         x: e.nativeEvent.offsetX * scaleX,
         y: e.nativeEvent.offsetY * scaleY
     };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (previewUrl || activeTool === 'remove_bg') return;
      
      // Save state BEFORE starting drawing for Undo
      if (activeTool === 'brush' || activeTool === 'eraser') {
          saveHistoryState();
      }

      isDraggingRef.current = true;
      const { x, y } = getMousePos(e);
      lastMouseRef.current = { x, y };

      if (activeTool === 'brush') {
          if (!maskCanvasRef.current && mainCanvasRef.current) {
              const mc = document.createElement('canvas');
              mc.width = mainCanvasRef.current.width;
              mc.height = mainCanvasRef.current.height;
              maskCanvasRef.current = mc;
              // Save blank state
              const ctx = mc.getContext('2d');
              if(ctx) setMaskHistory([ctx.getImageData(0,0, mc.width, mc.height)]);
          }
          drawMask(x, y);
      } else if (activeTool === 'eraser' && hasOverlay) {
          eraseOverlay(x, y);
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;
      const { x, y } = getMousePos(e);

      if (activeTool === 'move' && hasOverlay) {
          const dx = x - lastMouseRef.current.x;
          const dy = y - lastMouseRef.current.y;
          setOverlayTransform(prev => ({
              ...prev,
              x: prev.x + dx,
              y: prev.y + dy
          }));
          lastMouseRef.current = { x, y };
      } else if (activeTool === 'brush') {
          drawMask(x, y);
      } else if (activeTool === 'eraser' && hasOverlay) {
          eraseOverlay(x, y);
      }
  };

  const handleMouseUp = () => {
      isDraggingRef.current = false;
      if (activeTool === 'brush') {
         const ctx = maskCanvasRef.current?.getContext('2d');
         ctx?.beginPath(); 
      }
  };

  // --- DRAWING LOGIC ---

  const drawMask = (x: number, y: number) => {
      if (!maskCanvasRef.current) return;
      const ctx = maskCanvasRef.current.getContext('2d');
      if (!ctx) return;

      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
      
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);

      renderCanvas();
  };

  const eraseOverlay = (mouseX: number, mouseY: number) => {
      if (!overlayLayerRef.current) return;
      const ctx = overlayLayerRef.current.getContext('2d');
      if (!ctx) return;

      const canvas = mainCanvasRef.current;
      if(!canvas) return;

      const cx = canvas.width / 2 + overlayTransform.x;
      const cy = canvas.height / 2 + overlayTransform.y;

      let relX = mouseX - cx;
      let relY = mouseY - cy;

      const rad = (-overlayTransform.rotation * Math.PI) / 180;
      const rotX = relX * Math.cos(rad) - relY * Math.sin(rad);
      const rotY = relX * Math.sin(rad) + relY * Math.cos(rad);

      const finalX = rotX / overlayTransform.scale;
      const finalY = rotY / overlayTransform.scale;

      const overlayX = finalX + overlayLayerRef.current.width / 2;
      const overlayY = finalY + overlayLayerRef.current.height / 2;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(overlayX, overlayY, brushSize / 2 / overlayTransform.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      renderCanvas();
  };

  const clearMask = () => {
      if (maskCanvasRef.current) {
          saveHistoryState(); // Save state before clearing
          const ctx = maskCanvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
          renderCanvas();
      }
  };

  // --- API LOGIC ---

  const handleProcess = async (mode: 'inpaint' | 'harmonize' | 'remove_bg') => {
    if (!apiKey) return;
    setIsProcessing(true);
    setError(null);

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const canvas = mainCanvasRef.current;
        if (!canvas) throw new Error("Canvas missing");
        
        // Temporarily clear mask for capture
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Re-draw without mask
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseImageRef.current, 0, 0);
        if (hasOverlay && overlayLayerRef.current) {
            ctx.save();
            ctx.globalAlpha = 1; 
            const cx = canvas.width / 2 + overlayTransform.x;
            const cy = canvas.height / 2 + overlayTransform.y;
            ctx.translate(cx, cy);
            ctx.rotate((overlayTransform.rotation * Math.PI) / 180);
            ctx.scale(overlayTransform.scale, overlayTransform.scale);
            const ox = -overlayLayerRef.current.width / 2;
            const oy = -overlayLayerRef.current.height / 2;
            ctx.drawImage(overlayLayerRef.current, ox, oy);
            ctx.restore();
        }

        const inputBase64 = cleanBase64(canvas.toDataURL('image/png'));
        
        renderCanvas();

        const parts: any[] = [];
        parts.push({ inlineData: { mimeType: 'image/png', data: inputBase64 } });

        if (mode === 'inpaint') {
             if (!maskCanvasRef.current) throw new Error("No mask drawn");
             const maskBase64 = cleanBase64(maskCanvasRef.current.toDataURL('image/png'));
             parts.push({ inlineData: { mimeType: 'image/png', data: maskBase64 } });
             parts.push({ text: `Edit the first image based on the red mask in the second image. Instruction: ${editPrompt}` });
        } else if (mode === 'harmonize') {
             // Harmonize Mode
             parts.push({ text: `The image contains a foreground object composited onto a background. 
             Keep the text, logos, and details of the foreground object EXACTLY as they are. Do not distort text.
             Adjust the lighting, shadows, and color tone of the foreground object to blend naturally with the background environment.
             Fix any slight perspective mismatch if needed, but prioritize text legibility.` });
        } else if (mode === 'remove_bg') {
             // Background Removal (Replacement) Mode
             let prompt = `Change the background of this image to a pure solid white studio background. Isolate the main subject perfectly. `;
             if (keepShadows) {
                 prompt += `IMPORTANT: KEEP the natural cast shadows and contact shadows on the floor/ground to make it look realistic. Do not make it look like a sticker. `;
             } else {
                 prompt += `Remove all shadows. Make it a flat isolated image. `;
             }
             prompt += `Do not alter the product/subject details at all.`;
             parts.push({ text: prompt });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts },
            config: { imageConfig: {} }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                   setPreviewUrl(`data:image/png;base64,${part.inlineData.data}`);
                }
            }
        }

    } catch (e: any) {
        setError(e.message || "Operation failed");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleQuickSave = () => {
     if(!mainCanvasRef.current) return;
     // Redraw canvas without mask (clean composition)
     const canvas = mainCanvasRef.current;
     const ctx = canvas.getContext('2d');
     if (!ctx) return;
     
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     ctx.drawImage(baseImageRef.current, 0, 0);
     if (hasOverlay && overlayLayerRef.current) {
        ctx.save();
        ctx.globalAlpha = opacity;
        const cx = canvas.width / 2 + overlayTransform.x;
        const cy = canvas.height / 2 + overlayTransform.y;
        ctx.translate(cx, cy);
        ctx.rotate((overlayTransform.rotation * Math.PI) / 180);
        ctx.scale(overlayTransform.scale, overlayTransform.scale);
        const ox = -overlayLayerRef.current.width / 2;
        const oy = -overlayLayerRef.current.height / 2;
        ctx.drawImage(overlayLayerRef.current, ox, oy);
        ctx.restore();
     }

     const finalUrl = canvas.toDataURL('image/png');
     onSave(image.id, finalUrl);
  };


  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 px-6 flex justify-between items-center bg-slate-900">
        <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white">Editor & Compositing Studio</h2>
            <button onClick={() => setShowHelp(!showHelp)} className="text-slate-500 hover:text-amber-500"><HelpCircle className="w-5 h-5" /></button>
        </div>
        
        {/* Undo Control in Header */}
        <div className="flex items-center gap-2">
            <button 
                onClick={handleUndo}
                disabled={(activeTool === 'brush' && maskHistory.length === 0) || (activeTool === 'eraser' && overlayHistory.length === 0)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded border border-slate-700 transition-colors text-sm"
                title="Undo (Ctrl+Z)"
            >
                <Undo2 className="w-4 h-4" /> Undo
            </button>
            <div className="h-6 w-px bg-slate-700 mx-2"></div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Canvas Area */}
        <div className="flex-1 bg-black/50 relative flex items-center justify-center p-4 overflow-hidden" ref={containerRef}>
            <div className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl shadow-black">
                {previewUrl ? (
                    // SHOW SLIDER PREVIEW WHEN PROCESSED
                    // Fix: Use aspect-ratio based on image and max-w/h full to prevent overflow
                    <div className="relative max-w-full max-h-full" style={{ aspectRatio: `${image.width}/${image.height}` }}>
                         <BeforeAfterSlider 
                            before={image.url}
                            after={previewUrl} 
                            className="w-full h-full rounded-lg shadow-2xl border border-slate-700 object-contain" 
                         />
                    </div>
                ) : (
                    <canvas
                        ref={mainCanvasRef}
                        className={`max-w-full max-h-full object-contain ${activeTool === 'move' ? 'cursor-move' : 'cursor-crosshair'}`}
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseOut={handleMouseUp}
                        onMouseMove={handleMouseMove}
                    />
                )}
            </div>
            
            {showHelp && (
                <div className="absolute top-4 left-4 z-40 bg-slate-900/90 border border-slate-700 p-4 rounded-xl max-w-sm text-sm text-slate-300 backdrop-blur-md shadow-2xl">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-amber-500 uppercase text-xs">How to use</h4>
                        <button onClick={() => setShowHelp(false)}><X className="w-4 h-4"/></button>
                    </div>
                    <ul className="space-y-2 text-xs">
                        <li className="flex gap-2"><strong className="text-white">1. Add Logo/Overlay:</strong> Upload image using "Overlay / Logo" panel.</li>
                        <li className="flex gap-2"><strong className="text-white">2. Position:</strong> Use <Move className="w-3 h-3 inline"/> tool to resize/rotate.</li>
                        <li className="flex gap-2"><strong className="text-white">3. Quick Save:</strong> Use <Download className="w-3 h-3 inline"/> "Flatten & Save" to save composition directly without AI.</li>
                        <li className="flex gap-2"><strong className="text-white">4. AI Blend:</strong> Click <Wand2 className="w-3 h-3 inline"/> "Harmonize" to let AI fix lighting and shadows.</li>
                    </ul>
                </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-amber-500 font-bold animate-pulse text-lg">AI Processing...</p>
              </div>
            )}
            {error && (
               <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-white px-4 py-2 rounded flex gap-2">
                  <AlertCircle className="w-5 h-5" /> {error}
                  <button onClick={() => setError(null)}><X className="w-4 h-4"/></button>
               </div>
            )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 flex flex-col gap-6 z-10 shadow-xl overflow-y-auto">
            
            {/* Tools */}
            <div className="grid grid-cols-4 gap-2 bg-slate-800 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveTool('brush')}
                  className={`p-2 rounded flex flex-col items-center gap-1 text-[10px] font-bold ${activeTool === 'brush' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <Brush className="w-4 h-4" /> Mask
                </button>
                <button 
                  onClick={() => setActiveTool('move')}
                  disabled={!hasOverlay}
                  className={`p-2 rounded flex flex-col items-center gap-1 text-[10px] font-bold ${activeTool === 'move' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:bg-slate-700 disabled:opacity-30'}`}
                >
                    <Move className="w-4 h-4" /> Move
                </button>
                <button 
                  onClick={() => setActiveTool('eraser')}
                  disabled={!hasOverlay}
                  className={`p-2 rounded flex flex-col items-center gap-1 text-[10px] font-bold ${activeTool === 'eraser' ? 'bg-red-500 text-white' : 'text-slate-400 hover:bg-slate-700 disabled:opacity-30'}`}
                >
                    <Eraser className="w-4 h-4" /> Erase
                </button>
                <button 
                  onClick={() => setActiveTool('remove_bg')}
                  className={`p-2 rounded flex flex-col items-center gap-1 text-[10px] font-bold ${activeTool === 'remove_bg' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <Scissors className="w-4 h-4" /> BG
                </button>
            </div>

            {/* CONTEXTUAL PANELS */}
            
            {/* 1. Remove Background Panel */}
            {activeTool === 'remove_bg' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-xl">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Scissors className="w-4 h-4 text-purple-400" /> Auto Remove BG
                        </h3>
                        
                        <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700 cursor-pointer hover:border-purple-500/50 transition-colors mb-4">
                            <input 
                                type="checkbox" 
                                checked={keepShadows} 
                                onChange={(e) => setKeepShadows(e.target.checked)}
                                className="w-4 h-4 rounded bg-slate-950 border-slate-600 text-purple-500 focus:ring-purple-500"
                            />
                            <div>
                                <span className="text-xs font-bold text-white block flex items-center gap-1"><Sun className="w-3 h-3"/> Keep Shadows</span>
                                <span className="text-[10px] text-slate-400">Preserve natural floor shadows</span>
                            </div>
                        </label>
                        
                        <button 
                            onClick={() => handleProcess('remove_bg')}
                            disabled={isProcessing || !apiKey}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                        >
                            <Ghost className="w-4 h-4" /> Replace Background
                        </button>
                        <p className="text-[10px] text-slate-500 mt-2 text-center">
                            Replaces background with pure white studio backdrop.
                        </p>
                    </div>
                </div>
            )}

            {/* 2. Brush Settings Panel */}
            {activeTool === 'brush' && (
                <div className="space-y-3 p-4 bg-slate-950/50 rounded-xl border border-slate-800 animate-fade-in">
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>Brush Size</span>
                        <span>{brushSize}px</span>
                    </div>
                    <input 
                    type="range" min="5" max="200" 
                    value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                    />
                    <button onClick={clearMask} className="text-xs text-red-400 hover:text-red-300 w-full text-right">Clear Mask</button>
                </div>
            )}

            {/* 3. Overlay Settings Panel (Shared for Move/Eraser/Overlay mode) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-300 uppercase">Overlay / Logo</h3>
                </div>

                {!hasOverlay ? (
                    <div className="flex flex-col gap-3">
                         <div className="flex gap-2">
                            <button 
                                onClick={() => overlayInputRef.current?.click()}
                                className="flex-1 text-[10px] bg-slate-800 text-slate-300 px-3 py-2 rounded border border-slate-700 hover:border-white hover:text-white flex items-center justify-center gap-2 transition-colors"
                            >
                                <Upload className="w-3 h-3" /> From PC
                            </button>
                            <button 
                                onClick={() => setPickerOpen(true)}
                                className="flex-1 text-[10px] bg-blue-500/10 text-blue-500 px-3 py-2 rounded border border-blue-500/20 hover:border-blue-500 flex items-center justify-center gap-2 transition-colors"
                            >
                                <FolderSearch className="w-3 h-3" /> From Gallery
                            </button>
                         </div>
                         <div className="p-4 border-2 border-dashed border-slate-700 rounded-xl text-center flex flex-col items-center gap-2">
                            <span className="text-xs text-slate-500">No logo/image selected</span>
                        </div>
                        <input type="file" ref={overlayInputRef} hidden accept="image/*" onChange={handleOverlayFileChange} />
                    </div>
                ) : (
                    <div className="space-y-3 p-4 bg-slate-800 rounded-xl border border-slate-700">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Opacity</span>
                            <span>{Math.round(opacity * 100)}%</span>
                        </div>
                        <input 
                           type="range" min="0" max="1" step="0.05"
                           value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))}
                           className="w-full h-1 bg-slate-600 rounded appearance-none cursor-pointer accent-blue-500"
                        />
                        
                        <div className="flex justify-between text-xs text-slate-400 mt-2">
                            <span>Scale</span>
                            <span>{overlayTransform.scale.toFixed(1)}x</span>
                        </div>
                        <div className="flex gap-2 items-center">
                             <button onClick={() => setOverlayTransform(p => ({...p, scale: Math.max(0.1, p.scale - 0.1)}))} className="p-1 bg-slate-700 rounded"><Minimize className="w-3 h-3"/></button>
                             <input 
                                type="range" min="0.1" max="3" step="0.1"
                                value={overlayTransform.scale} onChange={(e) => setOverlayTransform(p => ({...p, scale: parseFloat(e.target.value)}))}
                                className="flex-1 h-1 bg-slate-600 rounded appearance-none cursor-pointer accent-blue-500"
                             />
                             <button onClick={() => setOverlayTransform(p => ({...p, scale: p.scale + 0.1}))} className="p-1 bg-slate-700 rounded"><Maximize className="w-3 h-3"/></button>
                        </div>

                        <div className="flex justify-between text-xs text-slate-400 mt-2">
                            <span>Rotation</span>
                            <span>{overlayTransform.rotation}°</span>
                        </div>
                         <input 
                                type="range" min="-180" max="180" step="5"
                                value={overlayTransform.rotation} onChange={(e) => setOverlayTransform(p => ({...p, rotation: parseFloat(e.target.value)}))}
                                className="w-full h-1 bg-slate-600 rounded appearance-none cursor-pointer accent-blue-500"
                         />
                        
                        <button onClick={() => { setHasOverlay(false); overlayLayerRef.current = null; renderCanvas(); }} className="w-full mt-2 py-1 text-xs text-red-400 hover:bg-slate-700 rounded">
                             Remove Layer
                        </button>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="mt-auto space-y-3">
                {activeTool === 'brush' && (
                    <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="Describe changes for mask area..."
                        className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white resize-y focus:border-amber-500 outline-none min-h-[5rem]"
                        disabled={!!previewUrl}
                    />
                )}

                {!previewUrl ? (
                    <div className="flex flex-col gap-2">
                        {/* AI Actions Row */}
                        <div className="grid grid-cols-2 gap-2">
                            {activeTool === 'brush' && (
                                <button 
                                    onClick={() => handleProcess('inpaint')}
                                    disabled={isProcessing || !apiKey}
                                    className="col-span-2 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                                >
                                    <Brush className="w-4 h-4" /> Inpaint (Mask)
                                </button>
                            )}
                            
                            {hasOverlay && (
                                <button 
                                    onClick={() => handleProcess('harmonize')}
                                    disabled={isProcessing || !apiKey}
                                    className="col-span-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                                >
                                    <Wand2 className="w-4 h-4" /> AI Harmonize
                                </button>
                            )}
                        </div>
                        {/* Quick Save Row */}
                        <button 
                            onClick={handleQuickSave}
                            disabled={isProcessing}
                            className="py-2 bg-slate-700 hover:bg-white hover:text-black text-slate-200 rounded-lg font-bold text-xs flex items-center justify-center gap-2 border border-slate-600 transition-colors"
                        >
                            <Download className="w-4 h-4" /> Flatten & Quick Save (No AI)
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                         <button 
                            onClick={() => { setPreviewUrl(null); }}
                            className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                        >
                            <RotateCcw className="w-4 h-4 inline mr-2" /> Retry
                        </button>
                        <button 
                            onClick={() => onSave(image.id, previewUrl)}
                            className="py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-colors"
                        >
                            <Check className="w-4 h-4 inline mr-2" /> Save
                        </button>
                    </div>
                )}
            </div>

        </div>

        <GalleryPicker 
            isOpen={pickerOpen} 
            onClose={() => setPickerOpen(false)} 
            images={images}
            onSelect={handleSelectOverlay}
        />

      </div>
    </div>
  );
};

export default ImageEditor;