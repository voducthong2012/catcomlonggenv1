

import React, { useState, useRef } from 'react';
import { X, Layers, Zap, Image as ImageIcon, Plus, Trash2, Box, FolderSearch, Palette, Hash } from 'lucide-react';
import { blobToBase64, generateId } from '../utils';
import { BatchStyle, BatchTask, ImageSize, GeneratedImage, AspectRatio } from '../types';
import GalleryPicker from './GalleryPicker';

const STYLES: BatchStyle[] = [
  { id: 'cyberpunk', name: 'Cyberpunk City', description: 'Neon lights, futuristic, rainy', color: 'from-pink-600 to-purple-600' },
  { id: 'studio', name: 'Studio White', description: 'Clean, minimal, professional lighting', color: 'from-slate-400 to-slate-200' },
  { id: 'nature', name: 'Deep Forest', description: 'Moss, sunlight, organic textures', color: 'from-green-600 to-emerald-400' },
  { id: 'luxury', name: 'Luxury Marble', description: 'Gold accents, black marble, elegant', color: 'from-yellow-600 to-amber-400' },
  { id: 'pastel', name: 'Pastel Dream', description: 'Soft colors, dreamy, clouds', color: 'from-blue-300 to-pink-300' },
  { id: 'industrial', name: 'Industrial Concrete', description: 'Raw concrete, shadows, urban', color: 'from-gray-600 to-slate-500' },
];

interface CustomStyleInput {
  id: string;
  prompt: string;
  refImage: string | null;
}

interface Props {
    onBack: () => void;
    apiKey?: string;
    onSaveToGallery: (task: BatchTask) => void;
    images: GeneratedImage[];
    // New Props for Global Queue
    onAddToQueue: (tasks: BatchTask[]) => void;
    onShowNotification: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

const BatchStudio: React.FC<Props> = ({ onBack, apiKey, onSaveToGallery, images, onAddToQueue, onShowNotification }) => {
  // Config State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customRefInputRef = useRef<HTMLInputElement>(null);
  
  // Gallery Picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerContext, setPickerContext] = useState<'target' | { customStyleId: string }>('target');

  // Step 1: Target Images (Products/Models)
  const [targetImages, setTargetImages] = useState<string[]>([]); // Base64s

  // Step 2: Styles
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]); // Preset IDs
  const [customStyles, setCustomStyles] = useState<CustomStyleInput[]>([]);
  const [activeCustomStyleId, setActiveCustomStyleId] = useState<string | null>(null);

  // Settings
  const [batchCount, setBatchCount] = useState(4);
  const [denoise, setDenoise] = useState(0.6);
  const [randomSeed, setRandomSeed] = useState(true);
  const [globalColors, setGlobalColors] = useState<string[]>([]); 
  const [tempColor, setTempColor] = useState('#000000'); 

  // New Settings: Size & Ratio
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [isCustomRatio, setIsCustomRatio] = useState(false);

  // Handlers
  const handleTargetFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages: string[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const base64 = await blobToBase64(e.target.files[i]);
        newImages.push(base64);
      }
      setTargetImages([...targetImages, ...newImages]);
    }
  };

  const removeTargetImage = (index: number) => {
    setTargetImages(targetImages.filter((_, i) => i !== index));
  };

  const toggleStyle = (id: string) => {
    if (selectedStyles.includes(id)) {
      setSelectedStyles(selectedStyles.filter(s => s !== id));
    } else {
      setSelectedStyles([...selectedStyles, id]);
    }
  };

  // Custom Style Handlers
  const addCustomStyle = () => {
    setCustomStyles([...customStyles, { id: generateId(), prompt: '', refImage: null }]);
  };

  const updateCustomStyle = (id: string, field: keyof CustomStyleInput, value: string | null) => {
    setCustomStyles(customStyles.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeCustomStyle = (id: string) => {
    setCustomStyles(customStyles.filter(s => s.id !== id));
  };

  const handleCustomRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activeCustomStyleId) {
       const base64 = await blobToBase64(e.target.files[0]);
       updateCustomStyle(activeCustomStyleId, 'refImage', base64);
       setActiveCustomStyleId(null);
    }
  };

  const triggerCustomRefUpload = (id: string) => {
    setActiveCustomStyleId(id);
    customRefInputRef.current?.click();
  };

  const handleGallerySelection = (url: string) => {
      if (pickerContext === 'target') {
          setTargetImages([...targetImages, url]);
      } else {
          updateCustomStyle(pickerContext.customStyleId, 'refImage', url);
      }
  };

  const addColor = () => {
     const regex = /^#([0-9A-F]{3}){1,2}$/i;
     if(!regex.test(tempColor)) return;
     if(!globalColors.includes(tempColor)) setGlobalColors([...globalColors, tempColor]);
  };
  
  const removeColor = (color: string) => {
     setGlobalColors(globalColors.filter(c => c !== color));
  };

  const handleAddToGlobalQueue = () => {
    if (targetImages.length === 0 || (selectedStyles.length === 0 && customStyles.filter(s => s.prompt).length === 0)) return;
    if (!apiKey) {
        onShowNotification("Please connect API Key in Studio first", 'error');
        return;
    }

    const newTasks: BatchTask[] = [];
    const timestamp = Date.now();
    
    // 1. Tasks for Presets
    targetImages.forEach(img => {
      selectedStyles.forEach(styleId => {
        const styleName = STYLES.find(s => s.id === styleId)?.name || 'Unknown Style';
        for(let i=0; i<batchCount; i++) {
           newTasks.push({
             id: generateId(),
             type: 'IMAGE_GEN',
             status: 'PENDING',
             progress: 0,
             refImage: img,
             styleName: styleName,
             createdAt: timestamp,
             payload: {
                refImages: [img], // Use target as ref for style transfer context
                prompt: styleName, // Preset name as prompt seed
                styleId: styleId,
                isPreset: true,
                imageSize,
                aspectRatio,
                denoise
             }
           });
        }
      });

      // 2. Tasks for Custom Styles
      customStyles.forEach(style => {
        if (!style.prompt) return;
        for(let i=0; i<batchCount; i++) {
            newTasks.push({
                id: generateId(),
                type: 'IMAGE_GEN',
                status: 'PENDING',
                progress: 0,
                refImage: img, // Target image as thumb
                styleName: `Custom: ${style.prompt.substring(0, 15)}...`,
                createdAt: timestamp,
                payload: {
                    refImages: [img],
                    styleRefImage: style.refImage,
                    prompt: style.prompt,
                    isPreset: false,
                    imageSize,
                    aspectRatio,
                    denoise
                }
            });
        }
      });
    });

    onAddToQueue(newTasks);
    onShowNotification(`Success! Added ${newTasks.length} tasks to Global Queue.`, 'success');
    
    // Optional: Reset selections
    // setTargetImages([]);
  };

  const handleRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === 'custom') {
          setIsCustomRatio(true);
      } else {
          setIsCustomRatio(false);
          setAspectRatio(val);
      }
  };

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 font-sans">
      
      {/* Left Panel: Configuration */}
      <div className="w-96 flex flex-col border-r border-slate-800 bg-slate-900/50">
         <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <Layers className="w-6 h-6 text-amber-500" />
               Batch Config
            </h2>
            <p className="text-xs text-slate-500 mt-1">Configure automated bulk generation.</p>
         </div>

         <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* Step 1: Target Images */}
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                   <div className="flex items-center gap-2 text-amber-500 font-bold text-sm uppercase tracking-wider">
                      <div className="w-6 h-6 rounded-full border border-amber-500 flex items-center justify-center text-xs">1</div>
                      Target Images
                   </div>
                   <button 
                     onClick={() => { setPickerContext('target'); setShowPicker(true); }}
                     className="text-[10px] text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 hover:border-amber-500"
                   >
                        <FolderSearch className="w-3 h-3" /> Select from Gallery
                   </button>
               </div>
               
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-900 cursor-pointer transition-colors group"
               >
                  <Box className="w-8 h-8 text-slate-500 mb-2 group-hover:text-amber-500 transition-colors" />
                  <span className="text-sm text-slate-400 group-hover:text-slate-200">Upload Target Subjects</span>
                  <span className="text-[10px] text-slate-600">Max 10 images</span>
                  <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*" onChange={handleTargetFileSelect} />
               </div>

               {targetImages.length > 0 && (
                 <div className="grid grid-cols-4 gap-2">
                    {targetImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded overflow-hidden group border border-slate-700">
                         <img src={img} className="w-full h-full object-cover" alt="target"/>
                         <button onClick={() => removeTargetImage(idx)} className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all">
                           <X className="w-3 h-3" />
                         </button>
                         <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-center text-slate-300 py-0.5">TARGET</div>
                      </div>
                    ))}
                 </div>
               )}
            </div>

            {/* Step 2: Styles */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 text-amber-500 font-bold text-sm uppercase tracking-wider">
                  <div className="w-6 h-6 rounded-full border border-amber-500 flex items-center justify-center text-xs">2</div>
                  Select or Create Styles
               </div>
               
               {/* Preset Styles */}
               <div className="grid grid-cols-2 gap-3">
                  {STYLES.map(style => (
                    <div 
                      key={style.id}
                      onClick={() => toggleStyle(style.id)}
                      className={`cursor-pointer rounded-lg p-3 border transition-all ${
                        selectedStyles.includes(style.id) 
                        ? 'border-amber-500 bg-amber-500/10' 
                        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                      }`}
                    >
                       <div className={`h-12 rounded-md bg-gradient-to-r ${style.color} mb-2 opacity-80`} />
                       <h4 className="text-xs font-bold text-white">{style.name}</h4>
                    </div>
                  ))}
               </div>

               {/* Divider */}
               <div className="relative py-2">
                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                 <div className="relative flex justify-center"><span className="bg-slate-900/50 px-2 text-xs text-slate-500 uppercase">OR CUSTOM</span></div>
               </div>

               {/* Custom Styles */}
               <div className="space-y-3">
                  {customStyles.map((style, index) => (
                    <div key={style.id} className="flex gap-2 items-start animate-fade-in">
                       <div className="flex-1 space-y-2">
                          <textarea 
                             placeholder="Enter custom prompt / style description..." 
                             className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-amber-500 outline-none resize-y h-16 min-h-[4rem]"
                             value={style.prompt}
                             onChange={(e) => updateCustomStyle(style.id, 'prompt', e.target.value)}
                          />
                          {style.refImage && (
                             <div className="relative w-full h-16 rounded-lg overflow-hidden border border-slate-700">
                                <img src={style.refImage} alt="Style Ref" className="w-full h-full object-cover opacity-60" />
                                <button onClick={() => updateCustomStyle(style.id, 'refImage', null)} className="absolute top-1 right-1 bg-black/50 p-1 rounded-full hover:bg-red-500">
                                   <X className="w-3 h-3" />
                                </button>
                                <span className="absolute bottom-1 left-2 text-[8px] font-bold text-white uppercase shadow-sm">Style Ref</span>
                             </div>
                          )}
                       </div>
                       <div className="flex flex-col gap-2">
                           <div className="flex flex-col gap-1">
                                <button 
                                    onClick={() => triggerCustomRefUpload(style.id)}
                                    className={`p-2 rounded-lg border transition-colors ${style.refImage ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                                    title="Upload Style Reference Image"
                                >
                                    <ImageIcon className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => { setPickerContext({ customStyleId: style.id }); setShowPicker(true); }}
                                    className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-blue-400 hover:border-blue-400 transition-colors"
                                    title="Select Ref from Gallery"
                                >
                                    <FolderSearch className="w-4 h-4" />
                                </button>
                           </div>
                          <button 
                             onClick={() => removeCustomStyle(style.id)}
                             className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-500 transition-colors mt-auto"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={addCustomStyle}
                    className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-xs text-slate-400 hover:text-amber-500 hover:border-amber-500 transition-all flex items-center justify-center gap-2"
                  >
                     <Plus className="w-3 h-3" /> Add Custom Style
                  </button>
                  
                  <input ref={customRefInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomRefUpload} />
               </div>
            </div>
            
            {/* Color Palette */}
            <div className="space-y-4 border-t border-slate-800 pt-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-pink-500 font-bold text-sm uppercase tracking-wider">
                        <Palette className="w-4 h-4" /> Color Guide
                    </div>
                </div>
                
                 {/* Picker Group */}
                 <div className="flex gap-2 items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
                     <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-600 shrink-0">
                         <input 
                            type="color" 
                            value={tempColor}
                            onChange={(e) => setTempColor(e.target.value)}
                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 m-0"
                         />
                     </div>
                     <div className="flex items-center gap-1 flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
                        <Hash className="w-3 h-3 text-slate-500" />
                        <input 
                            type="text" 
                            value={tempColor}
                            onChange={(e) => setTempColor(e.target.value)}
                            className="w-full bg-transparent text-xs text-white outline-none font-mono uppercase"
                            placeholder="#000000"
                            maxLength={7}
                        />
                     </div>
                     <button 
                        onClick={addColor}
                        className="p-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded transition-colors"
                        title="Add Color"
                     >
                         <Plus className="w-4 h-4" />
                     </button>
                 </div>

                {globalColors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {globalColors.map((color, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-950 rounded-full px-2 py-1 border border-slate-700">
                                <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                                <span className="text-[10px] font-mono text-slate-400">{color}</span>
                                <button onClick={() => removeColor(color)} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[10px] text-slate-600 italic">No global color palette active.</p>
                )}
            </div>

            {/* Step 3: Settings */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 text-amber-500 font-bold text-sm uppercase tracking-wider">
                  <div className="w-6 h-6 rounded-full border border-amber-500 flex items-center justify-center text-xs">3</div>
                  Settings
               </div>
               
               <div className="bg-slate-900 rounded-lg p-4 space-y-4 border border-slate-800">
                  {/* Batch Count */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Variations per Style</span>
                      <span>{batchCount}</span>
                    </div>
                    <input type="range" min="1" max="10" value={batchCount} onChange={(e) => setBatchCount(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500" />
                  </div>

                  {/* Size & Ratio Grid */}
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Size</label>
                        <select
                          value={imageSize}
                          onChange={(e) => setImageSize(e.target.value as ImageSize)}
                          className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:border-amber-500 outline-none"
                        >
                          <option value="1K">1K</option>
                          <option value="2K">2K</option>
                          <option value="4K">4K</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Ratio</label>
                        <select
                            value={isCustomRatio ? 'custom' : aspectRatio}
                            onChange={handleRatioChange}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:border-amber-500 outline-none"
                        >
                            {Object.values(AspectRatio).map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                            <option value="custom">Custom...</option>
                        </select>
                      </div>
                  </div>
                  
                  {isCustomRatio && (
                     <div>
                        <label className="text-xs text-amber-500 mb-1 block">Custom Ratio (W:H)</label>
                        <input 
                           type="text"
                           value={aspectRatio}
                           onChange={(e) => setAspectRatio(e.target.value)}
                           placeholder="e.g. 21:9"
                           className="w-full bg-slate-800 border border-amber-500/50 rounded p-1.5 text-xs text-white focus:outline-none"
                        />
                     </div>
                  )}

                  {/* Creativity */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Creativity (Denoise)</span>
                      <span>{denoise}</span>
                    </div>
                    <input type="range" min="0.1" max="1.0" step="0.1" value={denoise} onChange={(e) => setDenoise(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500" />
                  </div>

                  {/* Seed */}
                  <div className="flex items-center gap-2">
                     <input type="checkbox" checked={randomSeed} onChange={(e) => setRandomSeed(e.target.checked)} className="rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-amber-500" />
                     <span className="text-xs text-slate-300">Randomize Seed</span>
                  </div>
               </div>
            </div>

         </div>

         {/* Action */}
         <div className="p-6 border-t border-slate-800 bg-slate-900 z-10">
            <button 
              onClick={handleAddToGlobalQueue}
              disabled={targetImages.length === 0 || (selectedStyles.length === 0 && customStyles.filter(s => s.prompt).length === 0)}
              className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-xl shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              ADD TO GLOBAL QUEUE
            </button>
            <p className="text-[10px] text-center text-slate-500 mt-2">
               Estimated tasks: {targetImages.length * (selectedStyles.length + customStyles.filter(s => s.prompt).length) * batchCount} images
            </p>
         </div>
      </div>

      {/* Right Panel: Placeholder (Visual Only - real logic in Global Manager) */}
      <div className="flex-1 flex flex-col bg-slate-950 relative items-center justify-center p-10 text-center">
         <Box className="w-24 h-24 text-slate-800 mb-4" />
         <h3 className="text-2xl font-bold text-slate-700">Batch Configuration Mode</h3>
         <p className="text-slate-500 mt-2 max-w-md">
            Configure your batch jobs on the left and click "Add to Global Queue". 
            <br/>You can manage running tasks via the <strong>Job Manager</strong> icon in the top toolbar.
         </p>
      </div>

      <GalleryPicker 
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        images={images}
        onSelect={handleGallerySelection}
      />
    </div>
  );
};

export default BatchStudio;