

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const cleanBase64 = (base64: string): string => {
  return base64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
};

// Dimensions map based on Aspect Ratio
export const getDimensions = (ratio: string): { width: number; height: number } => {
  switch (ratio) {
    case '1:1': return { width: 1024, height: 1024 };
    case '3:4': return { width: 768, height: 1024 };
    case '4:3': return { width: 1024, height: 768 };
    case '9:16': return { width: 576, height: 1024 };
    case '16:9': return { width: 1024, height: 576 };
    default:
      // Handle custom ratio W:H
      const parts = ratio.split(':');
      if (parts.length === 2) {
        const w = parseFloat(parts[0]);
        const h = parseFloat(parts[1]);
        if (!isNaN(w) && !isNaN(h) && h > 0) {
            // Target roughly 1MP (1024x1024 area)
            const targetArea = 1024 * 1024;
            const floatRatio = w / h;
            // height = sqrt(Area / ratio)
            const calculatedHeight = Math.sqrt(targetArea / floatRatio);
            const calculatedWidth = calculatedHeight * floatRatio;
            return { width: Math.round(calculatedWidth), height: Math.round(calculatedHeight) };
        }
      }
      return { width: 1024, height: 1024 };
  }
};

// --- API RATE LIMIT UTILITIES ---

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Tracks API usage per minute to help UI visualize load.
 * TUNED FOR TIER 1 (Paid): ~20 RPM for Image Gen
 */
export class RateLimitTracker {
    private static timestamps: number[] = [];
    private static readonly WINDOW_MS = 60000; // 1 minute
    
    // Updated limits based on user's Tier 1 screenshot (Max 20 RPM)
    private static readonly WARNING_THRESHOLD = 15; // Start warning at 15
    private static readonly CRITICAL_THRESHOLD = 20; // Block/Critical at 20

    static recordRequest() {
        this.timestamps.push(Date.now());
        this.cleanup();
    }

    static getRPM(): number {
        this.cleanup();
        return this.timestamps.length;
    }

    static getStatus(): 'HEALTHY' | 'WARNING' | 'CRITICAL' {
        const rpm = this.getRPM();
        if (rpm >= this.CRITICAL_THRESHOLD) return 'CRITICAL';
        if (rpm >= this.WARNING_THRESHOLD) return 'WARNING';
        return 'HEALTHY';
    }

    static reset() {
        this.timestamps = [];
    }

    private static cleanup() {
        const now = Date.now();
        this.timestamps = this.timestamps.filter(t => now - t < this.WINDOW_MS);
    }
}


/**
 * Retries an async operation with exponential backoff.
 * Useful for handling HTTP 429 (Too Many Requests) or 503 errors.
 * 
 * @param operation The async function to execute
 * @param maxRetries Maximum number of retries (default: 3)
 * @param baseDelay Initial delay in ms (default: 2000)
 */
export async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 2000
): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) RateLimitTracker.recordRequest(); // Track retries as load
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            // Check if error is related to rate limiting or server overload
            const isRateLimit = error.message?.includes('429') || 
                                error.message?.includes('503') ||
                                error.message?.includes('Resource has been exhausted') ||
                                error.status === 429 ||
                                error.status === 503;

            if (attempt < maxRetries && isRateLimit) {
                // Exponential Backoff: 2s, 4s, 8s...
                const delayTime = baseDelay * Math.pow(2, attempt);
                console.warn(`API Rate Limit hit. Retrying in ${delayTime}ms (Attempt ${attempt + 1}/${maxRetries})...`);
                await wait(delayTime);
            } else {
                // If not a rate limit error, or retries exhausted, throw immediately
                if (!isRateLimit) throw error;
            }
        }
    }
    throw lastError;
}

// --- DATA EXPORT/IMPORT UTILS ---

export const exportDataToJson = (data: any, filename: string) => {
  const jsonStr = JSON.stringify(data);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importDataFromJson = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// --- FILE SYSTEM ACCESS API (PC FOLDERS) ---

export const verifyEnvironment = () => {
    // Check if running in iframe (common in online editors/previews)
    if (window.self !== window.top) {
        throw new Error("Security Restriction: Live Sync (File System Access) requires the app to be opened in a new dedicated tab/window, not inside an iframe.");
    }
    // Check browser support
    if (!('showDirectoryPicker' in window)) {
        throw new Error("Your browser does not support File System Access (Try Chrome, Edge, or Opera on Desktop).");
    }
};

export const saveToLocalFolder = async (images: any[], categories: any[]) => {
    verifyEnvironment();

    // 1. Ask user to pick root directory
    // @ts-ignore
    const rootHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
    });

    // Helper: Resolve full path names for a category ID
    const getCategoryPath = (catId: string): string[] => {
        if (!catId || catId === 'default') return ['Uncategorized'];
        
        const path: string[] = [];
        let currentId: string | null | undefined = catId;
        
        // Safety break to prevent infinite loops
        let depth = 0;
        while (currentId && currentId !== 'default' && depth < 10) {
            const cat = categories.find((c: any) => c.id === currentId);
            if (cat) {
                path.unshift(cat.name); // Add to beginning
                currentId = cat.parentId;
            } else {
                break;
            }
            depth++;
        }
        return path.length > 0 ? path : ['Uncategorized'];
    };

    // Helper: Sanitize filename
    const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_').trim();

    // 2. Iterate and Save
    let successCount = 0;
    
    for (const img of images) {
        try {
            // Find Path
            const folders = getCategoryPath(img.categoryId);
            
            // Navigate/Create Folders
            let dirHandle = rootHandle;
            for (const folderName of folders) {
                const safeFolderName = sanitize(folderName) || 'Untitled_Folder';
                // @ts-ignore
                dirHandle = await dirHandle.getDirectoryHandle(safeFolderName, { create: true });
            }

            // Create File
            const safeName = sanitize(img.name || img.prompt).substring(0, 50) || 'image';
            const fileName = `${safeName}_${img.id.substring(0,4)}.png`;
            
            // @ts-ignore
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            // @ts-ignore
            const writable = await fileHandle.createWritable();

            // Fetch Blob from Base64 URL
            const response = await fetch(img.url);
            const blob = await response.blob();

            await writable.write(blob);
            await writable.close();
            successCount++;
        } catch (err) {
            console.error(`Failed to save image ${img.id}`, err);
        }
    }

    return successCount;
};

// --- LIVE SYNC SINGLE IMAGE ---

export const saveSingleImageToFolder = async (
    syncHandle: any, // The root directory handle
    image: any, 
    categories: any[]
) => {
    if (!syncHandle) return;

    const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_').trim();
    
    const getCategoryPath = (catId: string): string[] => {
        if (!catId || catId === 'default') return ['Uncategorized'];
        const path: string[] = [];
        let currentId: string | null | undefined = catId;
        let depth = 0;
        while (currentId && currentId !== 'default' && depth < 10) {
            const cat = categories.find((c: any) => c.id === currentId);
            if (cat) {
                path.unshift(cat.name);
                currentId = cat.parentId;
            } else {
                break;
            }
            depth++;
        }
        return path.length > 0 ? path : ['Uncategorized'];
    };

    try {
        const folders = getCategoryPath(image.categoryId);
        let dirHandle = syncHandle;
        
        // Navigate Folders
        for (const folderName of folders) {
             const safeFolderName = sanitize(folderName) || 'Untitled_Folder';
             // @ts-ignore
             dirHandle = await dirHandle.getDirectoryHandle(safeFolderName, { create: true });
        }

        // Save File
        const safeName = sanitize(image.name || image.prompt).substring(0, 50) || 'image';
        const fileName = `${safeName}_${image.id.substring(0,4)}.png`;

        // @ts-ignore
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        // @ts-ignore
        const writable = await fileHandle.createWritable();

        const response = await fetch(image.url);
        const blob = await response.blob();
        await writable.write(blob);
        await writable.close();
        
        console.log("Live Sync Saved:", fileName);
        return true;
    } catch (e) {
        console.error("Live Sync Failed", e);
        return false;
    }
};