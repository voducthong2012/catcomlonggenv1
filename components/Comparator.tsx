
import React, { useState, useRef } from 'react';
import { Upload, X, ArrowRightLeft, MoveHorizontal, FolderSearch, Download } from 'lucide-react';
import { blobToBase64 } from '../utils';
import { GeneratedImage } from '../types';
import GalleryPicker from './GalleryPicker';

interface Props {
  onClose: () => void;
  images: GeneratedImage[];
}

const Comparator: React.FC<Props> = ({ onClose, images }) => {
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  
  // Gallery Picker State
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'before' | 'after'>('before');

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'before' | 'after') => {
      if (e.target.files && e.target.files[0]) {
          const base64 = await blobToBase64(e.target.files[0]);
          if (target === 'before') setBeforeImage(base64);
          else setAfterImage(base64);
      }
  };

  const openPicker = (target: 'before' | 'after') => {
      setPickerTarget(target);
      setShowPicker(true);
  };

  const handlePickerSelect = (url: string) => {
      if (pickerTarget === 'before') setBeforeImage(url);
      else setAfterImage(url);
  };

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
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

  const swapImages = () => {
      const temp = beforeImage;
      setBeforeImage(afterImage);
      setAfterImage(temp);
  };

  return (
    <div className="flex h-full w-full bg-slate-950 flex-col">
       {/* Header */}
       <div className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <ArrowRightLeft className="w-5 h-5 text-amber-500" />
             <h1 className="text-lg font-bold text-white">Before / After Comparator</h1>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
             <X className="w-5 h-5" />
          </button>
       </div>

       {/* Content */}
       <div className="flex-1 flex flex-col p-6 overflow-hidden">
          
          {/* Controls */}
          <div className="flex justify-center gap-8 mb-4">
              {/* Before Control */}
              <div className="flex gap-2">
                  <button onClick={() => beforeInputRef.current?.click()} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 flex items-center gap-2">
                      <Upload className="w-3 h-3" /> Upload Before
                  </button>
                  <button onClick={() => openPicker('before')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 flex items-center gap-2">
                      <FolderSearch className="w-3 h-3" /> Select Before
                  </button>
                  <input ref={beforeInputRef} type="file" hidden accept="image/*" onChange={(e) => handleUpload(e, 'before')} />
              </div>

               <button onClick={swapImages} className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-full">
                  <ArrowRightLeft className="w-4 h-4" />
               </button>

              {/* After Control */}
              <div className="flex gap-2">
                  <button onClick={() => afterInputRef.current?.click()} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 flex items-center gap-2">
                      <Upload className="w-3 h-3" /> Upload After
                  </button>
                  <button onClick={() => openPicker('after')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 flex items-center gap-2">
                      <FolderSearch className="w-3 h-3" /> Select After
                  </button>
                  <input ref={afterInputRef} type="file" hidden accept="image/*" onChange={(e) => handleUpload(e, 'after')} />
              </div>
          </div>

          {/* Viewer */}
          <div className="flex-1 flex items-center justify-center relative bg-black/40 rounded-xl border border-slate-800 overflow-hidden">
             
             {(!beforeImage && !afterImage) && (
                 <div className="text-center text-slate-600">
                     <ArrowRightLeft className="w-12 h-12 mx-auto mb-2 opacity-20" />
                     <p>Select two images to compare</p>
                 </div>
             )}

             {(beforeImage || afterImage) && (
                 <div 
                    ref={containerRef}
                    className="relative max-h-full max-w-full aspect-[4/3] cursor-ew-resize select-none overflow-hidden shadow-2xl"
                    style={{ height: '90%' }}
                    onMouseMove={(e) => { if (e.buttons === 1) handleSliderMove(e) }}
                    onTouchMove={handleSliderMove}
                    onClick={handleSliderMove}
                 >
                    {/* Background (After) */}
                    {afterImage ? (
                        <img src={afterImage} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="After"/>
                    ) : (
                        <div className="absolute inset-0 w-full h-full bg-slate-900 flex items-center justify-center text-slate-700 font-bold">NO AFTER IMAGE</div>
                    )}

                    {/* Foreground (Before) - Clipped */}
                    <div className="absolute inset-0 w-full h-full" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                        {beforeImage ? (
                            <img src={beforeImage} className="w-full h-full object-contain pointer-events-none" alt="Before"/>
                        ) : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-600 font-bold">NO BEFORE IMAGE</div>
                        )}
                         <div className="absolute top-4 left-4 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded border border-white/20">BEFORE</div>
                    </div>
                    
                    <div className="absolute top-4 right-4 bg-amber-600/80 text-white text-xs font-bold px-2 py-1 rounded border border-white/20">AFTER</div>

                    {/* Handle */}
                    <div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10" style={{ left: `${sliderPos}%` }}>
                        <div className="absolute top-1/2 -translate-y-1/2 -left-4 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-800 shadow-xl border border-slate-300">
                            <MoveHorizontal size={16} />
                        </div>
                    </div>
                 </div>
             )}
          </div>
       </div>

       <GalleryPicker 
         isOpen={showPicker}
         onClose={() => setShowPicker(false)}
         images={images}
         onSelect={handlePickerSelect}
       />
    </div>
  );
};

export default Comparator;
