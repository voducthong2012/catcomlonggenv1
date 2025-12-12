
import React, { useState, useMemo } from 'react';
import { X, Search, Image as ImageIcon } from 'lucide-react';
import { GeneratedImage } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (base64Url: string) => void;
  images: GeneratedImage[];
}

const GalleryPicker: React.FC<Props> = ({ isOpen, onClose, onSelect, images }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return images;
    return images.filter(img => 
        (img.name || img.prompt).toLowerCase().includes(search.toLowerCase())
    );
  }, [images, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
             <ImageIcon className="w-5 h-5 text-amber-500" /> Select from Gallery
           </h3>
           <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
             <X className="w-5 h-5" />
           </button>
        </div>

        {/* Search */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search your assets..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-amber-500 outline-none"
                autoFocus
              />
           </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-950">
           {filtered.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-500">
                   <p>No images found.</p>
               </div>
           ) : (
               <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                   {filtered.map(img => (
                       <button 
                         key={img.id}
                         onClick={() => { onSelect(img.url); onClose(); }}
                         className="group relative aspect-square rounded-lg overflow-hidden border border-slate-800 hover:border-amber-500 transition-all"
                       >
                           <img src={img.url} className="w-full h-full object-cover" loading="lazy" alt="asset" />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">SELECT</span>
                           </div>
                           <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 truncate text-[10px] text-slate-300">
                               {img.name || img.prompt}
                           </div>
                       </button>
                   ))}
               </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default GalleryPicker;
