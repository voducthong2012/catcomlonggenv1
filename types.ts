

export interface Category {
  id: string;
  name: string;
  parentId?: string | null; // For nesting
  isCollapsed?: boolean; // UI state
}

export interface GeneratedImage {
  id: string;
  name?: string; // Editable name
  url: string;
  prompt: string;
  negativePrompt?: string;
  categoryId: string;
  createdAt: number;
  width: number;
  height: number;
  model: string;
  isFavorite?: boolean;
  parentId?: string; // ID of the original image if this is an edit
  contentType?: 'image' | 'video'; // New: Support for video files
  generationTime?: number; // Time taken in ms
}

export interface SavedPrompt {
  id: string;
  title: string;
  prompt: string;
  negativePrompt?: string;
  createdAt: number;
}

export type ImageSize = '1K' | '2K' | '4K';

export interface GenerationSettings {
  prompt: string;
  negativePrompt: string;
  aspectRatio: string;
  width: number;
  height: number;
  numImages: number;
  imageStrength: number;
  imageSize: ImageSize;
  model: string;
  targetImages: string[]; 
  refImages: string[];
  colorPalette: string[]; // New: List of hex colors
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  GALLERY = 'GALLERY',
  BATCH = 'BATCH',
  VIDEO_STUDIO = 'VIDEO_STUDIO',
}

export enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT = '3:4',
  LANDSCAPE = '4:3',
  STORY = '9:16',
  CINEMATIC = '16:9',
}

// --- BATCH TYPES ---

export interface BatchStyle {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface BatchTask {
  id: string;
  type: 'IMAGE_GEN' | 'VIDEO_GEN'; // Differentiate task types
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  resultUrl?: string;
  // Visuals for UI
  refImage?: string | null; // Thumbnail
  styleName: string; // Display Name
  createdAt: number;
  // Data needed for execution
  payload: any; 
}

export interface BatchSession {
  id: string;
  createdAt: number;
  tasks: BatchTask[];
}

// --- VIDEO STUDIO TYPES ---

export enum VideoAspectRatio {
  RATIO_16_9 = '16:9',
  RATIO_9_16 = '9:16',
  RATIO_1_1 = '1:1',
}

export interface VideoSettings {
  prompt: string;
  negativePrompt: string;
  // Camera
  panX: number; // -10 to 10
  panY: number; // -10 to 10
  zoom: number; // -10 to 10
  roll: number; // -10 to 10
  isStaticCamera: boolean;
  shake: number; // 0-10
  // Motion
  motionBucketId: number; // 1-127
  noiseAugmentation: number; // 0-1
  seed: number; // -1 for random
  // Quality
  fps: 24 | 30 | 60;
  resolution: '720p' | '1080p'; // Explicit resolution
  loop: boolean;
  duration: '5s' | '10s';
  aspectRatio: VideoAspectRatio;
}