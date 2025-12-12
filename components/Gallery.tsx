

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Download, Trash2, Calendar, Search, Pencil, FolderInput, Check, Upload, X, ChevronLeft, ChevronRight, Edit2, Info, Layers, Maximize, Cpu, Video, Copy, SplitSquareHorizontal, MoveHorizontal, ArrowRightLeft, ZoomIn, ZoomOut, Play, Clock } from 'lucide-react';
import { GeneratedImage, Category } from '../types';
import { formatDate } from '../utils';
import Comparator from './Comparator';

interface Props {
  images: GeneratedImage[];
  categories: Category[];
  selectedCategoryId: string | null;
  onDelete: (id: string) => void;
  onSelectImage: (image: GeneratedImage) => void; // Just sets active, doesn't force edit
  onEditImage: (image: GeneratedImage) => void; // Opens Editor
  onRenameImage: (id: string, newName: string) => void;
  onMoveImage: (id: string, newCategoryId: string) => void;
  onUploadImage: (file: File) => void;
  onAnimateImage?: (image: GeneratedImage) => void; // New prop for Video
  onMakeVariations?: (image: GeneratedImage) => void; // New prop for Variations
}

// --- Internal Component: Before/After Slider ---
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
            onMouseMove={(e) => { if (e.buttons === 1) handleMove(e) }} // Only drag if clicked
            onClick={handleMove} // Jump to click
            onTouchMove={handleMove}
        >
            {/* After Image (Background) */}
            <img src={after} className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none" alt="After" />
            
            {/* Before Image (Foreground, Clipped) */}
            <div 
                className="absolute inset-0 w-full h-full"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
                <img src={before} className="w-full h-full object-contain select-none pointer-events-none" alt="Before" />
                
                {/* Label Badge Left */}
                <div className="absolute top-4 left-4 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20">
                    BEFORE
                </div>
            </div>

            {/* Label Badge Right (on After image layer logic visually) */}
            <div className="absolute top-4 right-4 bg-amber-600/80 text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20">
                AFTER
            </div>

            {/* Slider Handle */}
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


const Gallery: React.FC<Props> = ({ 
  images, 
  categories, 
  selectedCategoryId, 
  onDelete, 
  onSelectImage,
  onEditImage,
  onRenameImage,
  onMoveImage,
  onUploadImage,
  onAnimateImage,
  onMakeVariations
}) => {
  const [filterText, setFilterText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Renaming State
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  // Moving State
  const [movingId, setMovingId] = useState<string | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>('default');

  // Lightbox State
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isComparing, setIsComparing] = useState(false); 
  
  // Zoom & Pan State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  
  // Manual Comparator Modal State (New Feature)
  const [showComparator, setShowComparator] = useState(false);

  // Filter Logic
  const filteredImages = useMemo(() => {
    let filtered = images;

    if (selectedCategoryId && selectedCategoryId !== 'all') {
      filtered = filtered.filter(img => img.categoryId === selectedCategoryId);
    }

    if (filterText) {
      const lower = filterText.toLowerCase();
      filtered = filtered.filter(img => 
        (img.name || img.prompt).toLowerCase().includes(lower) || 
        formatDate(img.createdAt).toLowerCase().includes(lower)
      );
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [images, selectedCategoryId, filterText]);

  // Lightbox Navigation Logic
  const activeLightboxImage = useMemo(() => {
     return filteredImages.find(img => img.id === lightboxId);
  }, [lightboxId, filteredImages]);

  // Find Parent Image for comparison
  const parentImage = useMemo(() => {
      if (!activeLightboxImage?.parentId) return null;
      return images.find(img => img.id === activeLightboxImage.parentId);
  }, [activeLightboxImage, images]);

  useEffect(() => {
      // Reset Zoom on image change
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
  }, [lightboxId]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!lightboxId) return;

          if (e.key === 'Escape') setLightboxId(null);
          
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              const idx = filteredImages.findIndex(img => img.id === lightboxId);
              if (idx === -1) return;

              if (e.key === 'ArrowLeft' && idx > 0) {
                  setLightboxId(filteredImages[idx - 1].id);
                  setIsComparing(false); // Reset compare on change
              } else if (e.key === 'ArrowRight' && idx < filteredImages.length - 1) {
                  setLightboxId(filteredImages[idx + 1].id);
                  setIsComparing(false);
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxId, filteredImages]);

  const handleNext = (e?: React.MouseEvent) => {
     e?.stopPropagation();
     const idx = filteredImages.findIndex(img => img.id === lightboxId);
     if (idx !== -1 && idx < filteredImages.length - 1) {
         setLightboxId(filteredImages[idx + 1].id);
         setIsComparing(false);
     }
  };

  const handlePrev = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const idx = filteredImages.findIndex(img => img.id === lightboxId);
      if (idx > 0) {
          setLightboxId(filteredImages[idx - 1].id);
          setIsComparing(false);
      }
   };

  // Zoom Handlers
  const updateZoom = (newZoom: number) => {
      const clampedZoom = Math.min(Math.max(1, newZoom), 8); // Increased max zoom to 8x
      setZoomLevel(clampedZoom);
      // If we zoom back out to 100%, reset the pan position
      if (clampedZoom <= 1.05) {
          setZoomLevel(1);
          setPanPosition({ x: 0, y: 0 });
      }
  };

  const handleZoom = (delta: number) => {
      updateZoom(zoomLevel + delta);
  };
  
  const handleWheelZoom = (e: React.WheelEvent) => {
      if (activeLightboxImage?.contentType === 'video') return;

      // Trackpad pinch usually fires ctrlKey + wheel
      // Normal mouse wheel usually fires without ctrlKey
      // We handle both for convenience in the lightbox
      
      // Prevent default page scrolling if possible, though React synthetic events might bubble
      // e.stopPropagation(); 
      
      // Calculate sensitivity based on input type
      // Trackpads send small deltas with high frequency. Mouse wheels send larger deltas.
      // e.ctrlKey suggests a pinch gesture (on many browsers)
      
      const sensitivity = e.ctrlKey ? -0.01 : -0.002;
      const delta = e.deltaY * sensitivity;

      // Apply zoom
      updateZoom(zoomLevel + delta);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (activeLightboxImage?.contentType === 'video') return;

      if (zoomLevel > 1.1) {
          // Reset
          setZoomLevel(1);
          setPanPosition({ x: 0, y: 0 });
      } else {
          // Zoom In
          setZoomLevel(3);
      }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (zoomLevel > 1) {
          setIsDragging(true);
          dragStartRef.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y };
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
          e.preventDefault();
          setPanPosition({
              x: e.clientX - dragStartRef.current.x,
              y: e.clientY - dragStartRef.current.y
          });
      }
  };

  const handleMouseUp = () => {
      setIsDragging(false);
  };

  // Autocomplete Suggestions
  const suggestions = useMemo(() => {
    if (!filterText) return [];
    return images
      .filter(img => (img.name || img.prompt).toLowerCase().includes(filterText.toLowerCase()))
      .slice(0, 5);
  }, [filterText, images]);

  const handleStartRename = (e: React.MouseEvent, img: GeneratedImage) => {
    e.stopPropagation();
    setRenamingId(img.id);
    setTempName(img.name || img.prompt);
  };

  const handleSaveRename = () => {
    if (renamingId && tempName.trim()) {
        onRenameImage(renamingId, tempName.trim());
    }
    setRenamingId(null);
  };

  const handleStartMove = (e: React.MouseEvent, img: GeneratedImage) => {
      e.stopPropagation();
      setMovingId(img.id);
      setTargetFolderId(img.categoryId);
  };

  const handleExecuteMove = () => {
      if (movingId) {
          onMoveImage(movingId, targetFolderId);
          setMovingId(null);
      }
  };
  
  const handleUploadClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onUploadImage(e.target.files[0]);
      }
  };

  // Helper to render category options with indentation
  const renderCategoryOptions = (parentId: string | null = null, depth = 0) => {
      const cats = categories.filter(c => c.parentId === (parentId || undefined) || (parentId === null && !c.parentId));
      return cats.map(c => (
          <React.Fragment key={c.id}>
              <option value={c.id}>
                  {'\u00A0'.repeat(depth * 3)} {depth > 0 ? '└ ' : ''}{c.name}
              </option>
              {renderCategoryOptions(c.id, depth + 1)}
          </React.Fragment>
      ));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative">
      {/* Toolbar */}
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <div>
           <h2 className="text-2xl font-bold text-white">Gallery</h2>
           <p className="text-slate-400 text-sm mt-1">
             {selectedCategoryId === 'all' ? 'All Assets' : categories.find(c => c.id === selectedCategoryId)?.name} 
             {' • '}{filteredImages.length} items
           </p>
        </div>
        
        <div className="flex items-center gap-3">
            {/* Compare Tool Button */}
            <button 
                onClick={() => setShowComparator(true)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm font-bold border border-slate-700 transition-colors"
                title="Open Image Comparator"
            >
                <ArrowRightLeft className="w-4 h-4" /> Compare
            </button>

            {/* Upload Button */}
            <button 
                onClick={handleUploadClick}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-bold transition-colors"
            >
                <Upload className="w-4 h-4" /> Upload
            </button>
            <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*,video/mp4" 
                className="hidden" 
                onChange={handleFileChange} 
            />

            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500" />
              <input 
                type="text" 
                placeholder="Search images..." 
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-full text-sm text-white focus:border-amber-500 focus:outline-none w-64 transition-all focus:w-80"
              />
              {/* Autocomplete Dropdown */}
              {filterText && suggestions.length > 0 && (
                 <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
                    {suggestions.map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => { setFilterText(s.name || s.prompt); }}
                          className="px-4 py-2 hover:bg-slate-800 cursor-pointer flex items-center gap-2"
                        >
                            <img src={s.url} className="w-6 h-6 rounded object-cover" alt="thumb"/>
                            <span className="text-xs text-slate-300 truncate">{s.name || s.prompt}</span>
                        </div>
                    ))}
                 </div>
              )}
            </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredImages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Search className="w-12 h-12 opacity-20 mb-4" />
            <p>No images found in this view.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredImages.map((image) => (
              <div key={image.id} className="group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-amber-500/50 transition-all hover:shadow-xl hover:shadow-amber-900/10 flex flex-col">
                
                {/* Image Area */}
                <div className="aspect-square relative cursor-pointer overflow-hidden bg-black" onClick={() => setLightboxId(image.id)}>
                   {image.contentType === 'video' ? (
                       <>
                        <video src={image.url} className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-black/50 p-3 rounded-full border border-white/20 backdrop-blur-sm">
                                <Play className="w-6 h-6 text-white fill-white" />
                            </div>
                        </div>
                        <div className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white font-bold border border-white/10">
                            VIDEO
                        </div>
                       </>
                   ) : (
                        <img 
                            src={image.url} 
                            alt={image.prompt} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" 
                            loading="lazy"
                        />
                   )}
                  
                  {/* Hover Overlay Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                     <div className="flex justify-end gap-1">
                        <button 
                            onClick={(e) => handleStartMove(e, image)}
                            className="p-1.5 bg-slate-700/80 hover:bg-blue-500 text-white rounded backdrop-blur-md"
                            title="Move to folder"
                        >
                            <FolderInput className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={(e) => handleStartRename(e, image)}
                            className="p-1.5 bg-slate-700/80 hover:bg-amber-500 text-white rounded backdrop-blur-md"
                            title="Rename"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                     </div>
                     
                     <div className="flex justify-end gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}
                            className="p-1.5 bg-red-500/20 hover:bg-red-500 text-white rounded backdrop-blur-md"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <a 
                            href={image.url} 
                            download={`${image.name || 'image'}.${image.contentType === 'video' ? 'mp4' : 'jpg'}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-white/20 hover:bg-white hover:text-black text-white rounded backdrop-blur-md"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </a>
                     </div>
                  </div>
                </div>
                
                {/* Info Footer */}
                <div className="p-3 border-t border-slate-800 bg-slate-900/50 flex-1 flex flex-col justify-between">
                   {renamingId === image.id ? (
                      <div className="flex items-center gap-1">
                          <input 
                            autoFocus
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-slate-800 text-xs text-white px-1 py-0.5 rounded border border-amber-500 focus:outline-none"
                          />
                          <button onClick={(e) => { e.stopPropagation(); handleSaveRename(); }} className="text-green-500"><Check className="w-3 h-3"/></button>
                      </div>
                   ) : (
                      <p className="text-xs text-slate-200 font-medium line-clamp-2 mb-1" title={image.name || image.prompt}>
                        {image.name || image.prompt}
                      </p>
                   )}
                   
                   <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                     <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(image.createdAt).toLocaleDateString()}</span>
                     <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{image.width}x{image.height}</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPARATOR MODAL OVERLAY */}
      {showComparator && (
         <div className="fixed inset-0 z-50 bg-slate-950 animate-fade-in flex flex-col">
             <Comparator onClose={() => setShowComparator(false)} images={images} />
         </div>
      )}

      {/* LIGHTBOX OVERLAY */}
      {activeLightboxImage && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col animate-fade-in" onClick={() => setLightboxId(null)}>
              
              {/* Top Bar */}
              <div className="h-16 px-6 flex justify-between items-center bg-black/40 backdrop-blur-sm z-20 border-b border-white/5" onClick={e => e.stopPropagation()}>
                  <div className="text-white">
                      <h3 className="font-bold text-lg">{activeLightboxImage.name || activeLightboxImage.prompt}</h3>
                      <p className="text-xs text-slate-400">Created: {formatDate(activeLightboxImage.createdAt)}</p>
                  </div>
                  <div className="flex gap-3 items-center">
                      
                      {/* Compare Button */}
                      {parentImage && activeLightboxImage.contentType !== 'video' && (
                         <button 
                           onClick={() => setIsComparing(!isComparing)}
                           className={`p-2 rounded-full flex items-center gap-2 px-4 transition-colors ${isComparing ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
                           title="Compare with Original"
                         >
                            <SplitSquareHorizontal className="w-5 h-5" />
                            <span className="text-xs font-bold">{isComparing ? 'Comparing' : 'Compare'}</span>
                         </button>
                      )}

                      <button 
                        onClick={() => setShowInfo(!showInfo)}
                        className={`p-2 rounded-full transition-colors ${showInfo ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
                        title="Image Info"
                      >
                         <Info className="w-5 h-5" />
                      </button>
                       {/* Video Button */}
                       {onAnimateImage && activeLightboxImage.contentType !== 'video' && (
                          <button 
                            onClick={() => onAnimateImage(activeLightboxImage)}
                            className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-full"
                            title="Create Video (Animate)"
                          >
                             <Video className="w-5 h-5" />
                          </button>
                       )}
                       {/* Variations Button */}
                       {onMakeVariations && activeLightboxImage.contentType !== 'video' && (
                          <button 
                            onClick={() => onMakeVariations(activeLightboxImage)}
                            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center gap-2"
                            title="Make Variations"
                          >
                             <Copy className="w-5 h-5" />
                          </button>
                       )}
                      
                      {activeLightboxImage.contentType !== 'video' && (
                          <button 
                            onClick={() => onEditImage(activeLightboxImage)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold"
                          >
                             <Edit2 className="w-4 h-4" /> Edit in Studio
                          </button>
                      )}

                      <button onClick={() => setLightboxId(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white">
                         <X className="w-6 h-6" />
                      </button>
                  </div>
              </div>

              {/* Main Content (Image + Info Panel) */}
              <div className="flex-1 flex overflow-hidden relative" onClick={e => e.stopPropagation()}>
                  
                  {/* Left Nav */}
                  <button 
                    onClick={handlePrev} 
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-4 hover:bg-white/10 rounded-full text-white transition-colors z-20"
                  >
                      <ChevronLeft className="w-8 h-8" />
                  </button>

                  {/* Image Container */}
                  <div className={`flex-1 flex items-center justify-center p-4 transition-all duration-300 relative overflow-hidden ${showInfo ? 'mr-80' : ''}`} onClick={() => setLightboxId(null)}>
                     
                     {isComparing && parentImage ? (
                        <div className="w-full h-full max-h-[80vh] max-w-[90vw] flex items-center justify-center" onClick={e => e.stopPropagation()}>
                            <BeforeAfterSlider before={parentImage.url} after={activeLightboxImage.url} className="rounded-lg shadow-2xl" />
                        </div>
                     ) : (
                        <div 
                           className="relative w-full h-full flex items-center justify-center overflow-hidden" 
                           onClick={(e) => {e.stopPropagation();}}
                           onWheel={handleWheelZoom}
                           onDoubleClick={handleDoubleClick}
                           onMouseDown={handleMouseDown}
                           onMouseMove={handleMouseMove}
                           onMouseUp={handleMouseUp}
                           onMouseLeave={handleMouseUp}
                        >
                             {activeLightboxImage.contentType === 'video' ? (
                                <video 
                                    src={activeLightboxImage.url} 
                                    controls 
                                    autoPlay 
                                    className="max-h-[80vh] w-auto max-w-[90vw] shadow-2xl rounded-sm"
                                />
                             ) : (
                                <img 
                                    src={activeLightboxImage.url} 
                                    className="max-h-[80vh] w-auto max-w-[90vw] object-contain shadow-2xl rounded-sm transition-transform duration-75 cursor-move" 
                                    alt="Lightbox View"
                                    style={{ 
                                        transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
                                        cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                                    }}
                                    draggable={false}
                                />
                             )}

                             {/* Zoom Controls Overlay - MOVED TO BOTTOM RIGHT */}
                             {activeLightboxImage.contentType !== 'video' && !isComparing && (
                                 <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-4 py-2 border border-white/10 z-30 shadow-xl" onClick={e => e.stopPropagation()}>
                                     <button onClick={() => handleZoom(-0.5)} className="text-white hover:text-amber-500"><ZoomOut className="w-5 h-5"/></button>
                                     <div className="w-24 h-1 bg-slate-600 rounded-full overflow-hidden">
                                         <div className="h-full bg-amber-500" style={{ width: `${(zoomLevel - 1) / 7 * 100}%` }}></div>
                                     </div>
                                     <button onClick={() => handleZoom(0.5)} className="text-white hover:text-amber-500"><ZoomIn className="w-5 h-5"/></button>
                                     <span className="text-xs font-mono text-slate-300 min-w-[3ch] text-right">{Math.round(zoomLevel * 100)}%</span>
                                 </div>
                             )}
                        </div>
                     )}
                     
                  </div>

                  {/* Right Nav */}
                  <button 
                    onClick={handleNext}
                    className={`absolute top-1/2 -translate-y-1/2 p-4 hover:bg-white/10 rounded-full text-white transition-colors z-20 ${showInfo ? 'right-84' : 'right-4'}`}
                  >
                      <ChevronRight className="w-8 h-8" />
                  </button>

                  {/* Info Sidebar */}
                  <div 
                    className={`absolute top-0 right-0 bottom-0 w-80 bg-slate-900 border-l border-slate-700 p-6 overflow-y-auto transform transition-transform duration-300 z-30 shadow-2xl ${showInfo ? 'translate-x-0' : 'translate-x-full'}`}
                  >
                      <div className="space-y-6">
                          <h4 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Details</h4>
                          
                          <div className="space-y-1">
                             <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Maximize className="w-3 h-3" /> Dimensions
                             </label>
                             <p className="text-slate-200 text-sm font-mono">{activeLightboxImage.width} x {activeLightboxImage.height}</p>
                          </div>

                          <div className="space-y-1">
                             <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Cpu className="w-3 h-3" /> Model
                             </label>
                             <p className="text-slate-200 text-sm font-mono">{activeLightboxImage.model || 'Unknown'}</p>
                          </div>

                          {/* GEN TIME DISPLAY */}
                          {activeLightboxImage.generationTime && (
                              <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                      <Clock className="w-3 h-3" /> Gen Duration
                                  </label>
                                  <p className="text-amber-400 text-sm font-mono font-bold">
                                      {(activeLightboxImage.generationTime / 1000).toFixed(2)}s
                                  </p>
                              </div>
                          )}

                          <div className="space-y-1">
                             <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Layers className="w-3 h-3" /> Category
                             </label>
                             <p className="text-slate-200 text-sm">{categories.find(c => c.id === activeLightboxImage.categoryId)?.name || 'General'}</p>
                          </div>

                          <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-500 uppercase">Positive Prompt</label>
                             <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-40 overflow-y-auto">
                                {activeLightboxImage.prompt}
                             </div>
                          </div>

                          {activeLightboxImage.negativePrompt && (
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-red-500/70 uppercase">Negative Prompt</label>
                                <div className="bg-slate-950 p-3 rounded-lg border border-red-900/20 text-xs text-slate-400 leading-relaxed">
                                    {activeLightboxImage.negativePrompt}
                                </div>
                             </div>
                          )}
                          
                          {/* Relationship Info */}
                          {parentImage && (
                              <div className="pt-4 border-t border-slate-800">
                                   <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Edited From:</p>
                                   <div className="flex items-center gap-2 bg-slate-950 p-2 rounded">
                                        <img src={parentImage.url} className="w-8 h-8 rounded object-cover opacity-50" alt="parent"/>
                                        <span className="text-xs text-slate-400 truncate">{parentImage.name || parentImage.prompt}</span>
                                   </div>
                              </div>
                          )}

                          <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-600 text-center">
                              ID: {activeLightboxImage.id}
                          </div>
                      </div>
                  </div>
              </div>

              {/* Bottom Info Bar */}
              <div className="h-14 border-t border-slate-800 bg-black/60 backdrop-blur flex items-center justify-center gap-6 text-slate-300 z-20" onClick={e => e.stopPropagation()}>
                  <span className="text-sm">{filteredImages.findIndex(i => i.id === lightboxId) + 1} / {filteredImages.length}</span>
                  <a href={activeLightboxImage.url} download className="hover:text-white flex items-center gap-2"><Download className="w-4 h-4"/> Download</a>
              </div>
          </div>
      )}

      {/* Move Modal Overlay */}
      {movingId && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-lg font-bold text-white mb-4">Move Image</h3>
                  <div className="mb-4">
                      <label className="text-xs text-slate-400 uppercase font-bold mb-2 block">Select Destination Folder</label>
                      <select 
                        value={targetFolderId}
                        onChange={(e) => setTargetFolderId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-amber-500 outline-none"
                      >
                         <option value="default">General (Root)</option>
                         {renderCategoryOptions(null)}
                      </select>
                  </div>
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setMovingId(null)}
                        className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleExecuteMove}
                        className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors"
                      >
                          Move
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Gallery;
