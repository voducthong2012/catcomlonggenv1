
import React, { useState, useRef } from 'react';
import { Folder, Plus, Trash2, Edit2, FolderOpen, Box, Signal, ChevronRight, ChevronDown, CornerDownRight, Settings, Upload, Download, Database, RefreshCw, FolderOutput, HardDrive } from 'lucide-react';
import { Category } from '../types';

interface Props {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string) => void;
  onAddCategory: (name: string, parentId: string | null) => void;
  onDeleteCategory: (id: string) => void;
  onEditCategory: (id: string, name: string) => void;
  onToggleCollapse: (id: string) => void;
  // Data props
  onExportData: () => void;
  onImportData: (file: File) => void;
  onResetData: () => void;
  onExportToFolders: () => void; // New Prop
}

const CategorySidebar: React.FC<Props> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onAddCategory,
  onDeleteCategory,
  onEditCategory,
  onToggleCollapse,
  onExportData,
  onImportData,
  onResetData,
  onExportToFolders
}) => {
  const [addingToParent, setAddingToParent] = useState<string | null>(null); // 'root' or categoryId
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showDataMenu, setShowDataMenu] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (newCategoryName.trim()) {
      const parentId = addingToParent === 'root' ? null : addingToParent;
      onAddCategory(newCategoryName.trim(), parentId);
      setNewCategoryName('');
      setAddingToParent(null);
    }
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      onEditCategory(id, editName.trim());
      setEditingId(null);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files && e.target.files[0]) {
          onImportData(e.target.files[0]);
          setShowDataMenu(false);
      }
  };

  // Helper to check if a category has children
  const hasChildren = (catId: string) => categories.some(c => c.parentId === catId);

  // Recursive Tree Renderer
  const renderTree = (parentId: string | null, depth: number = 0) => {
    // Filter nodes that belong to this parent
    const nodes = categories.filter(c => 
        parentId === null 
        ? (!c.parentId) 
        : (c.parentId === parentId)
    );
    
    if (nodes.length === 0) return null;

    return (
      <div className="space-y-1">
        {nodes.map(cat => {
          const isParent = hasChildren(cat.id);
          const isSelected = selectedCategoryId === cat.id;
          
          return (
            <div key={cat.id} className="select-none">
              <div 
                className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-all cursor-pointer
                  ${isSelected ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-slate-300 hover:bg-slate-800 border border-transparent'}
                `}
                style={{ marginLeft: `${depth * 12}px` }}
                onClick={() => onSelectCategory(cat.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Collapse Toggle */}
                  <div 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        if(isParent) onToggleCollapse(cat.id); 
                    }}
                    className={`p-0.5 rounded hover:bg-slate-700 ${!isParent ? 'opacity-0 cursor-default' : 'cursor-pointer'}`}
                  >
                     {cat.isCollapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                  </div>

                  {/* Icon */}
                  {isSelected ? <FolderOpen className="w-4 h-4 shrink-0" /> : <Folder className="w-4 h-4 shrink-0 text-slate-500" />}
                  
                  {/* Name or Edit Input */}
                  {editingId === cat.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => handleSaveEdit(cat.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(cat.id)}
                      className="w-full bg-slate-950 text-white text-xs px-1 py-0.5 rounded border border-amber-500 focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <span className="truncate font-medium">{cat.name}</span>
                  )}
                </div>

                {/* Hover Actions */}
                {editingId !== cat.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button
                        onClick={(e) => { e.stopPropagation(); setAddingToParent(cat.id); }}
                        className="p-1 text-slate-400 hover:text-green-400 hover:bg-slate-700 rounded"
                        title="Add Subfolder"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(cat.id); setEditName(cat.name); }}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {cat.id !== 'default' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                  </div>
                )}
              </div>

              {/* Sub-folder Input */}
              {addingToParent === cat.id && (
                 <div className="ml-8 mt-1 mb-1 p-1 pr-2 bg-slate-900 rounded border border-amber-500/30 flex items-center gap-2">
                    <CornerDownRight className="w-3 h-3 text-slate-500" />
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full bg-transparent border-none text-xs text-white placeholder-slate-500 focus:ring-0 px-0"
                      placeholder="Subfolder name..."
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                      onBlur={() => setAddingToParent(null)}
                    />
                 </div>
              )}

              {/* Recursive Children */}
              {!cat.isCollapsed && renderTree(cat.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-72 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-slate-800 flex items-center gap-2 text-amber-500">
        <Box className="w-6 h-6" />
        <h1 className="text-lg font-bold tracking-tight text-white">CATCOM <span className="text-amber-500">GEN</span></h1>
      </div>

      <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
        {/* Actions Header */}
        <div className="flex justify-between items-center mb-3 px-2">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Explorer</h2>
          <button 
            onClick={() => setAddingToParent('root')}
            className="text-amber-500 hover:text-amber-400 p-1 hover:bg-slate-800 rounded transition-colors"
            title="New Root Folder"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Root Input */}
        {addingToParent === 'root' && (
          <div className="mb-2 mx-2 p-2 bg-slate-800 rounded-lg border border-amber-500/30">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full bg-transparent border-none text-sm text-white placeholder-slate-500 focus:ring-0 px-1"
              placeholder="Root Folder Name..."
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              onBlur={() => setAddingToParent(null)}
            />
          </div>
        )}

        <div className="space-y-1">
          {/* All Images System Folder */}
          <button
            onClick={() => onSelectCategory('all')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all border border-transparent ${
              selectedCategoryId === 'all' 
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Box className="w-4 h-4" />
            <span className="font-medium">All Assets</span>
          </button>
          
          <div className="h-px bg-slate-800 my-2 mx-2"></div>

          {/* Tree View */}
          {renderTree(null)}
        </div>
      </div>

      {/* SYSTEM DATA MENU */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/30 relative">
        {showDataMenu && (
             <div className="absolute bottom-full left-0 w-full mb-1 bg-slate-900 border border-slate-700 rounded-t-xl overflow-hidden shadow-2xl z-20">
                 <div className="p-3 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase">System Data</div>
                 <button onClick={onExportToFolders} className="w-full text-left px-4 py-3 hover:bg-slate-800 text-amber-400 text-sm flex items-center gap-2 border-b border-slate-800/50">
                     <HardDrive className="w-4 h-4" /> Connect PC/Drive Folder (Live Sync)
                 </button>
                 <button onClick={onExportData} className="w-full text-left px-4 py-3 hover:bg-slate-800 text-slate-300 text-sm flex items-center gap-2">
                     <Download className="w-4 h-4 text-blue-500" /> Backup (JSON File)
                 </button>
                 <button onClick={() => importInputRef.current?.click()} className="w-full text-left px-4 py-3 hover:bg-slate-800 text-slate-300 text-sm flex items-center gap-2">
                     <Upload className="w-4 h-4 text-green-500" /> Restore (Import)
                 </button>
                 <button onClick={onResetData} className="w-full text-left px-4 py-3 hover:bg-slate-800 text-red-400 text-sm flex items-center gap-2">
                     <RefreshCw className="w-4 h-4" /> Reset All Data
                 </button>
                 <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleFileImport} />
             </div>
        )}

        <div className="flex justify-between items-center">
            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                <Database className="w-3 h-3 text-amber-500" />
                <p>DB: IndexedDB (Unlim)</p>
            </div>
            <button 
                onClick={() => setShowDataMenu(!showDataMenu)} 
                className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ${showDataMenu ? 'bg-slate-800 text-amber-500' : ''}`}
                title="Manage Data"
            >
                <Settings className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default CategorySidebar;
