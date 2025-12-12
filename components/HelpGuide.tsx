
import React from 'react';
import { X, Book, Workflow, Layers, MousePointerClick, Zap, Cloud, HardDrive, Users } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const HelpGuide: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-6 flex justify-between items-center z-10">
           <div className="flex items-center gap-3">
             <Book className="w-6 h-6 text-amber-500" />
             <h2 className="text-xl font-bold text-white">CATCOM Workflow Guide</h2>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-10">
           
           {/* Section 1: Intro */}
           <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                 <h3 className="text-2xl font-bold text-amber-500 mb-3">CATCOM IMAGE GEN</h3>
                 <p className="text-slate-300 leading-relaxed">
                   Welcome to the next generation of AI concept creation. This studio is designed for sellers, designers, and marketers to rapidly generate high-quality product concepts.
                 </p>
              </div>
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                 <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Features Overview</h4>
                 <ul className="space-y-3 text-slate-400 text-sm">
                    <li className="flex gap-2 items-center"><Zap className="w-4 h-4 text-amber-500"/> Single Creation Studio (Manual Mode)</li>
                    <li className="flex gap-2 items-center"><Layers className="w-4 h-4 text-amber-500"/> CATCOM Batch Studio (Automated Bulk Gen)</li>
                    <li className="flex gap-2 items-center"><MousePointerClick className="w-4 h-4 text-amber-500"/> Inpainting & Smart Editing</li>
                    <li className="flex gap-2 items-center"><Cloud className="w-4 h-4 text-amber-500"/> Team Sync via Google Drive</li>
                 </ul>
              </div>
           </div>

           {/* SPECIAL SECTION: GOOGLE DRIVE SYNC */}
           <div className="bg-blue-900/10 p-6 rounded-xl border border-blue-500/30">
               <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                 <Users className="w-5 h-5 text-blue-400" /> Team Sync & Google Drive
               </h3>
               <p className="text-slate-300 text-sm mb-4">
                  To sync images between multiple users (A, B, C) using the deployed app, follow this workflow:
               </p>
               
               <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                     <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold text-sm">
                        <HardDrive className="w-4 h-4" /> 1. Install Drive for Desktop
                     </div>
                     <p className="text-xs text-slate-400">
                        Install "Google Drive for Desktop" on your PC. This creates a virtual drive (e.g., G:) that acts like a local folder.
                     </p>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                     <div className="flex items-center gap-2 mb-2 text-amber-500 font-bold text-sm">
                        <Zap className="w-4 h-4" /> 2. Connect Live Sync
                     </div>
                     <p className="text-xs text-slate-400">
                        In this Web App, go to <strong>System Data</strong> &rarr; <strong>Connect PC/Drive Folder</strong>.
                     </p>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                     <div className="flex items-center gap-2 mb-2 text-green-500 font-bold text-sm">
                        <Cloud className="w-4 h-4" /> 3. Auto Sync
                     </div>
                     <p className="text-xs text-slate-400">
                        Any image you generate or save will instantly be written to that Drive folder. Your team members will see the files appear on their computers automatically.
                     </p>
                  </div>
               </div>
           </div>

           {/* Section 2: Standard Workflow */}
           <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/50">
               <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                 <MousePointerClick className="w-5 h-5 text-blue-500" /> Standard Creation Flow
               </h3>
               <div className="flex flex-col md:flex-row gap-4 text-center">
                   <div className="flex-1 bg-slate-900 p-4 rounded-lg border border-slate-800 relative">
                      <div className="w-8 h-8 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center font-bold mx-auto mb-3">1</div>
                      <h4 className="text-white font-medium mb-1">Select Collection</h4>
                      <p className="text-xs text-slate-500">Create or choose a category on the left sidebar to organize your output.</p>
                   </div>
                   <div className="hidden md:block text-slate-600 self-center">→</div>
                   <div className="flex-1 bg-slate-900 p-4 rounded-lg border border-slate-800 relative">
                      <div className="w-8 h-8 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center font-bold mx-auto mb-3">2</div>
                      <h4 className="text-white font-medium mb-1">Upload Reference</h4>
                      <p className="text-xs text-slate-500">Upload your product photo. Adjust 'Strength' to control creativity vs fidelity.</p>
                   </div>
                   <div className="hidden md:block text-slate-600 self-center">→</div>
                   <div className="flex-1 bg-slate-900 p-4 rounded-lg border border-slate-800 relative">
                      <div className="w-8 h-8 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center font-bold mx-auto mb-3">3</div>
                      <h4 className="text-white font-medium mb-1">Prompt & Generate</h4>
                      <p className="text-xs text-slate-500">Describe the scene. Hit Generate. View and edit results in the Canvas.</p>
                   </div>
               </div>
           </div>

           {/* Section 3: Batch Automation */}
           <div className="bg-amber-900/10 p-6 rounded-xl border border-amber-500/20">
               <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                 <Layers className="w-5 h-5 text-amber-500" /> Batch Automation Flow
               </h3>
               <div className="grid md:grid-cols-2 gap-6">
                   <div>
                       <p className="text-slate-300 text-sm mb-4">
                           Use the <strong>Batch Studio</strong> tab to automate repetitive tasks. Perfect for generating multiple concepts for a single product.
                       </p>
                       <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
                           <li>Upload multiple angles of your product.</li>
                           <li>Select multiple <strong>Style Cards</strong> (Cyberpunk, Studio, Nature, etc.).</li>
                           <li>Set the quantity per style (e.g., 4 variations).</li>
                           <li>Click <strong>Start Queue</strong>. The system will process tasks in the background.</li>
                       </ol>
                   </div>
                   <div className="bg-black/40 p-4 rounded-lg border border-white/5 flex items-center justify-center">
                       <div className="text-center">
                           <div className="inline-block p-3 bg-amber-500/20 rounded-lg mb-2">
                               <span className="text-amber-500 font-mono text-xs">QUEUE: PROCESSING</span>
                           </div>
                           <p className="text-xs text-slate-500">Runs automatically while you review results.</p>
                       </div>
                   </div>
               </div>
           </div>

           {/* Footer Contact */}
           <div className="border-t border-slate-800 pt-8 mt-8">
               <h4 className="text-white font-bold mb-4">Support & License</h4>
               <div className="grid md:grid-cols-3 gap-4 text-sm">
                   <div className="bg-slate-900 p-3 rounded border border-slate-800">
                       <span className="text-slate-500 block text-xs uppercase">Developer</span>
                       <span className="text-white">Thống Võ</span>
                   </div>
                   <div className="bg-slate-900 p-3 rounded border border-slate-800">
                       <span className="text-slate-500 block text-xs uppercase">Email</span>
                       <span className="text-white">thongvo@catcommedia.com</span>
                   </div>
                   <div className="bg-slate-900 p-3 rounded border border-slate-800">
                       <span className="text-slate-500 block text-xs uppercase">Phone</span>
                       <span className="text-white">0334735315</span>
                   </div>
               </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default HelpGuide;
