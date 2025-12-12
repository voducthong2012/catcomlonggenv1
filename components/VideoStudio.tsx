

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Video, Upload, Film, Sliders, Camera, Zap, Check, RotateCcw, Download, X, AlertCircle, Wand2, FolderSearch, Move, Lock, MonitorPlay, Maximize2, Smartphone, Dice5, Aperture, Layers, Activity, Clock, Crop, MousePointer2, Save, Loader2 } from 'lucide-react';
import { GeneratedImage, VideoSettings, VideoAspectRatio, BatchTask } from '../types';
import { blobToBase64, cleanBase64, generateId } from '../utils';
import GalleryPicker from './GalleryPicker';

interface Props {
  apiKey: string;
  inputImage?: GeneratedImage | null;
  onClose: () => void;
  images: GeneratedImage[];
  onSaveToGallery?: (url: string, prompt: string) => void;
  // New Prop to push to queue
  onAddToQueue: (tasks: BatchTask[]) => void;
}

const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  prompt: '',
  negativePrompt: 'morphing body, disappearing limbs, disjointed legs, distorted face, low quality, glitch',
  panX: 0,
  panY: 0,
  zoom: 0,
  roll: 0,
  isStaticCamera: false,
  motionBucketId: 60,
  noiseAugmentation: 0.1,
  fps: 24,
  resolution: '720p',
  loop: true,
  seed: -1, // -1 means random
  shake: 0,
  duration: '5s',
  aspectRatio: VideoAspectRatio.RATIO_16_9,
};

const CAMERA_PRESETS = [
    { label: 'Dolly In', x: 0, y: 0, zoom: 8, roll: 0 },
    { label: 'Zoom Out', x: 0, y: 0, zoom: -8, roll: 0 },
    { label: 'Truck Left', x: -8, y: 0, zoom: 0, roll: 0 },
    { label: 'Truck Right', x: 8, y: 0, zoom: 0, roll: 0 },
    { label: 'Crane Up', x: 0, y: 8, zoom: 0, roll: 0 },
    { label: 'Dutch Left', x: 0, y: 0, zoom: 0, roll: -5 },
];

const STYLE_TAGS = [
    "Cinematic Lighting", "Photorealistic", "Anime Style", "3D Render", "Analog Film", "Cyberpunk", "Noir", "Fantasy"
];

const VideoStudio: React.FC<Props> = ({ apiKey, inputImage, onClose, images, onSaveToGallery, onAddToQueue }) => {
  // State
  const [settings, setSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS);
  const [sourceImage, setSourceImage] = useState<string | null>(inputImage?.url || null);
  const [activeTab, setActiveTab] = useState<'camera' | 'motion' | 'prompt' | 'export'>('camera');
  
  // Gallery Picker
  const [showPicker, setShowPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Joystick State
  const joystickRef = useRef<HTMLDivElement>(null);
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);

  // Initialize prompt from input image if available
  useEffect(() => {
    if (inputImage) {
      setSettings(prev => ({
        ...prev,
        prompt: inputImage.prompt // Smart Context Carry-over
      }));
    }
  }, [inputImage]);

  // --- JOYSTICK LOGIC ---
  const handleJoystickMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingJoystick || !joystickRef.current) return;
    
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let clientX, clientY;
    if ('touches' in e) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
    } else {
       clientX = (e as React.MouseEvent).clientX;
       clientY = (e as React.MouseEvent).clientY;
    }

    // Calculate normalized vector (-1 to 1)
    let dx = (clientX - centerX) / (rect.width / 2);
    let dy = (clientY - centerY) / (rect.height / 2);

    // Clamp
    const distance = Math.sqrt(dx*dx + dy*dy);
    if (distance > 1) {
        dx /= distance;
        dy /= distance;
    }

    // Map to -10 to 10
    setSettings(prev => ({
        ...prev,
        panX: Math.round(dx * 10),
        panY: Math.round(dy * -10) // Invert Y for intuitive up/down
    }));
  };

  const resetJoystick = () => {
    setSettings(prev => ({ ...prev, panX: 0, panY: 0 }));
  };

  const applyCameraPreset = (p: any) => {
      setSettings(prev => ({
          ...prev,
          panX: p.x,
          panY: p.y,
          zoom: p.zoom,
          roll: p.roll,
          isStaticCamera: false
      }));
  };

  const toggleStyleTag = (tag: string) => {
      if (settings.prompt.includes(tag)) return;
      setSettings(prev => ({
          ...prev,
          prompt: (prev.prompt + ", " + tag).replace(/^, /, '')
      }));
  };

  const handleAddToQueue = () => {
    if (!apiKey) {
      alert("Please ensure API Key is set in Studio.");
      return;
    }
    if (!sourceImage && !settings.prompt) {
      alert("Please provide an image or a prompt.");
      return;
    }

    // Construct BatchTask
    const task: BatchTask = {
        id: generateId(),
        type: 'VIDEO_GEN',
        status: 'PENDING',
        progress: 0,
        refImage: sourceImage, // As thumbnail
        styleName: 'Cinematic Video',
        createdAt: Date.now(),
        payload: {
            settings: settings,
            sourceImage: sourceImage
        }
    };

    onAddToQueue([task]);
    alert("Video job added to Global Queue! Check the Activity icon in toolbar.");
    onClose(); // Optional: Close studio or stay open
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const base64 = await blobToBase64(e.target.files[0]);
          setSourceImage(base64);
      }
  };

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 font-sans flex-col">
      {/* Top Header */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 flex justify-between items-center shrink-0 z-20">
         <div className="flex items-center gap-3">
             <Film className="w-5 h-5 text-amber-500" />
             <h1 className="text-lg font-bold tracking-tight">DIRECTOR CONTROL CENTER <span className="text-xs font-normal text-slate-500 ml-2 bg-slate-800 px-2 py-0.5 rounded-full">Veo 3.1 Powered</span></h1>
         </div>
         <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
             <X className="w-5 h-5" />
         </button>
      </div>

      {/* Main Content: Split Vertical (Previews Top, Controls Bottom) */}
      <div className="flex-1 flex flex-col overflow-hidden">
         
         {/* TOP: PREVIEW AREA */}
         <div className="flex-1 flex bg-black/50 relative overflow-hidden">
            
            {/* Left: Input Sidebar (Fixed Width, Narrowed) */}
            <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Upload className="w-3 h-3"/> Input Source
                     </h3>
                </div>
                
                <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                    {sourceImage ? (
                        <div className="relative group w-full aspect-video shadow-lg rounded-lg overflow-hidden border border-slate-700">
                            <img src={sourceImage} className="w-full h-full object-cover" alt="Source" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button 
                                onClick={() => setSourceImage(null)}
                                className="p-2 bg-red-500 rounded-full text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full aspect-video border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-900/50 hover:bg-slate-900"
                        >
                            <Upload className="w-6 h-6 text-slate-600 mb-2" />
                            <span className="text-[10px] text-slate-500">Upload Frame</span>
                        </div>
                    )}

                    {!sourceImage && (
                         <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-slate-600 text-center">- OR -</span>
                            <button 
                                onClick={() => setShowPicker(true)}
                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-700"
                            >
                                <FolderSearch className="w-3 h-3 text-blue-500" /> Gallery Asset
                            </button>
                            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                         </div>
                    )}
                    
                    <div className="mt-auto p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <div className="flex items-start gap-2 text-amber-500/80 mb-1">
                             <MousePointer2 className="w-3 h-3 mt-0.5" />
                             <span className="text-[10px] font-bold">Director Tip</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            For best results, upload a high-quality static image (16:9). Veo will animate elements based on your prompt and physics settings below.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right: Output Cinema (Expanded) */}
            <div className="flex-1 flex flex-col relative bg-gradient-to-br from-slate-950 to-slate-900 items-center justify-center p-8">
                <h3 className="absolute top-4 left-6 text-xs font-bold text-amber-500 uppercase tracking-widest z-10 flex items-center gap-2">
                    <MonitorPlay className="w-3 h-3" /> Config Preview
                </h3>

                <div className="text-center text-slate-700 opacity-50 select-none flex flex-col items-center gap-4">
                    <div className="w-24 h-24 rounded-full border-4 border-dashed border-slate-800 flex items-center justify-center">
                        <Video className="w-10 h-10" />
                    </div>
                    <div>
                        <p className="text-xl font-bold tracking-tight">Configure Video</p>
                        <p className="text-sm">Adjust settings below then click "Add to Queue"</p>
                        <p className="text-xs mt-2 text-amber-500">Processing happens in background</p>
                    </div>
                </div>
            </div>
         </div>

         {/* BOTTOM: CONTROL DECK (Expanded) */}
         <div className="h-[420px] bg-slate-950 border-t border-slate-800 shrink-0 flex flex-col z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] relative">
            
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 px-4 py-1 rounded-full border border-slate-700 shadow-lg text-[10px] font-bold text-slate-400 tracking-widest uppercase z-30">
                Director Console
            </div>

            <div className="flex h-full">
                {/* Tabs Sidebar */}
                <div className="w-48 border-r border-slate-800 bg-slate-900 flex flex-col">
                    {[
                    { id: 'camera', icon: Camera, label: 'Cinematography', desc: 'Pan, Tilt, Zoom' },
                    { id: 'motion', icon: Move, label: 'Physics', desc: 'Motion, Shake' },
                    { id: 'prompt', icon: Wand2, label: 'Director Story', desc: 'Prompt, Style' },
                    { id: 'export', icon: Sliders, label: 'Export Format', desc: 'FPS, Ratio, Upscale' }
                    ].map(tab => (
                        <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`p-4 text-left border-l-4 transition-all ${
                            activeTab === tab.id 
                            ? 'border-amber-500 bg-slate-800' 
                            : 'border-transparent hover:bg-slate-800/50'
                        }`}
                        >
                            <div className={`flex items-center gap-2 mb-1 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`}>
                                <tab.icon className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">{tab.label}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block pl-6">{tab.desc}</span>
                        </button>
                    ))}
                    
                    <div className="mt-auto p-4 border-t border-slate-800">
                        <button 
                            onClick={handleAddToQueue}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                        >
                            <Zap className="w-5 h-5" />
                            ADD TO QUEUE
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-slate-950 p-6 overflow-y-auto custom-scrollbar">
                    
                    {/* CAMERA TAB */}
                    {activeTab === 'camera' && (
                        <div className="grid grid-cols-12 gap-8 h-full">
                            <div className="col-span-4 flex flex-col items-center justify-center border-r border-slate-800/50 pr-8">
                                <div className="flex justify-between w-full mb-4 px-4">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Camera JoyStick</span>
                                    <button onClick={resetJoystick} className="text-xs text-amber-500 hover:text-white flex gap-1 items-center"><RotateCcw className="w-3 h-3"/> Reset</button>
                                </div>
                                <div 
                                className="w-48 h-48 bg-slate-900 rounded-full border border-slate-800 relative shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)] cursor-crosshair group"
                                ref={joystickRef}
                                onMouseDown={() => setIsDraggingJoystick(true)}
                                onMouseUp={() => setIsDraggingJoystick(false)}
                                onMouseLeave={() => setIsDraggingJoystick(false)}
                                onMouseMove={handleJoystickMove}
                                onTouchStart={() => setIsDraggingJoystick(true)}
                                onTouchEnd={() => setIsDraggingJoystick(false)}
                                onTouchMove={handleJoystickMove}
                                >
                                    <div className="absolute inset-0 m-auto w-full h-px bg-slate-800 pointer-events-none" />
                                    <div className="absolute inset-0 m-auto h-full w-px bg-slate-800 pointer-events-none" />
                                    {/* Rings */}
                                    <div className="absolute inset-0 m-auto w-32 h-32 rounded-full border border-slate-800 pointer-events-none" />
                                    <div className="absolute inset-0 m-auto w-16 h-16 rounded-full border border-slate-800 pointer-events-none" />
                                    
                                    <div 
                                        className={`absolute w-12 h-12 rounded-full shadow-2xl border-4 border-slate-950 transition-transform duration-75 z-10 flex items-center justify-center ${isDraggingJoystick ? 'bg-amber-400 scale-105' : 'bg-gradient-to-br from-amber-500 to-amber-700'}`}
                                        style={{
                                            top: '50%', left: '50%',
                                            marginTop: -24, marginLeft: -24,
                                            transform: `translate(${settings.panX * 7}%, ${settings.panY * -7}%)`
                                        }}
                                    >
                                        <div className="w-2 h-2 bg-black/20 rounded-full" />
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-4 text-xs font-mono text-slate-500">
                                    <span className="bg-slate-900 px-2 py-1 rounded">X: {settings.panX}</span>
                                    <span className="bg-slate-900 px-2 py-1 rounded">Y: {settings.panY}</span>
                                </div>
                            </div>

                            <div className="col-span-5 space-y-6">
                                <h4 className="text-sm font-bold text-slate-300 uppercase flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <Aperture className="w-4 h-4 text-amber-500" /> Movement Presets
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {CAMERA_PRESETS.map((preset, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => applyCameraPreset(preset)}
                                            className="py-3 px-4 bg-slate-900 border border-slate-800 hover:border-amber-500 hover:bg-slate-800 hover:text-white text-slate-400 text-xs font-bold uppercase rounded-lg transition-all text-left flex items-center justify-between group"
                                        >
                                            {preset.label}
                                            <div className="w-2 h-2 rounded-full bg-slate-700 group-hover:bg-amber-500" />
                                        </button>
                                    ))}
                                </div>
                                
                                <div className="pt-4">
                                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                                        <span className="flex items-center gap-2 font-bold"><Activity className="w-4 h-4 text-blue-500"/> Handheld Shake</span>
                                        <span className="bg-slate-900 px-2 rounded text-blue-400">{settings.shake}</span>
                                    </div>
                                    <input 
                                    type="range" min="0" max="10" 
                                    value={settings.shake} onChange={e => setSettings(s => ({...s, shake: parseInt(e.target.value)}))}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                                        <span>Tripod</span>
                                        <span>Action Cam</span>
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-3 space-y-6 pl-4 border-l border-slate-800/50">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span className="font-bold flex gap-2"><Maximize2 className="w-4 h-4"/> Zoom</span>
                                        <span>{settings.zoom}</span>
                                    </div>
                                    <input 
                                    type="range" min="-10" max="10" 
                                    value={settings.zoom} onChange={e => setSettings(s => ({...s, zoom: parseInt(e.target.value)}))}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span className="font-bold flex gap-2"><RotateCcw className="w-4 h-4"/> Roll</span>
                                        <span>{settings.roll}°</span>
                                    </div>
                                    <input 
                                    type="range" min="-10" max="10" 
                                    value={settings.roll} onChange={e => setSettings(s => ({...s, roll: parseInt(e.target.value)}))}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>

                                <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer hover:border-amber-500/50 transition-colors mt-6">
                                    <input type="checkbox" checked={settings.isStaticCamera} onChange={e => setSettings(s => ({...s, isStaticCamera: e.target.checked}))} className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500" />
                                    <Lock className="w-4 h-4 text-slate-500" />
                                    <div>
                                        <span className="text-xs text-slate-200 font-bold block">Static Camera</span>
                                        <span className="text-[10px] text-slate-500">Lock movement completely</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* MOTION TAB */}
                    {activeTab === 'motion' && (
                        <div className="grid grid-cols-2 gap-16 max-w-5xl mx-auto pt-4">
                            <div className="space-y-8">
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-2">
                                            <Move className="w-5 h-5 text-amber-500" />
                                            <span className="text-sm font-bold text-white uppercase">Motion Intensity</span>
                                        </div>
                                        <span className="text-2xl font-mono font-bold text-amber-500">{settings.motionBucketId}</span>
                                    </div>
                                    
                                    <input 
                                    type="range" min="1" max="127" 
                                    value={settings.motionBucketId} onChange={e => setSettings(s => ({...s, motionBucketId: parseInt(e.target.value)}))}
                                    className="w-full h-4 bg-slate-950 rounded-full appearance-none cursor-pointer accent-amber-500 border border-slate-800"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-3 font-bold uppercase tracking-wider">
                                        <span>Subtle</span>
                                        <span>Balanced</span>
                                        <span>Wild</span>
                                    </div>
                                    <p className="mt-4 text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800/50 leading-relaxed">
                                        Higher values create larger movements (running, vehicles) but may reduce consistency. Lower values are better for subtle animations (blinking, clouds).
                                    </p>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                                        <span className="font-bold uppercase">Noise Augmentation (Creativity)</span>
                                        <span className="text-blue-400">{settings.noiseAugmentation}</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="1" step="0.05"
                                        value={settings.noiseAugmentation} onChange={e => setSettings(s => ({...s, noiseAugmentation: parseFloat(e.target.value)}))}
                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                    <h4 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-purple-500"/> Consistency Seed
                                    </h4>
                                    
                                    <div className="flex gap-4">
                                        <div className="flex-1 relative">
                                            <input 
                                                type="number" 
                                                value={settings.seed === -1 ? '' : settings.seed}
                                                placeholder="Random (-1)"
                                                onChange={(e) => setSettings(s => ({...s, seed: parseInt(e.target.value) || -1}))}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-4 text-sm text-white focus:border-purple-500 outline-none font-mono"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                                                {settings.seed === -1 ? 'RANDOM' : 'FIXED'}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setSettings(s => ({...s, seed: -1}))}
                                            className="px-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white text-slate-400 transition-colors"
                                            title="Randomize"
                                        >
                                            <Dice5 className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <p className="mt-3 text-xs text-slate-500">
                                        Use the same seed to generate the same video motion again (e.g. for upscaling or minor tweaks).
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-green-900/10 p-4 rounded-xl border border-green-900/30">
                                        <h5 className="text-green-500 font-bold text-xs uppercase mb-2">Low Motion Guide</h5>
                                        <ul className="text-[10px] text-slate-400 space-y-1 list-disc list-inside">
                                            <li>Talking Heads</li>
                                            <li>Slow Panoramas</li>
                                            <li>Candlelight</li>
                                        </ul>
                                    </div>
                                    <div className="bg-red-900/10 p-4 rounded-xl border border-red-900/30">
                                        <h5 className="text-red-500 font-bold text-xs uppercase mb-2">High Motion Guide</h5>
                                        <ul className="text-[10px] text-slate-400 space-y-1 list-disc list-inside">
                                            <li>Sports / Action</li>
                                            <li>Fast Vehicles</li>
                                            <li>Explosions</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PROMPT TAB */}
                    {activeTab === 'prompt' && (
                        <div className="max-w-6xl mx-auto h-full flex gap-8">
                            <div className="flex-1 space-y-4 flex flex-col h-full">
                                <label className="text-sm font-bold text-amber-500 uppercase flex justify-between items-end border-b border-slate-800 pb-2">
                                    <span className="flex items-center gap-2"><Wand2 className="w-4 h-4"/> Director Prompt</span>
                                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">{settings.prompt.length} / 1000</span>
                                </label>
                                <textarea 
                                    value={settings.prompt}
                                    onChange={e => setSettings(s => ({...s, prompt: e.target.value}))}
                                    placeholder="Describe the scene and action in detail. E.g., 'A cyberpunk street at night, neon lights reflecting on wet pavement, camera slowly pans up to reveal a flying car...'"
                                    className="w-full flex-1 bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-base text-white focus:border-amber-500 outline-none resize-y shadow-inner leading-relaxed min-h-[200px]"
                                />
                                
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase mb-2 block">Style Enhancers</span>
                                    <div className="flex flex-wrap gap-2">
                                        {STYLE_TAGS.map(tag => (
                                            <button 
                                                key={tag} 
                                                onClick={() => toggleStyleTag(tag)}
                                                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${settings.prompt.includes(tag) ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
                                            >
                                                + {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="w-80 space-y-6 flex flex-col pt-2">
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <label className="text-xs font-bold text-red-400 uppercase mb-3 block flex items-center gap-2">
                                        <AlertCircle className="w-3 h-3"/> Negative Filter
                                    </label>
                                    <textarea 
                                    value={settings.negativePrompt}
                                    onChange={e => setSettings(s => ({...s, negativePrompt: e.target.value}))}
                                    className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 focus:border-red-500/50 outline-none resize-none"
                                    />
                                </div>
                                
                                <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl flex gap-3">
                                    <Zap className="w-5 h-5 text-blue-500 shrink-0 mt-1" />
                                    <div>
                                        <h5 className="text-blue-400 font-bold text-xs uppercase mb-1">Smart Tip</h5>
                                        <p className="text-xs text-blue-200/70 leading-relaxed">
                                            Veo works best when you describe <strong>movement</strong> rather than just the subject. Use verbs like "runs", "flies", "melts", "explodes".
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EXPORT TAB */}
                    {activeTab === 'export' && (
                        <div className="grid grid-cols-2 gap-16 max-w-4xl mx-auto pt-6">
                            <div className="space-y-8">
                                
                                {/* Duration */}
                                <div>
                                    <span className="text-xs font-bold text-slate-300 uppercase mb-4 block flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500"/> Duration Cost</span>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => setSettings(s => ({...s, duration: '5s'}))}
                                            className={`py-4 px-6 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-2 transition-all ${settings.duration === '5s' ? 'bg-amber-500/10 border-amber-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                                        >
                                            <span className="text-lg">5 Seconds</span>
                                            <span className="text-[10px] opacity-70 font-normal bg-black/20 px-2 py-0.5 rounded-full">1 Credit</span>
                                        </button>
                                        <button 
                                            onClick={() => setSettings(s => ({...s, duration: '10s'}))}
                                            className={`py-4 px-6 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-2 transition-all ${settings.duration === '10s' ? 'bg-amber-500/10 border-amber-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                                        >
                                            <span className="text-lg">10 Seconds</span>
                                            <span className="text-[10px] opacity-70 font-normal bg-black/20 px-2 py-0.5 rounded-full">2 Credits</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Aspect Ratio */}
                                <div>
                                    <span className="text-xs font-bold text-slate-300 uppercase mb-4 block flex items-center gap-2"><Crop className="w-4 h-4 text-blue-500"/> Output Format</span>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[VideoAspectRatio.RATIO_16_9, VideoAspectRatio.RATIO_9_16, VideoAspectRatio.RATIO_1_1].map(ratio => (
                                            <button 
                                                key={ratio}
                                                onClick={() => setSettings(s => ({...s, aspectRatio: ratio}))}
                                                className={`py-3 rounded-lg border text-xs font-bold transition-all ${settings.aspectRatio === ratio ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/80'}`}
                                            >
                                                {ratio}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* FPS */}
                                <div>
                                    <span className="text-xs font-bold text-slate-300 uppercase mb-4 block">Interpolation (FPS)</span>
                                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                                        {[24, 30, 60].map(fps => (
                                            <button 
                                            key={fps}
                                            onClick={() => setSettings(s => ({...s, fps: fps as any}))}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                                settings.fps === fps 
                                                ? 'bg-slate-700 text-white shadow-sm' 
                                                : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                            >
                                                {fps} FPS
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-sm font-bold text-white uppercase mb-4 pb-2 border-b border-slate-800">AI Post-Processing</h4>
                                
                                <label className="flex items-start justify-between p-5 bg-slate-900 rounded-2xl border border-slate-800 cursor-pointer hover:border-purple-500/50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                                            <Maximize2 className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">Resolution</span>
                                            <span className="text-xs text-slate-500">Output quality selector</span>
                                        </div>
                                    </div>
                                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-700">
                                       <button 
                                          onClick={() => setSettings(s => ({...s, resolution: '720p'}))}
                                          className={`px-3 py-1 text-xs rounded transition-all ${settings.resolution === '720p' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                                       >
                                           720p
                                       </button>
                                       <button 
                                          onClick={() => setSettings(s => ({...s, resolution: '1080p'}))}
                                          className={`px-3 py-1 text-xs rounded transition-all ${settings.resolution === '1080p' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}
                                       >
                                           1080p
                                       </button>
                                    </div>
                                </label>

                                <label className="flex items-start justify-between p-5 bg-slate-900 rounded-2xl border border-slate-800 cursor-pointer hover:border-green-500/50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                                            <RotateCcw className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-base font-bold text-white group-hover:text-green-300 transition-colors">Seamless Loop</span>
                                            <span className="text-xs text-slate-500">Apply cross-fade for infinite playback</span>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input type="checkbox" checked={settings.loop} onChange={e => setSettings(s => ({...s, loop: e.target.checked}))} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                    </div>
                                </label>
                                
                                <div className="mt-8 bg-black p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Smartphone className="w-5 h-5 text-slate-500" />
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase">Target Platform</p>
                                            <p className="text-sm font-bold text-white">
                                                {settings.aspectRatio === '9:16' ? 'TikTok / Shorts / Reels' : settings.aspectRatio === '16:9' ? 'YouTube / TV / Cinema' : 'Instagram Feed'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-xs text-slate-500">Est. Render Time</span>
                                        <span className="block text-sm font-mono text-amber-500">{settings.resolution === '1080p' ? '~4 mins' : '~2 mins'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
         </div>
         
         <GalleryPicker 
            isOpen={showPicker}
            onClose={() => setShowPicker(false)}
            images={images}
            onSelect={(url) => setSourceImage(url)}
         />

      </div>
    </div>
  );
};

export default VideoStudio;
