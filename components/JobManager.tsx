
import React, { useState } from 'react';
import { X, Play, Pause, RotateCw, Trash2, Download, Save, CheckCircle2, AlertCircle, Loader2, Layers, Eye, Edit2 } from 'lucide-react';
import { BatchTask, Category } from '../types';

interface Props {
  queue: BatchTask[];
  isQueueRunning: boolean;
  onToggleQueue: () => void;
  onClearQueue: () => void;
  onRemoveTask: (id: string) => void;
  onSaveTask: (task: BatchTask, categoryId?: string, shouldEdit?: boolean) => void;
  onClose: () => void;
  categories: Category[];
}

const JobManager: React.FC<Props> = ({ 
    queue, 
    isQueueRunning, 
    onToggleQueue, 
    onClearQueue, 
    onRemoveTask, 
    onSaveTask, 
    onClose,
    categories
}) => {
  
  const pendingCount = queue.filter(t => t.status === 'PENDING').length;
  const processingCount = queue.filter(t => t.status === 'PROCESSING').length;
  
  // State for Preview Modal
  const [previewTask, setPreviewTask] = useState<BatchTask | null>(null);
  const [selectedFolder, setSelectedFolder] = useState('default');

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

  const handlePreviewSave = (edit: boolean) => {
      if (previewTask) {
          onSaveTask(previewTask, selectedFolder, edit);
          setPreviewTask(null);
      }
  };

  return (
    <>
    <div className="fixed top-16 right-4 bottom-4 w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[60] flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                <div>
                    <h3 className="text-sm font-bold text-white">Global Job Manager</h3>
                    <p className="text-[10px] text-slate-500">{pendingCount} Pending • {processingCount} Running</p>
                </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Controls */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex gap-2">
            <button 
                onClick={onToggleQueue}
                className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-all ${isQueueRunning ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-green-600 border-green-500 text-white'}`}
            >
                {isQueueRunning ? <><Pause className="w-3 h-3"/> Pause Queue</> : <><Play className="w-3 h-3"/> Resume Queue</>}
            </button>
            <button 
                onClick={onClearQueue}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-red-400 hover:border-red-400"
                title="Clear All"
            >
                <RotateCw className="w-4 h-4" />
            </button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-950/50">
            {queue.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                    <Layers className="w-10 h-10 opacity-20" />
                    <p className="text-xs">No active jobs.</p>
                </div>
            )}
            
            {/* Show Running/Pending First */}
            {queue.map(task => (
                <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 relative group transition-all hover:border-slate-600">
                    <div className="flex gap-3">
                        <div 
                            className={`relative w-12 h-12 rounded bg-slate-800 overflow-hidden shrink-0 border border-slate-700 ${task.status === 'COMPLETED' ? 'cursor-pointer hover:border-amber-500' : ''}`}
                            onClick={() => { if(task.status === 'COMPLETED' && task.resultUrl) setPreviewTask(task); }}
                        >
                            <img src={task.refImage || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='} className="w-full h-full object-cover opacity-60" alt="ref" />
                            {task.resultUrl && (
                                <img src={task.resultUrl} className="absolute inset-0 w-full h-full object-cover animate-fade-in" alt="res" />
                            )}
                            {task.status === 'COMPLETED' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100">
                                    <Eye className="w-4 h-4 text-white drop-shadow-md" />
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start">
                                 <h4 className="text-xs font-bold text-white truncate pr-4">{task.styleName}</h4>
                                 <button 
                                    onClick={() => onRemoveTask(task.id)}
                                    className="text-slate-600 hover:text-red-500"
                                 >
                                     <X className="w-3 h-3" />
                                 </button>
                             </div>
                             
                             <div className="mt-2 flex items-center justify-between">
                                 {task.status === 'PENDING' && <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded">Queued</span>}
                                 {task.status === 'PROCESSING' && (
                                     <span className="text-[10px] text-amber-500 flex items-center gap-1">
                                         <Loader2 className="w-3 h-3 animate-spin" /> Generating...
                                     </span>
                                 )}
                                 {task.status === 'COMPLETED' && (
                                     <span className="text-[10px] text-green-500 flex items-center gap-1">
                                         <CheckCircle2 className="w-3 h-3" /> Done
                                     </span>
                                 )}
                                 {task.status === 'FAILED' && (
                                     <span className="text-[10px] text-red-500 flex items-center gap-1">
                                         <AlertCircle className="w-3 h-3" /> Failed
                                     </span>
                                 )}
                             </div>
                        </div>
                    </div>

                    {/* Progress Bar for Active */}
                    {(task.status === 'PROCESSING' || task.status === 'PENDING') && (
                        <div className="mt-2 h-1 w-full bg-slate-950 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${task.progress}%` }} />
                        </div>
                    )}

                    {/* Actions for Completed */}
                    {task.status === 'COMPLETED' && task.resultUrl && (
                        <div className="mt-2 pt-2 border-t border-slate-800 flex gap-2">
                             <button 
                                onClick={() => onSaveTask(task)}
                                className="flex-1 py-1.5 bg-green-900/30 hover:bg-green-600 text-green-400 hover:text-white rounded text-[10px] font-bold border border-green-900 transition-colors flex items-center justify-center gap-1"
                             >
                                 <Save className="w-3 h-3" /> Save
                             </button>
                             <button 
                                onClick={() => setPreviewTask(task)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 flex items-center gap-1 text-[10px]"
                             >
                                 <Eye className="w-3 h-3" /> View
                             </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>

    {/* Preview Lightbox Modal */}
    {previewTask && (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden shadow-2xl relative">
                
                {/* Close Button */}
                <button 
                    onClick={() => setPreviewTask(null)}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-red-500 text-white rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Left: Image Viewer */}
                <div className="flex-1 bg-black flex items-center justify-center relative p-4">
                    {previewTask.type === 'VIDEO_GEN' ? (
                        <video src={previewTask.resultUrl} controls autoPlay className="max-w-full max-h-full rounded shadow-lg" />
                    ) : (
                        <img src={previewTask.resultUrl} className="max-w-full max-h-full object-contain rounded shadow-lg" alt="Preview" />
                    )}
                    <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg text-xs text-white backdrop-blur-md">
                        {previewTask.type === 'VIDEO_GEN' ? 'Video Asset' : 'Image Asset'} • {new Date(previewTask.createdAt).toLocaleTimeString()}
                    </div>
                </div>

                {/* Right: Actions Panel */}
                <div className="w-80 border-l border-slate-800 bg-slate-950 p-6 flex flex-col gap-6">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Result Preview</h3>
                        <p className="text-xs text-slate-500">Review and save your generated asset.</p>
                    </div>

                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                         <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Prompt Info</label>
                         <p className="text-xs text-slate-300 line-clamp-6 leading-relaxed">
                            {previewTask.payload?.prompt || previewTask.styleName}
                         </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                             <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Destination Folder</label>
                             <select 
                                value={selectedFolder}
                                onChange={(e) => setSelectedFolder(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-amber-500 outline-none"
                             >
                                 <option value="default">General (Root)</option>
                                 {renderCategoryOptions(null)}
                             </select>
                        </div>

                        <button 
                            onClick={() => handlePreviewSave(false)}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20"
                        >
                            <Save className="w-4 h-4" /> Save to Library
                        </button>

                        {previewTask.type === 'IMAGE_GEN' && (
                            <button 
                                onClick={() => handlePreviewSave(true)}
                                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/20"
                            >
                                <Edit2 className="w-4 h-4" /> Save & Edit in Studio
                            </button>
                        )}

                        <a 
                           href={previewTask.resultUrl} 
                           download={`download-${previewTask.id}`}
                           className="flex w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl items-center justify-center gap-2 border border-slate-700 transition-all"
                        >
                           <Download className="w-4 h-4" /> Download File
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default JobManager;
