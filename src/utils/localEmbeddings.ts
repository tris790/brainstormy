import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Configure transformers.js to use browser cache
env.allowLocalModels = false;
env.useBrowserCache = true;

// Available models for local embeddings
export const LOCAL_MODELS = {
  'all-MiniLM-L6-v2': {
    id: 'Xenova/all-MiniLM-L6-v2',
    name: 'All-MiniLM-L6-v2',
    description: 'General purpose, excellent balance (384 dims)',
    size: '~23MB',
    dimensions: 384,
  },
  'bge-small-en-v1.5': {
    id: 'Xenova/bge-small-en-v1.5',
    name: 'BGE-Small-EN',
    description: 'Fast English-only, high quality (384 dims)',
    size: '~33MB',
    dimensions: 384,
  },
  'gte-small': {
    id: 'Xenova/gte-small',
    name: 'GTE-Small',
    description: 'Great for semantic similarity (384 dims)',
    size: '~28MB',
    dimensions: 384,
  },
} as const;

export type LocalModelKey = keyof typeof LOCAL_MODELS;

// Singleton state
let extractor: FeatureExtractionPipeline | null = null;
let currentModelKey: LocalModelKey | null = null;
let isLoading = false;
let loadProgress = 0;

type ProgressCallback = (progress: number, status: string) => void;

// Progress tracking
let progressCallbacks: Set<ProgressCallback> = new Set();

export function subscribeToProgress(callback: ProgressCallback): () => void {
  progressCallbacks.add(callback);
  return () => progressCallbacks.delete(callback);
}

function notifyProgress(progress: number, status: string) {
  progressCallbacks.forEach(cb => cb(progress, status));
}

// Load a model
export async function loadModel(modelKey: LocalModelKey): Promise<void> {
  if (currentModelKey === modelKey && extractor) {
    return; // Already loaded
  }

  if (isLoading) {
    throw new Error('Model is already loading');
  }

  isLoading = true;
  loadProgress = 0;

  const model = LOCAL_MODELS[modelKey];

  try {
    notifyProgress(0, `Loading ${model.name}...`);

    extractor = await pipeline('feature-extraction', model.id, {
      progress_callback: (data: { status: string; progress?: number; file?: string }) => {
        if (data.status === 'progress' && data.progress !== undefined) {
          loadProgress = Math.round(data.progress);
          notifyProgress(loadProgress, `Downloading ${data.file || 'model'}...`);
        } else if (data.status === 'ready') {
          notifyProgress(100, 'Model ready');
        } else if (data.status === 'initiate') {
          notifyProgress(0, `Initializing ${data.file || 'model'}...`);
        }
      },
    });

    currentModelKey = modelKey;
    notifyProgress(100, 'Model loaded');
  } catch (error) {
    console.error('Failed to load model:', error);
    extractor = null;
    currentModelKey = null;
    notifyProgress(0, 'Failed to load model');
    throw error;
  } finally {
    isLoading = false;
  }
}

// Get embedding for text
export async function getLocalEmbedding(text: string): Promise<number[]> {
  if (!extractor) {
    throw new Error('No model loaded. Call loadModel first.');
  }

  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });

  // Convert to regular array
  return Array.from(output.data as Float32Array);
}

// Get embeddings for multiple texts (batch)
export async function getLocalEmbeddings(texts: string[]): Promise<number[][]> {
  if (!extractor) {
    throw new Error('No model loaded. Call loadModel first.');
  }

  const results: number[][] = [];

  for (const text of texts) {
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    results.push(Array.from(output.data as Float32Array));
  }

  return results;
}

// Check if model is loaded
export function isModelLoaded(): boolean {
  return extractor !== null;
}

// Get current model info
export function getCurrentModel(): LocalModelKey | null {
  return currentModelKey;
}

// Get loading state
export function getLoadingState(): { isLoading: boolean; progress: number } {
  return { isLoading, progress: loadProgress };
}

// Unload model to free memory
export function unloadModel(): void {
  extractor = null;
  currentModelKey = null;
  loadProgress = 0;
  notifyProgress(0, 'Model unloaded');
}
