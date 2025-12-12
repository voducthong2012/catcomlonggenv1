import React, { useState, useEffect, useRef } from 'react';
import { Category, GeneratedImage, GenerationSettings, AppView, BatchTask, AspectRatio } from './types';
import { generateId, getDimensions, cleanBase64, blobToBase64, exportDataToJson, importDataFromJson, saveToLocalFolder, saveSingleImageToFolder, retryOperation, wait, RateLimitTracker } from './utils';
import { 
  initDB, getAllImages, getAllCategories, saveImageToDB, saveCategoryToDB, 
  deleteImageFromDB, deleteCategoryFromDB, bulkSaveImages, bulkSaveCategories, clearDatabase,
  persistStorage 
} from './db';
import CategorySidebar from './components/CategorySidebar';
import ControlPanel from './components/ControlPanel';
import Gallery from './components/Gallery';
import ImageEditor from './components/ImageEditor';
import BatchStudio from './components/BatchStudio';
import VideoStudio from './components/VideoStudio';
import HelpGuide from './components/HelpGuide';
import ProgressOverlay from './components/ProgressOverlay';
import JobManager from './components/JobManager';
import APIMonitor from './components/APIMonitor';
import { Download, Trash2, Edit, Sparkles, LayoutGrid, HelpCircle, Save, X, FolderOpen, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Video, Clapperboard, Activity, Zap } from 'lucide-react';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'default', name: 'General', parentId: null },
];

const DEFAULT_SETTINGS: GenerationSettings = {
  prompt: '',
  negativePrompt: '',
  aspectRatio: '1:1',
  width: 1024,
  height: 1024,
  numImages: 1,
  imageStrength: 0.35,
  imageSize: '1K',
  model: 'gemini-2.5-flash-image', // Changed default to Flash to avoid Quota Limit 0 errors
  targetImages: [],
  refImages: [],
  colorPalette: [],
};

// -- Creation Success Modal Component --
interface CreationModalProps {
  images: GeneratedImage[];
  categories: Category[];
  onSave: (name: string, categoryId: string) => void;
  onDiscard: () => void;
}

const CreationSuccessModal: React.FC<CreationModalProps> = ({ images, categories, onSave, onDiscard }) => {
  const [name, setName] = useState(images[0]?.prompt.substring(0, 30) || 'New Creation');
  const [selectedCat, setSelectedCat] = useState('default');
  const [selectedIndex, setSelectedIndex] = useState(0);

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
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
             <Sparkles className="w-5 h-5 text-amber-500" /> Creation Successful ({images.length})
           </h3>
           <button onClick={onDiscard} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
           <div className="flex justify-center mb-6 bg-slate-950 rounded-lg p-2 border border-slate-800 relative min-h-[300px] flex items-center">
              <img 
                 src={images[selectedIndex].url} 
                 className="max-h-[350px] max-w-full object-contain rounded shadow-xl" 
                 alt={`Preview ${selectedIndex}`} 
              />
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full border border-white/20 backdrop-blur-md">
                {selectedIndex + 1} / {images.length}
              </div>
           </div>

           {images.length > 1 && (
               <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar justify-center">
                   {images.map((img, idx) => (
                       <button
                          key={idx}
                          onClick={() => setSelectedIndex(idx)}
                          className={`relative w-16 h-16 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 ${
                              selectedIndex === idx ? 'border-amber-500 opacity-100' : 'border-slate-800 opacity-50 hover:opacity-100'
                          }`}
                       >
                           <img src={img.url} className="w-full h-full object-cover" alt="thumb" />
                       </button>
                   ))}
               </div>
           )}
           
           <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Name your creation(s)</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-amber-500 outline-none transition-colors"
                  placeholder="Enter a name prefix..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Save to Folder</label>
                <div className="relative">
                  <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select 
                    value={selectedCat}
                    onChange={(e) => setSelectedCat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 pl-10 text-white focus:border-amber-500 outline-none appearance-none transition-colors"
                  >
                    <option value="default">General (Root)</option>
                    {renderCategoryOptions(null)}
                  </select>
                </div>
              </div>
           </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-3">
           <button onClick={onDiscard} className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium transition-colors">Discard All</button>
           <button onClick={() => onSave(name, selectedCat)} className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-900/20 transition-colors flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save {images.length} Image{images.length > 1 ? 's' : ''} to Library</button>
        </div>
      </div>
    </div>
  );
};

// -- Toast Notification Component --
const NotificationToast: React.FC<{ message: string; type: 'success' | 'error' | 'warning'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000); 
    return () => clearTimeout(timer);
  }, [onClose]);

  let colorClass = 'bg-blue-900/90 border-blue-500';
  if (type === 'error') colorClass = 'bg-red-900/90 border-red-500';
  else if (type === 'success') colorClass = 'bg-green-900/90 border-green-500';
  else if (type === 'warning') colorClass = 'bg-amber-900/90 border-amber-500';

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md animate-bounce-in border text-white ${colorClass}`}>
      {type === 'error' && <AlertTriangle className="w-5 h-5" />}
      {type === 'success' && <CheckCircle className="w-5 h-5" />}
      {type === 'warning' && <AlertTriangle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-75"><X className="w-4 h-4" /></button>
    </div>
  );
};


function App() {
  // State
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [images, setImages] = useState<GeneratedImage[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('default');
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  
  // Auth - Enhanced with LocalStorage persistence
  const [apiKey, setApiKeyState] = useState(() => {
     return localStorage.getItem('catcom_api_key') || '';
  });
  const [useCloudKey, setUseCloudKey] = useState(false);
  
  // Custom setter to sync with localStorage
  const setApiKey = (key: string) => {
     setApiKeyState(key);
     localStorage.setItem('catcom_api_key', key);
  };

  const apiKeyRef = useRef(apiKey); 
  const useCloudKeyRef = useRef(useCloudKey);

  // Keep refs updated for worker
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);
  useEffect(() => { useCloudKeyRef.current = useCloudKey; }, [useCloudKey]);

  // Specific views
  const [activeImage, setActiveImage] = useState<GeneratedImage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [videoInputImage, setVideoInputImage] = useState<GeneratedImage | null>(null); 

  // Pending Generation State
  const [pendingImages, setPendingImages] = useState<GeneratedImage[] | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);
  const [syncHandle, setSyncHandle] = useState<any>(null);

  // --- GLOBAL BATCH QUEUE STATE ---
  const [globalQueue, setGlobalQueue] = useState<BatchTask[]>([]);
  const queueRef = useRef<BatchTask[]>([]); // Ref to avoid stale closures in worker
  
  // Sync ref with state
  useEffect(() => {
    queueRef.current = globalQueue;
  }, [globalQueue]);

  const [isGlobalQueueRunning, setIsGlobalQueueRunning] = useState(false);
  const [showJobManager, setShowJobManager] = useState(false);
  const [showAPIMonitor, setShowAPIMonitor] = useState(false);
  
  // Studio Synchronization State
  const [studioTaskIds, setStudioTaskIds] = useState<string[]>([]);
  const [isStudioGenerating, setIsStudioGenerating] = useState(false);
  
  // Progress state for UI overlay (derived from active studio tasks)
  const [progressState, setProgressState] = useState<{
      current: number;
      total: number;
      status: 'generating' | 'cooldown' | 'idle';
      countdown: number;
  }>({ current: 0, total: 0, status: 'idle', countdown: 0 });


  // --- INITIALIZATION ---
  useEffect(() => {
    const initializeSystem = async () => {
        try {
            await initDB();
            persistStorage(); 

            // Load from DB
            const dbImages = await getAllImages();
            const dbCats = await getAllCategories();
            
            setImages(dbImages);
            if (dbCats.length > 0) {
                setCategories(dbCats);
            }

        } catch (e) {
            console.error("DB Init Failed", e);
            setNotification({ message: "Database Initialization Failed", type: 'error' });
        }
    };

    initializeSystem();
  }, []);

  // --- STUDIO SYNC: Watch Queue for Studio Tasks Completion ---
  useEffect(() => {
      // 1. Conflict Check: Clean up IDs that no longer exist in the Queue (Deleted by User)
      // This prevents the infinite "Generating" loop if a user clears the queue.
      if (studioTaskIds.length > 0) {
          const missingIds = studioTaskIds.filter(id => !globalQueue.find(t => t.id === id));
          if (missingIds.length > 0) {
              setStudioTaskIds(prev => prev.filter(id => !missingIds.includes(id)));
              // If we removed tasks, we might need to reset state if none left
              if (studioTaskIds.length === missingIds.length) {
                  setIsStudioGenerating(false);
                  setProgressState(p => ({ ...p, status: 'idle' }));
                  return;
              }
          }
      }

      // Logic for Progress Bar Overlay
      if (studioTaskIds.length === 0) {
          setIsStudioGenerating(false);
          setProgressState(p => ({ ...p, status: 'idle' }));
          return;
      }

      setIsStudioGenerating(true);

      // Check statuses of watched tasks in the global queue
      const watchedTasks = globalQueue.filter(t => studioTaskIds.includes(t.id));
      
      const completedCount = watchedTasks.filter(t => t.status === 'COMPLETED' || t.status === 'FAILED').length;
      const totalCount = studioTaskIds.length;
      
      setProgressState({
          current: completedCount + 1,
          total: totalCount,
          status: 'generating',
          countdown: 0
      });

      // Handle Completions (Auto-Show)
      const completedTasks = watchedTasks.filter(t => t.status === 'COMPLETED');
      
      completedTasks.forEach(async (task) => {
          // Remove from watched list so we don't process again
          setStudioTaskIds(prev => prev.filter(id => id !== task.id));
          
          if (task.resultUrl) {
               const newAsset: GeneratedImage = {
                  id: generateId(),
                  url: task.resultUrl,
                  prompt: task.payload?.prompt || 'Generated Image',
                  name: `Studio Gen - ${new Date().toLocaleTimeString()}`,
                  categoryId: 'default',
                  createdAt: Date.now(),
                  width: task.payload?.width || 1024,
                  height: task.payload?.height || 1024,
                  model: task.payload?.model || 'unknown',
                  contentType: task.type === 'VIDEO_GEN' ? 'video' : 'image',
                  generationTime: Date.now() - (task.createdAt || Date.now())
              };
              
              await saveImageToDB(newAsset);
              setImages(prev => [newAsset, ...prev]);
              setActiveImage(newAsset); // Auto display result in studio
              
              if (syncHandle) saveSingleImageToFolder(syncHandle, newAsset, categories);
          }
      });

      // Handle Failures
      const failedTasks = watchedTasks.filter(t => t.status === 'FAILED');
      failedTasks.forEach(task => {
           setStudioTaskIds(prev => prev.filter(id => id !== task.id));
           setNotification({ message: "A task failed to generate.", type: 'error' });
      });

  }, [globalQueue, studioTaskIds, categories, syncHandle]);


  // --- BACKGROUND JOB WORKER (ROBUST VERSION) ---
  useEffect(() => {
    let workerInterval: ReturnType<typeof setInterval> | null = null;
    let isProcessingCurrentTick = false;

    if (isGlobalQueueRunning) {
        workerInterval = setInterval(async () => {
             // CRITICAL: Read from REF to avoid stale closures and prevent infinite loops
             // caused by setGlobalQueue triggering effect re-run.
             const currentQueue = queueRef.current;
             
             // If already processing something in this tick or a task is marked processing globally, skip
             if (isProcessingCurrentTick || currentQueue.some(t => t.status === 'PROCESSING')) return;

             // Find next pending
             const pendingTask = currentQueue.find(t => t.status === 'PENDING');
             if (!pendingTask) return; // Nothing to do

             isProcessingCurrentTick = true; // Local lock

             // Get API Key
             const currentKey = useCloudKeyRef.current ? process.env.API_KEY : apiKeyRef.current;
             if (!currentKey) {
                 setIsGlobalQueueRunning(false);
                 setNotification({ message: "Queue Paused: Missing API Key", type: 'error' });
                 isProcessingCurrentTick = false;
                 return;
             }

             const taskId = pendingTask.id;

             // 1. Mark as Processing immediately
             setGlobalQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'PROCESSING', progress: 5 } : t));

             try {
                // ... Wait a tick to ensure UI updates ...
                await wait(100);

                const task = pendingTask;
                const payload = task.payload || {};
                const ai = new GoogleGenAI({ apiKey: currentKey });

                // --- VIDEO LOGIC ---
                if (task.type === 'VIDEO_GEN') {
                    const settingsPayload = payload.settings;
                    const sourceImagePayload = payload.sourceImage;
                    const resolution = settingsPayload.resolution || '720p';
                    const model = resolution === '1080p' ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';

                    let operation = await retryOperation(async () => {
                         if (sourceImagePayload) {
                            return await ai.models.generateVideos({
                                model: model,
                                prompt: settingsPayload.prompt,
                                image: { imageBytes: cleanBase64(sourceImagePayload), mimeType: 'image/png' },
                                config: { numberOfVideos: 1, aspectRatio: '16:9', resolution: resolution }
                            });
                         } else {
                            return await ai.models.generateVideos({
                                model: model,
                                prompt: settingsPayload.prompt,
                                config: { numberOfVideos: 1, aspectRatio: '16:9', resolution: resolution }
                            });
                         }
                    }, 3, 3000);

                    // Polling Loop
                    while (!operation.done) {
                        await wait(5000); // 5s poll
                        operation = await retryOperation(async () => {
                            return await ai.operations.getVideosOperation({ operation: operation });
                        }, 3, 2000);
                        
                        // Update progress without breaking status
                        setGlobalQueue(prev => prev.map(t => t.id === taskId && t.progress < 90 ? { ...t, progress: t.progress + 5 } : t));
                    }

                    if (operation.error) throw new Error((operation.error.message as string) || 'Video generation error');

                    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                    if (!downloadLink) throw new Error("No video URI");

                    const separator = downloadLink.includes('?') ? '&' : '?';
                    const secureLink = `${downloadLink}${separator}key=${currentKey}`;
                    const vidResp = await fetch(secureLink);
                    if(!vidResp.ok) throw new Error("Failed to download video file");
                    const vidBlob = await vidResp.blob();
                    const vidUrl = URL.createObjectURL(vidBlob);

                    setGlobalQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED', progress: 100, resultUrl: vidUrl } : t));
                } 
                // --- IMAGE LOGIC ---
                else {
                     // Check Rate Limits - RELAXED FOR TIER 1 (20 RPM)
                     // Now we check directly against the new CRITICAL_THRESHOLD (20)
                     if (RateLimitTracker.getStatus() === 'CRITICAL') {
                         console.warn("Approaching 20 RPM limit. Pausing briefly.");
                         await wait(2000); // Only small wait, let retry logic handle 429s if needed
                     } else {
                         await wait(100); // Fast path
                     }

                     const parts: any[] = [];
                     
                     // Handle Refs
                     const refs = payload.refImages || (payload.refImage ? [payload.refImage] : []);
                     if (refs.length > 0) {
                         refs.forEach((img: string) => {
                             parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64(img) } });
                         });
                     }
                     const targets = payload.targetImages || [];
                     targets.forEach((img: string) => {
                         parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64(img) } });
                     });

                     let finalPrompt = payload.prompt;
                     if (payload.isPreset) {
                          finalPrompt = `Transform this image into the style of ${task.styleName}. ${finalPrompt || ''}. High quality.`;
                     } else if (payload.styleRefImage) {
                          parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64(payload.styleRefImage) } });
                     }
                     
                     if (payload.negativePrompt) finalPrompt += ` . Avoid: ${payload.negativePrompt}`;
                     parts.push({ text: finalPrompt });

                     // --- FIX FOR 400 INVALID_ARGUMENT & PARAMETER SANITIZATION ---
                     const selectedModel = payload.model || 'gemini-2.5-flash-image';
                     const isProModel = selectedModel.includes('pro');

                     // 1. Sanitize Aspect Ratio: API only accepts specific strings
                     const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
                     let apiAspectRatio = payload.aspectRatio || '1:1';
                     if (!validRatios.includes(apiAspectRatio)) {
                        // If custom ratio, we must fallback to a valid one for generation to prevent 400 Error
                        apiAspectRatio = '1:1'; 
                     }

                     // 2. Build Image Config: Only add supported params
                     const imageConfig: any = {
                        aspectRatio: apiAspectRatio
                     };
                     
                     // 3. Image Size is ONLY supported on Pro models
                     if (isProModel) {
                        imageConfig.imageSize = payload.imageSize || '1K';
                     }

                     const resultUrl = await retryOperation(async () => {
                        const response = await ai.models.generateContent({
                          model: selectedModel,
                          contents: { parts },
                          config: { 
                              imageConfig: imageConfig, // Use sanitized config
                              // Allow looser safety settings to prevent false positives in art generation
                              safetySettings: [
                                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                              ],
                          }
                        });

                        if (response.candidates?.[0]) {
                            const candidate = response.candidates[0];
                            if (candidate.finishReason === 'SAFETY') {
                                throw new Error("Generation blocked by Safety Filters. Try a less sensitive prompt.");
                            }
                            if (candidate.content?.parts) {
                                for (const part of candidate.content.parts) {
                                    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
                                }
                            }
                        }
                        throw new Error("No image generated (Check prompts/filters).");
                     }, 3, 2000);

                     setGlobalQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED', progress: 100, resultUrl: resultUrl } : t));
                     RateLimitTracker.recordRequest(); // Track success
                }

             } catch (error: any) {
                 console.error("Task Error:", error);
                 // Better error messages for user
                 let msg = "Failed";
                 if (error.message?.includes('Safety')) msg = "Blocked by Safety";
                 else if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) msg = "Quota Exceeded (Try Flash Model)";
                 else if (error.message?.includes('400')) msg = "Invalid Config";

                 setGlobalQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'FAILED', progress: 0, styleName: `${t.styleName} (${msg})` } : t));
             } finally {
                 isProcessingCurrentTick = false;
             }

        }, 1000); // Check every 1s
    }

    return () => {
        if(workerInterval) clearInterval(workerInterval);
    };
  }, [isGlobalQueueRunning]); // Only re-run if running state toggles


  // --- HANDLERS ---

  const handleAddCategory = async (name: string, parentId: string | null = null) => {
    const newCat = { id: generateId(), name, parentId, isCollapsed: false };
    try {
        await saveCategoryToDB(newCat);
        setCategories(prev => [...prev, newCat]);
    } catch(e) {
        setNotification({ message: "Failed to create category", type: 'error' });
    }
  };

  const handleToggleCollapse = async (id: string) => {
    const newCats = categories.map(c => c.id === id ? { ...c, isCollapsed: !c.isCollapsed } : c);
    setCategories(newCats);
    const cat = newCats.find(c => c.id === id);
    if(cat) await saveCategoryToDB(cat);
  };

  const handleDeleteCategory = async (id: string) => {
    if (id === 'default') return;
    try {
        await deleteCategoryFromDB(id);
        const imagesToUpdate = images.filter(img => img.categoryId === id);
        for (const img of imagesToUpdate) {
            const updated = { ...img, categoryId: 'default' };
            await saveImageToDB(updated);
        }
        setCategories(prev => prev.filter(c => c.id !== id && c.parentId !== id));
        setImages(prev => prev.map(img => img.categoryId === id ? { ...img, categoryId: 'default' } : img));
        if (selectedCategoryId === id) setSelectedCategoryId('default');
    } catch (e) {
        setNotification({ message: "Error deleting category", type: 'error' });
    }
  };

  const handleEditCategory = async (id: string, name: string) => {
    const newCats = categories.map(c => c.id === id ? { ...c, name } : c);
    setCategories(newCats);
    const cat = newCats.find(c => c.id === id);
    if(cat) await saveCategoryToDB(cat);
  };

  const handleDeleteImage = async (id: string) => {
    try {
        await deleteImageFromDB(id);
        setImages(prev => prev.filter(img => img.id !== id));
        if (activeImage?.id === id) setActiveImage(null);
        setNotification({ message: "Deleted image", type: 'success' });
    } catch(e) {
        setNotification({ message: "Failed to delete image", type: 'error' });
    }
  };

  const handleRenameImage = async (id: string, newName: string) => {
    const img = images.find(i => i.id === id);
    if (img) {
        const updated = { ...img, name: newName };
        await saveImageToDB(updated);
        setImages(prev => prev.map(i => i.id === id ? updated : i));
        if (activeImage?.id === id) setActiveImage(updated);
        if (syncHandle) saveSingleImageToFolder(syncHandle, updated, categories);
    }
  };

  const handleMoveImage = async (id: string, newCategoryId: string) => {
    const img = images.find(i => i.id === id);
    if (img) {
        const updated = { ...img, categoryId: newCategoryId };
        await saveImageToDB(updated);
        setImages(prev => prev.map(i => i.id === id ? updated : i));
        setNotification({ message: "Image moved", type: 'success' });
        if (syncHandle) saveSingleImageToFolder(syncHandle, updated, categories);
    }
  };

  const handleUploadImage = async (file: File) => {
      try {
          const base64 = await blobToBase64(file);
          const newImage: GeneratedImage = {
              id: generateId(),
              url: base64,
              prompt: 'Uploaded Image',
              name: file.name,
              categoryId: selectedCategoryId === 'all' ? 'default' : selectedCategoryId,
              createdAt: Date.now(),
              width: 1024,
              height: 1024,
              model: 'upload',
              contentType: file.type.startsWith('video') ? 'video' : 'image'
          };
          
          await saveImageToDB(newImage);
          setImages(prev => [newImage, ...prev]);
          setNotification({ message: "Upload successful!", type: 'success' });
          if (syncHandle) saveSingleImageToFolder(syncHandle, newImage, categories);
      } catch(e) {
          setNotification({ message: "Upload failed: " + e, type: 'error' });
      }
  };

  const handleSaveVideo = async (videoUrl: string, prompt: string) => {
      try {
          const newVideo: GeneratedImage = {
              id: generateId(),
              url: videoUrl,
              prompt: prompt,
              name: `Video - ${new Date().toLocaleTimeString()}`,
              categoryId: 'default',
              createdAt: Date.now(),
              width: 1920,
              height: 1080,
              model: 'veo',
              contentType: 'video'
          };

          await saveImageToDB(newVideo);
          setImages(prev => [newVideo, ...prev]);
          setNotification({ message: "Video saved to Gallery!", type: 'success' });
          if (syncHandle) saveSingleImageToFolder(syncHandle, newVideo, categories);
      } catch (e) {
          setNotification({ message: "Failed to save video", type: 'error' });
      }
  };

  const handleBatchImageSave = async (task: BatchTask, targetCategoryId: string = 'default', shouldEdit: boolean = false) => {
      if(!task.resultUrl) return;

      const isVideo = task.type === 'VIDEO_GEN';
      const promptName = task.payload?.prompt || task.styleName || 'Generated Asset';
      
      const newAsset: GeneratedImage = {
          id: generateId(),
          url: task.resultUrl,
          prompt: promptName,
          name: `${promptName.substring(0, 20)}...`,
          categoryId: targetCategoryId,
          createdAt: Date.now(),
          width: isVideo ? 1920 : 1024, 
          height: isVideo ? 1080 : 1024,
          model: isVideo ? 'veo' : 'batch-automation',
          contentType: isVideo ? 'video' : 'image',
          generationTime: Date.now() - (task.createdAt || Date.now()) // Approx gen time
      };

      try {
          await saveImageToDB(newAsset);
          setImages(prev => [newAsset, ...prev]);
          setNotification({ message: "Saved to Library!", type: 'success' });
          if (syncHandle) saveSingleImageToFolder(syncHandle, newAsset, categories);
          
          // If Edit Requested
          if (shouldEdit && !isVideo) {
               setActiveImage(newAsset);
               setView(AppView.DASHBOARD);
               setIsEditing(true);
               setShowJobManager(false); // Close queue manager
          }

      } catch(e) {
          setNotification({ message: "Failed to save asset", type: 'error' });
      }
  };

  const handleSaveEditedImage = async (originalId: string, newUrl: string) => {
    const original = images.find(i => i.id === originalId);
    if (!original) return;

    const newImage: GeneratedImage = {
      ...original,
      id: generateId(),
      url: newUrl,
      createdAt: Date.now(),
      prompt: original.prompt + ' (Edited)',
      name: (original.name || 'Image') + ' (Edit)',
      parentId: originalId 
    };

    try {
        await saveImageToDB(newImage);
        setImages(prev => [newImage, ...prev]);
        setActiveImage(newImage);
        setIsEditing(false);
        setNotification({ message: "Edit Saved Successfully!", type: 'success' });
        if (syncHandle) saveSingleImageToFolder(syncHandle, newImage, categories);

    } catch (e) {
        setNotification({ message: "Failed to save edit.", type: 'error' });
    }
  };

  const handleMakeVariations = (image: GeneratedImage) => {
     setSettings(prev => ({
       ...prev,
       prompt: image.prompt,
       negativePrompt: image.negativePrompt || prev.negativePrompt,
       refImages: [image.url], 
       targetImages: [], 
       numImages: 4, 
       imageStrength: 0.60, 
     }));
     setView(AppView.DASHBOARD);
     setNotification({ message: "Loaded for Variations. Ready to Generate!", type: 'success' });
  };

  // --- NEW UNIFIED GENERATE HANDLER (Push to Global Queue) ---
  const handleGenerate = async () => {
    const currentKey = useCloudKey ? process.env.API_KEY : apiKey;
    if (!settings.prompt || !currentKey) {
        setNotification({ message: "Please check Prompt and API Key!", type: 'error' });
        return;
    }

    if (RateLimitTracker.getStatus() === 'CRITICAL') {
        setNotification({ message: "20 RPM Limit Reached. Pausing...", type: 'warning' });
    }
    
    const newTasks: BatchTask[] = [];
    const timestamp = Date.now();
    const newIds: string[] = [];

    for(let i=0; i < settings.numImages; i++) {
        const id = generateId();
        newIds.push(id);
        newTasks.push({
            id: id,
            type: 'IMAGE_GEN',
            status: 'PENDING',
            progress: 0,
            styleName: settings.prompt.substring(0, 15) + '...',
            refImage: settings.refImages[0] || settings.targetImages[0] || null, // Thumbnail
            createdAt: timestamp,
            payload: {
                prompt: settings.prompt,
                negativePrompt: settings.negativePrompt,
                refImages: settings.refImages,
                targetImages: settings.targetImages,
                model: settings.model,
                aspectRatio: settings.aspectRatio,
                imageSize: settings.imageSize,
                colorPalette: settings.colorPalette,
                width: settings.width,
                height: settings.height
            }
        });
    }

    // Add to Global Queue
    setGlobalQueue(prev => [...prev, ...newTasks]);
    // Tell Studio to watch these IDs
    setStudioTaskIds(newIds);
    // Start Queue if not running
    setIsGlobalQueueRunning(true);
    
    setNotification({ message: `Added ${settings.numImages} job(s) to Queue!`, type: 'success' });
  };

  const handleSavePending = async (name: string, categoryId: string) => {
    // Legacy support for pendingImages - moved to queue logic but keeping function for safety
    if (!pendingImages) return;
  };

  const handleExportData = () => {
    const data = { categories, images, version: 1, exportedAt: Date.now() };
    exportDataToJson(data, `catcom_backup_${new Date().toISOString().slice(0,10)}.json`);
    setNotification({ message: "Backup file downloaded.", type: 'success' });
  };

  const handleExportToFolders = async () => {
     try {
         // @ts-ignore
         if(window.showDirectoryPicker) {
             // @ts-ignore
             const root = await window.showDirectoryPicker({ mode: 'readwrite' });
             setSyncHandle(root);
             setNotification({ message: "Live Sync Connected! Saving files...", type: 'success' });
             await saveToLocalFolder(images, categories); 
         } else {
             throw new Error("Browser not supported");
         }
     } catch (e: any) {
         setNotification({ message: e.message || "Connection failed", type: 'error' });
     }
  };

  const handleImportData = async (file: File) => {
    try {
        const data: any = await importDataFromJson(file);
        if (data.categories && data.images) {
            if(!window.confirm("Merge imported data?")) return;
            await bulkSaveCategories(data.categories);
            await bulkSaveImages(data.images);
            const dbImgs = await getAllImages();
            const dbCats = await getAllCategories();
            setImages(dbImgs);
            setCategories(dbCats);
            setNotification({ message: "Data restored successfully!", type: 'success' });
        } else {
            throw new Error("Invalid file format");
        }
    } catch (e) {
        setNotification({ message: "Import failed: Invalid file", type: 'error' });
    }
  };

  const handleResetData = async () => {
      if(window.confirm("WARNING: DELETE ALL DATA?")) {
          await clearDatabase();
          setCategories(DEFAULT_CATEGORIES);
          setImages([]);
          setNotification({ message: "System Reset Complete", type: 'success' });
      }
  };

  const switchToVideoStudio = (inputImage?: GeneratedImage) => {
     setVideoInputImage(inputImage || null);
     setView(AppView.VIDEO_STUDIO);
  };

  // If in Batch Mode, render separate layout
  if (view === AppView.BATCH) {
    return (
      <div className="h-screen w-full bg-slate-950 flex flex-col">
        {/* Batch Header */}
        <div className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
             <button onClick={() => setView(AppView.DASHBOARD)} className="text-slate-400 hover:text-white transition-colors">← Back to Studio</button>
             <div className="h-6 w-px bg-slate-700 mx-2"></div>
             <h1 className="text-lg font-bold text-white"><span className="text-amber-500">CATCOM</span> BATCH STUDIO</h1>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowJobManager(!showJobManager)} className="text-xs flex items-center gap-1 text-slate-400 hover:text-amber-500">
                <Activity className="w-4 h-4" /> Queue ({globalQueue.length})
             </button>
             <button onClick={() => setShowHelp(true)} className="flex items-center gap-2 text-slate-400 hover:text-amber-500 text-sm">
                <HelpCircle className="w-4 h-4" /> Help
             </button>
          </div>
        </div>
        
        <BatchStudio 
            onBack={() => setView(AppView.DASHBOARD)} 
            apiKey={useCloudKey ? process.env.API_KEY : apiKey} 
            onSaveToGallery={handleBatchImageSave}
            images={images}
            onAddToQueue={(tasks) => {
                setGlobalQueue(prev => [...prev, ...tasks]);
                setIsGlobalQueueRunning(true);
            }}
            onShowNotification={(msg, type) => setNotification({ message: msg, type: type })}
        />
        
        {showJobManager && (
            <JobManager 
                queue={globalQueue}
                isQueueRunning={isGlobalQueueRunning}
                onToggleQueue={() => setIsGlobalQueueRunning(!isGlobalQueueRunning)}
                onClearQueue={() => setGlobalQueue([])}
                onRemoveTask={(id) => setGlobalQueue(prev => prev.filter(t => t.id !== id))}
                onSaveTask={(task, catId, edit) => handleBatchImageSave(task, catId, edit)}
                onClose={() => setShowJobManager(false)}
                categories={categories}
            />
        )}

        {showHelp && <HelpGuide onClose={() => setShowHelp(false)} />}
        {notification && <NotificationToast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      </div>
    )
  }

  // Video Studio View
  if (view === AppView.VIDEO_STUDIO) {
      return (
         <VideoStudio 
            apiKey={useCloudKey ? process.env.API_KEY : apiKey}
            inputImage={videoInputImage}
            onClose={() => setView(AppView.DASHBOARD)}
            images={images}
            onSaveToGallery={handleSaveVideo}
            onAddToQueue={(tasks) => {
                 setGlobalQueue(prev => [...prev, ...tasks]);
                 setIsGlobalQueueRunning(true);
            }}
         />
      );
  }

  // Standard Studio Layout
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {notification && <NotificationToast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

      <div className="flex flex-col h-full">
        <CategorySidebar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={(id) => { setSelectedCategoryId(id); setView(AppView.GALLERY); setActiveImage(null); }}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
          onEditCategory={handleEditCategory}
          onToggleCollapse={handleToggleCollapse}
          onExportData={handleExportData}
          onImportData={handleImportData}
          onResetData={handleResetData}
          onExportToFolders={handleExportToFolders}
        />
        <div className="w-72 bg-slate-950 border-r border-slate-800 p-4 text-[10px] text-slate-600 space-y-1 shrink-0">
             <p className="font-bold text-slate-500">CATCOM IMAGE GEN v3.0 (Pro)</p>
             <p>Dev: Thống Võ</p>
        </div>
      </div>

      <div className="flex-1 flex flex-row overflow-hidden relative">
        {view === AppView.DASHBOARD && (
           <ControlPanel
             settings={settings}
             onSettingsChange={setSettings}
             onGenerate={handleGenerate}
             isGenerating={isStudioGenerating} // Pass studio generating state
             apiKey={apiKey}
             setApiKey={setApiKey}
             useCloudKey={useCloudKey}
             setUseCloudKey={setUseCloudKey}
             images={images}
           />
        )}

        <div className="flex-1 relative bg-slate-950 flex flex-col">
            
            {/* Top Tab Bar & Mode Switcher */}
            <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
               <div className="flex gap-2">
                 <button onClick={() => setView(AppView.DASHBOARD)} className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors ${view === AppView.DASHBOARD ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                   Studio
                 </button>
                 <button onClick={() => setView(AppView.GALLERY)} className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors ${view === AppView.GALLERY ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                   Gallery
                 </button>
                  <button onClick={() => switchToVideoStudio()} className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors flex items-center gap-2 text-slate-400 hover:text-white`}>
                   <Clapperboard className="w-3 h-3" /> Create Video
                 </button>
               </div>

               {/* GLOBAL TOOLBAR ICONS */}
               <div className="flex items-center gap-3">
                  {/* Job Manager Icon */}
                  <button 
                    onClick={() => setShowJobManager(!showJobManager)}
                    className={`relative p-2 rounded-lg transition-colors ${isGlobalQueueRunning ? 'bg-green-900/30 text-green-400 animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    title="Global Jobs Queue"
                  >
                     <Activity className="w-5 h-5" />
                     {globalQueue.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING').length > 0 && (
                         <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full"></span>
                     )}
                  </button>

                  {/* API Health Icon */}
                  <div className="relative">
                      <button 
                        onClick={() => setShowAPIMonitor(!showAPIMonitor)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                        title="API Health Status"
                      >
                         <Zap className="w-5 h-5" />
                      </button>
                      {showAPIMonitor && (
                          <div className="absolute top-full right-0 mt-2 z-50 w-64 shadow-2xl">
                              <APIMonitor />
                          </div>
                      )}
                  </div>

                  <div className="h-6 w-px bg-slate-700 mx-1"></div>

                  <button 
                    onClick={() => setView(AppView.BATCH)}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-white transition-all text-xs font-bold uppercase tracking-wide"
                  >
                     <LayoutGrid className="w-3 h-3" /> Batch Studio
                  </button>
                  <button onClick={() => setShowHelp(true)} className="p-2 text-slate-500 hover:text-white">
                    <HelpCircle className="w-5 h-5" />
                  </button>
               </div>
            </div>

            {/* Main View Logic */}
            {view === AppView.GALLERY ? (
               <Gallery 
                 images={images} 
                 categories={categories} 
                 selectedCategoryId={selectedCategoryId}
                 onDelete={handleDeleteImage}
                 onSelectImage={(img) => { setActiveImage(img); setView(AppView.DASHBOARD); }}
                 onEditImage={(img) => { setActiveImage(img); setIsEditing(true); }} 
                 onRenameImage={handleRenameImage}
                 onMoveImage={handleMoveImage}
                 onUploadImage={handleUploadImage}
                 onAnimateImage={switchToVideoStudio}
                 onMakeVariations={handleMakeVariations}
               />
            ) : (
              // DASHBOARD VIEW
              <div className="flex-1 p-8 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950 overflow-hidden relative">
                <ProgressOverlay state={progressState} />
                {!activeImage ? (
                  <div className="text-center opacity-30 pointer-events-none select-none">
                    <Sparkles className="w-24 h-24 mx-auto mb-4 text-amber-500" />
                    <h1 className="text-4xl font-bold text-slate-700">CATCOM STUDIO</h1>
                    <p className="text-slate-500 mt-2">Create. Edit. Innovate.</p>
                  </div>
                ) : (
                  <div className="relative group max-w-full max-h-full flex flex-col items-center">
                     <img 
                       src={activeImage.url} 
                       alt="Generated" 
                       className="max-h-[calc(100vh-160px)] max-w-full object-contain rounded-lg border border-slate-800 shadow-2xl"
                     />
                     <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                        <button onClick={() => setIsEditing(true)} className="p-3 bg-slate-900/90 hover:bg-amber-500 text-white rounded-xl backdrop-blur-md border border-slate-700 shadow-lg transition-all" title="Edit"><Edit className="w-5 h-5" /></button>
                        <button onClick={() => switchToVideoStudio(activeImage)} className="p-3 bg-slate-900/90 hover:bg-purple-500 text-white rounded-xl backdrop-blur-md border border-slate-700 shadow-lg transition-all" title="Animate Video"><Video className="w-5 h-5" /></button>
                        <a href={activeImage.url} download={`catcom-gen-${activeImage.id}`} className="p-3 bg-slate-900/90 hover:bg-white hover:text-black text-white rounded-xl backdrop-blur-md border border-slate-700 shadow-lg transition-all" title="Download"><Download className="w-5 h-5" /></a>
                         <button onClick={() => { handleDeleteImage(activeImage.id); setActiveImage(null); }} className="p-3 bg-slate-900/90 hover:bg-red-500 text-white rounded-xl backdrop-blur-md border border-slate-700 shadow-lg transition-all" title="Delete"><Trash2 className="w-5 h-5" /></button>
                     </div>
                     <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300">
                       {activeImage.width}x{activeImage.height} • {activeImage.name || 'Untitled'}
                     </div>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Global Job Manager Popup */}
      {showJobManager && (
          <JobManager 
            queue={globalQueue}
            isQueueRunning={isGlobalQueueRunning}
            onToggleQueue={() => setIsGlobalQueueRunning(!isGlobalQueueRunning)}
            onClearQueue={() => setGlobalQueue([])}
            onRemoveTask={(id) => setGlobalQueue(prev => prev.filter(t => t.id !== id))}
            onSaveTask={(task, catId, edit) => handleBatchImageSave(task, catId, edit)}
            onClose={() => setShowJobManager(false)}
            categories={categories}
          />
      )}

      {pendingImages && (
          <CreationSuccessModal 
             images={pendingImages} 
             categories={categories}
             onSave={handleSavePending}
             onDiscard={() => setPendingImages(null)}
          />
      )}

      {isEditing && activeImage && (
        <ImageEditor 
          image={activeImage} 
          onClose={() => setIsEditing(false)}
          onSave={handleSaveEditedImage}
          apiKey={useCloudKey ? process.env.API_KEY || '' : apiKey}
          images={images}
        />
      )}

      {showHelp && <HelpGuide onClose={() => setShowHelp(false)} />}

    </div>
  );
}

export default App;