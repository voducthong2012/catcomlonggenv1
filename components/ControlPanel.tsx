import React, { useRef, useState, useEffect } from 'react';
import { Wand2, Upload, X, Info, Sliders, Image as ImageIcon, Key, CloudLightning, ShieldCheck, CheckCircle2, Box, Layers, Maximize, FolderSearch, Palette, Plus, Hash, Loader2, Activity, Book, Save, Trash2, ArrowRight, ExternalLink, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { GenerationSettings, AspectRatio, ImageSize, GeneratedImage, SavedPrompt } from '../types';
import { blobToBase64, getDimensions, generateId } from '../utils';
import GalleryPicker from './GalleryPicker';
import { GoogleGenAI } from "@google/genai";

interface Props {
  settings: GenerationSettings;
  onSettingsChange: (newSettings: GenerationSettings) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  useCloudKey: boolean;
  setUseCloudKey: (use: boolean) => void;
  images: GeneratedImage[];
}

const ControlPanel: React.FC<Props> = ({ 
  settings, 
  onSettingsChange, 
  onGenerate, 
  isGenerating,
  apiKey,
  setApiKey,
  useCloudKey,
  setUseCloudKey,
  images
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const [activeDragZone, setActiveDragZone] = useState<'ref' | 'target' | null>(null);
  const [cloudKeySelected, setCloudKeySelected] = useState(false);
  const [isCustomRatio, setIsCustomRatio] = useState(false);
  
  // Key Visibility
  const [showKey, setShowKey] = useState(false);

  // Gallery Picker State
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'target' | 'ref'>('target');

  // Color Picker State
  const [tempColor, setTempColor] = useState('#000000');

  // AI Prompt & Library State
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  
  // Save Prompt UI State
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [newPromptTitle, setNewPromptTitle] = useState('');

  // Check initial state
  useEffect(() => {
    // Only enable Cloud Key mode if explicitly available in environment (e.g. IDX)
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      window.aistudio.hasSelectedApiKey().then(hasKey => {
         if(hasKey) {
             setCloudKeySelected(true);
             // Don't auto-force cloud key, let user choose, but show it's available
         }
      });
    } else {
        // Default to Manual Mode if not in IDX/AI Studio environment
        setUseCloudKey(false);
    }
  }, []);

  // Load Saved Prompts
  useEffect(() => {
    const saved = localStorage.getItem('catcom_prompts');
    if (saved) {
      try {
        setSavedPrompts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load prompts");
      }
    }
  }, []);

  // Check custom ratio state on load
  useEffect(() => {
     const knownRatios = Object.values(AspectRatio);
     if (!knownRatios.includes(settings.aspectRatio as AspectRatio)) {
         setIsCustomRatio(true);
     } else {
         setIsCustomRatio(false);
     }
  }, [settings.aspectRatio]);

  const handleCloudKeySelect = async () => {
     if(window.aistudio) {
        try {
            await window.aistudio.openSelectKey();
            setCloudKeySelected(true);
            setUseCloudKey(true);
        } catch(e) {
            console.error(e);
        }
     }
  };

  const handleChange = (field: keyof GenerationSettings, value: any) => {
    const newSettings = { ...settings, [field]: value };
    
    // Update dimensions if ratio changes
    if (field === 'aspectRatio') {
       const dims = getDimensions(value);
       newSettings.width = dims.width;
       newSettings.height = dims.height;
    }

    onSettingsChange(newSettings);
  };

  const handleRatioSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === 'custom') {
          setIsCustomRatio(true);
      } else {
          setIsCustomRatio(false);
          handleChange('aspectRatio', val);
      }
  };

  const handleFileDrop = async (e: React.DragEvent, type: 'ref' | 'target') => {
    e.preventDefault();
    setActiveDragZone(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files, type);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'ref' | 'target') => {
    if (e.target.files) {
      processFiles(e.target.files, type);
    }
  };

  const processFiles = async (files: FileList, type: 'ref' | 'target') => {
    const newImages: string[] = [];
    for (let i = 0; i < Math.min(files.length, 4); i++) {
      const base64 = await blobToBase64(files[i]);
      newImages.push(base64);
    }
    addImageToSettings(newImages, type);
  };

  const addImageToSettings = (newImages: string[], type: 'ref' | 'target') => {
    const currentList = type === 'target' ? (settings.targetImages || []) : settings.refImages;
    const updated = [...currentList, ...newImages].slice(0, 4);
    handleChange(type === 'target' ? 'targetImages' : 'refImages', updated);
  };

  const removeImage = (index: number, type: 'ref' | 'target') => {
    const currentList = type === 'target' ? (settings.targetImages || []) : settings.refImages;
    const updated = currentList.filter((_, i) => i !== index);
    handleChange(type === 'target' ? 'targetImages' : 'refImages', updated);
  };

  const openGalleryPicker = (mode: 'target' | 'ref') => {
      setPickerMode(mode);
      setShowPicker(true);
  };

  // Color Palette Handlers
  const commitColor = () => {
      // Validate Hex
      const regex = /^#([0-9A-F]{3}){1,2}$/i;
      if(!regex.test(tempColor)) return;

      const current = settings.colorPalette || [];
      if(!current.includes(tempColor)) {
          handleChange('colorPalette', [...current, tempColor]);
      }
  };

  const removeColor = (color: string) => {
      const current = settings.colorPalette || [];
      handleChange('colorPalette', current.filter(c => c !== color));
  };

  // --- AI PROMPT ENHANCER ---
  const handleEnhancePrompt = async () => {
    if (!settings.prompt) return;
    
    const currentKey = useCloudKey ? process.env.API_KEY : apiKey;
    if (!currentKey) {
        alert("Please enter your API Key first to use this feature.");
        return;
    }

    setIsEnhancing(true);
    try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        // Use flash for speed/cost efficiency
        const response = await ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: `Rewrite the following image generation prompt to be more detailed, descriptive, and artistic. Include details about lighting, texture, and composition. Keep it concise but potent. Output ONLY the prompt text, no intro/outro. IMPORTANT: Detect the language of the Original Prompt and generate the response IN THAT SAME LANGUAGE. Original Prompt: "${settings.prompt}"`
        });
        
        const enhanced = response.text ? response.text.trim() : "";
        if (enhanced) {
            handleChange('prompt', enhanced);
        }
    } catch (e) {
        console.error("Enhance failed", e);
        alert("Failed to enhance prompt. Check your API Key or quota.");
    } finally {
        setIsEnhancing(false);
    }
  };

  // --- PROMPT LIBRARY HANDLERS ---
  const handleStartSavePrompt = () => {
    if (!settings.prompt) return;
    setNewPromptTitle(settings.prompt.slice(0, 25)); // Pre-fill with snippet
    setIsSavingPrompt(true);
    setShowPromptLibrary(true);
  };
  
  // FIX: Update existing prompts functionality
  const handleEditSavedPrompt = (prompt: SavedPrompt) => {
      // 1. Load data
      handleChange('prompt', prompt.prompt);
      if(prompt.negativePrompt) handleChange('negativePrompt', prompt.negativePrompt);
      
      // 2. Set UI to 'Edit Mode' (re-use save mode but with existing data)
      setNewPromptTitle(prompt.title);
      setIsSavingPrompt(true);
      setShowPromptLibrary(true); // Ensure library is open
  };

  const handleConfirmSavePrompt = () => {
    if (!newPromptTitle.trim()) return;

    // Remove existing with same title to avoid duplicates if user intends to update
    const filtered = savedPrompts.filter(p => p.title !== newPromptTitle.trim());

    const newSaved: SavedPrompt = {
       id: generateId(),
       title: newPromptTitle.trim(),
       prompt: settings.prompt,
       negativePrompt: settings.negativePrompt,
       createdAt: Date.now()
    };
    
    try {
        const updated = [newSaved, ...filtered];
        setSavedPrompts(updated);
        localStorage.setItem('catcom_prompts', JSON.stringify(updated));
        
        // Reset UI
        setIsSavingPrompt(false);
        setNewPromptTitle('');
    } catch (e) {
        alert("Failed to save to local storage (Storage might be full)");
    }
  };

  const handleCancelSavePrompt = () => {
      setIsSavingPrompt(false);
      setNewPromptTitle('');
  };

  const handleLoadPrompt = (saved: SavedPrompt) => {
     handleChange('prompt', saved.prompt);
     if(saved.negativePrompt) handleChange('negativePrompt', saved.negativePrompt);
     setShowPromptLibrary(false);
  };

  const handleDeletePrompt = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     if(!confirm("Delete this saved prompt?")) return;
     
     // FIX: Directly filter state
     const updated = savedPrompts.filter(p => p.id !== id);
     setSavedPrompts(updated); // Update State immediately
     localStorage.setItem('catcom_prompts', JSON.stringify(updated)); // Sync Storage
  };


  return (
    <div className="w-80 bg-slate-900/90 backdrop-blur-xl border-r border-slate-800 overflow-y-auto h-full flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-amber-500" />
          Parameters
        </h2>
      </div>

      <div className="p-4 space-y-6 flex-1">
        
        {/* API Key Selection */}
        <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800">
           <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                    <Key className="w-3 h-3" /> API Key (Required)
                </label>
                {/* Connection Toggle (Hidden if window.aistudio is missing to reduce confusion) */}
                {window.aistudio && (
                    <button 
                        onClick={() => setUseCloudKey(!useCloudKey)} 
                        className="text-[10px] text-amber-500 hover:text-amber-400 underline"
                    >
                        {useCloudKey ? "Switch to Manual" : "Switch to Google Project"}
                    </button>
                )}
           </div>
           
           {useCloudKey ? (
               <div className="text-center animate-fade-in">
                   {cloudKeySelected ? (
                        <div className="flex items-center justify-center gap-2 text-green-400 text-sm py-2 bg-green-900/20 rounded-lg border border-green-900/50">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Project Connected</span>
                            <button onClick={handleCloudKeySelect} className="text-xs underline ml-2 opacity-50 hover:opacity-100">Change</button>
                        </div>
                   ) : (
                       <button 
                        onClick={handleCloudKeySelect}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500 text-white text-xs rounded-lg flex items-center justify-center gap-2 transition-all"
                       >
                         <CloudLightning className="w-3 h-3 text-amber-500" />
                         Connect Google Cloud Project
                       </button>
                   )}
                   <p className="text-[10px] text-slate-500 mt-2">Using quota from your selected Google Cloud Project.</p>
               </div>
           ) : (
                <div className="space-y-2 animate-fade-in relative">
                    <input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value.trim())}
                        placeholder="Paste Gemini API Key here..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 pr-10 text-sm text-slate-300 focus:border-amber-500 focus:outline-none transition-colors"
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-2">
                         {apiKey.length > 30 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                         <button onClick={() => setShowKey(!showKey)} className="text-slate-500 hover:text-white">
                             {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                         </button>
                    </div>
                </div>
           )}
        </div>

        {/* Prompt Section with Tools */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
              <label className="text-xs font-semibold text-slate-400 uppercase">Positive Prompt</label>
              <div className="flex gap-1">
                  <button 
                    onClick={() => { setShowPromptLibrary(!showPromptLibrary); setIsSavingPrompt(false); }}
                    className={`p-1.5 rounded transition-colors ${showPromptLibrary ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    title="Prompt Library"
                  >
                      <Book className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancing || !settings.prompt}
                    className="p-1.5 bg-slate-800 hover:bg-purple-600 text-purple-400 hover:text-white rounded transition-colors disabled:opacity-50"
                    title="AI Enhance Prompt"
                  >
                      {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  </button>
              </div>
          </div>

          <div className="relative">
             <textarea
                value={settings.prompt}
                onChange={(e) => handleChange('prompt', e.target.value)}
                placeholder="Describe your masterpiece..."
                className="w-full h-28 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none transition-colors resize-y min-h-[7rem]"
             />
             <button 
               onClick={handleStartSavePrompt} 
               disabled={!settings.prompt}
               className="absolute bottom-2 right-2 p-1 bg-slate-800/80 hover:bg-green-600 text-slate-400 hover:text-white rounded backdrop-blur-sm transition-colors disabled:opacity-30 disabled:hover:bg-slate-800"
               title="Save to Library"
             >
                 <Save className="w-3 h-3" />
             </button>
          </div>
          
          {/* Prompt Library Dropdown */}
          {showPromptLibrary && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 space-y-2 animate-in slide-in-from-top-2 shadow-xl">
                  <div className="text-xs font-bold text-slate-500 uppercase px-1 pb-1 border-b border-slate-800 flex justify-between items-center">
                      <span>Saved Prompts</span>
                      <button onClick={() => setShowPromptLibrary(false)}><X className="w-3 h-3"/></button>
                  </div>
                  
                  {/* SAVE MODE */}
                  {isSavingPrompt ? (
                      <div className="p-2 bg-slate-950 rounded border border-amber-500/50 mb-2">
                          <label className="text-[10px] uppercase font-bold text-amber-500 block mb-1">Name this prompt</label>
                          <input 
                              value={newPromptTitle} 
                              onChange={e => setNewPromptTitle(e.target.value)}
                              className="w-full bg-slate-900 text-xs text-white p-1.5 rounded border border-slate-700 mb-2 focus:border-amber-500 outline-none"
                              placeholder="E.g. Cyberpunk City..."
                              autoFocus
                              onKeyDown={e => e.key === 'Enter' && handleConfirmSavePrompt()}
                          />
                          <div className="flex gap-2">
                              <button onClick={handleConfirmSavePrompt} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold py-1.5 rounded transition-colors">Save / Update</button>
                              <button onClick={handleCancelSavePrompt} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold py-1.5 rounded transition-colors">Cancel</button>
                          </div>
                      </div>
                  ) : (
                      // LIST MODE
                      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                          {savedPrompts.length === 0 ? (
                              <p className="text-[10px] text-slate-500 text-center py-2">No saved prompts.</p>
                          ) : (
                              savedPrompts.map(p => (
                                  <div key={p.id} className="group flex items-center justify-between p-2 rounded hover:bg-slate-800 cursor-pointer" onClick={() => handleLoadPrompt(p)}>
                                      <div className="overflow-hidden flex-1 mr-2">
                                          <p className="text-xs font-bold text-slate-300 truncate">{p.title}</p>
                                          <p className="text-[10px] text-slate-500 truncate">{p.prompt}</p>
                                      </div>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleEditSavedPrompt(p); }} 
                                            className="text-slate-500 hover:text-white p-1"
                                            title="Edit/Update"
                                          >
                                            <ArrowRight className="w-3 h-3"/>
                                          </button>
                                          <button 
                                            onClick={(e) => handleDeletePrompt(p.id, e)} 
                                            className="text-slate-500 hover:text-red-500 p-1"
                                            title="Delete"
                                          >
                                            <Trash2 className="w-3 h-3"/>
                                          </button>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  )}
              </div>
          )}
        </div>

        {/* Negative Prompt */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase">Negative Prompt</label>
          <textarea
            value={settings.negativePrompt}
            onChange={(e) => handleChange('negativePrompt', e.target.value)}
            placeholder="What to exclude (e.g. blurry, low quality)..."
            className="w-full h-16 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:border-red-500/50 focus:outline-none transition-colors resize-y min-h-[4rem]"
          />
        </div>

        {/* Color Palette Reference */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
             <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                <Palette className="w-3 h-3 text-pink-500" /> Color Reference
             </label>
             
             {/* New Color Picker Input Group */}
             <div className="flex gap-2 items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
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
                    onClick={commitColor}
                    className="p-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded transition-colors"
                    title="Add Color"
                 >
                     <Plus className="w-4 h-4" />
                 </button>
             </div>
             
             {settings.colorPalette && settings.colorPalette.length > 0 ? (
                 <div className="flex flex-wrap gap-2">
                     {settings.colorPalette.map((color, idx) => (
                         <div key={idx} className="flex items-center gap-2 bg-slate-950 rounded-full px-2 py-1 border border-slate-700 animate-fade-in">
                             <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                             <span className="text-[10px] font-mono text-slate-400">{color}</span>
                             <button onClick={() => removeColor(color)} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                         </div>
                     ))}
                 </div>
             ) : (
                 <p className="text-[10px] text-slate-600 italic pl-1">No colors added yet.</p>
             )}
        </div>

        {/* Target Images */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex justify-between items-center">
             <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                <Box className="w-3 h-3 text-amber-500" /> Target Images
             </label>
             <div className="flex items-center gap-2">
                 <button onClick={() => openGalleryPicker('target')} className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 hover:border-amber-500">
                    <FolderSearch className="w-3 h-3" /> From Gallery
                 </button>
                 <span className="text-xs text-slate-600">{(settings.targetImages || []).length}/4</span>
             </div>
          </div>
          
          <div 
            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-colors cursor-pointer h-24 ${
              activeDragZone === 'target' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-950'
            }`}
            onDragEnter={(e) => { e.preventDefault(); setActiveDragZone('target'); }}
            onDragLeave={(e) => { e.preventDefault(); setActiveDragZone(null); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleFileDrop(e, 'target')}
            onClick={() => targetInputRef.current?.click()}
          >
            <Box className="w-6 h-6 text-slate-500 mb-1" />
            <span className="text-xs text-slate-500 font-medium text-center">Upload Target Product/Model</span>
            <input 
              ref={targetInputRef}
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => handleFileSelect(e, 'target')}
            />
          </div>

          {(settings.targetImages || []).length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {(settings.targetImages || []).map((img, idx) => (
                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700">
                  <img src={img} alt="Target" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => removeImage(idx, 'target')}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-amber-500/80 text-[8px] text-center text-white font-bold py-0.5">TARGET</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reference Images */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex justify-between items-center">
             <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                <ImageIcon className="w-3 h-3 text-blue-500" /> Reference / Style
             </label>
             <div className="flex items-center gap-2">
                 <button onClick={() => openGalleryPicker('ref')} className="text-[10px] text-blue-500 hover:text-blue-400 flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 hover:border-blue-500">
                    <FolderSearch className="w-3 h-3" /> From Gallery
                 </button>
                 <span className="text-xs text-slate-600">{settings.refImages.length}/4</span>
             </div>
          </div>
          
          <div 
            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-colors cursor-pointer h-24 ${
              activeDragZone === 'ref' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-950'
            }`}
            onDragEnter={(e) => { e.preventDefault(); setActiveDragZone('ref'); }}
            onDragLeave={(e) => { e.preventDefault(); setActiveDragZone(null); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleFileDrop(e, 'ref')}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-6 h-6 text-slate-500 mb-1" />
            <span className="text-xs text-slate-500 font-medium">Upload Style Reference</span>
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => handleFileSelect(e, 'ref')}
            />
          </div>

          {settings.refImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {settings.refImages.map((img, idx) => (
                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700">
                  <img src={img} alt="Ref" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => removeImage(idx, 'ref')}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-blue-500/80 text-[8px] text-center text-white font-bold py-0.5">STYLE</div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Sliders: Strength & Batch */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
           {/* Image Strength */}
           <div className="space-y-2">
             <div className="flex justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1"><Sliders className="w-3 h-3"/> Style Strength</span>
                <span>{settings.imageStrength}</span>
             </div>
             <input 
               type="range" 
               min="0" max="1" step="0.05"
               value={settings.imageStrength}
               onChange={(e) => handleChange('imageStrength', parseFloat(e.target.value))}
               className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
             />
           </div>

           {/* Batch Count */}
           <div className="space-y-2">
             <div className="flex justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1"><Layers className="w-3 h-3"/> Number of Images</span>
                <span>{settings.numImages}</span>
             </div>
             <input 
               type="range" 
               min="1" max="4" step="1"
               value={settings.numImages}
               onChange={(e) => handleChange('numImages', parseInt(e.target.value))}
               className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
             />
           </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">Ratio</label>
            <select
              value={isCustomRatio ? 'custom' : settings.aspectRatio}
              onChange={handleRatioSelectChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:border-amber-500 outline-none"
            >
              {Object.values(AspectRatio).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
            
            {isCustomRatio && (
                <input 
                   type="text" 
                   value={settings.aspectRatio}
                   onChange={(e) => handleChange('aspectRatio', e.target.value)}
                   placeholder="e.g. 21:9"
                   className="w-full bg-slate-800 border border-amber-500/50 rounded-lg p-2 text-xs text-white focus:outline-none"
                />
            )}
          </div>
          
           {/* Resolution / Size */}
           <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
               <Maximize className="w-3 h-3" /> Size
            </label>
            <select
              value={settings.imageSize}
              onChange={(e) => handleChange('imageSize', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:border-amber-500 outline-none"
            >
              <option value="1K">1K (1024px)</option>
              <option value="2K">2K (2048px)</option>
              <option value="4K">4K (UHD)</option>
            </select>
          </div>

           <div className="space-y-2 col-span-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">Model</label>
            <select
              value={settings.model}
              onChange={(e) => handleChange('model', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:border-amber-500 outline-none"
            >
              <option value="gemini-3-pro-image-preview">Gemini 3.0 Pro</option>
              <option value="gemini-2.5-flash-image">Gemini 2.5 Flash</option>
            </select>
          </div>
        </div>

      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <button
          onClick={onGenerate}
          disabled={!settings.prompt || (!useCloudKey && !apiKey) || isGenerating}
          className={`w-full py-3 rounded-xl font-bold text-white shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 transition-all
            ${(!useCloudKey && !apiKey) || isGenerating
              ? 'bg-slate-700 cursor-not-allowed opacity-90' 
              : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-[0.98]'
            }`}
        >
            {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Queue...</span>
                </>
            ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>Generate</span>
                </>
            )}
        </button>
      </div>

      <GalleryPicker 
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        images={images}
        onSelect={(url) => addImageToSettings([url], pickerMode)}
      />

    </div>
  );
};

export default ControlPanel;