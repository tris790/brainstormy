import { useSettingsStore } from '../store/settingsStore';
import {
  getLocalEmbedding,
  isModelLoaded,
  loadModel,
  getCurrentModel,
} from './localEmbeddings';

const API_BASE = '/api';

// Main embedding function that uses the selected provider
export async function getEmbedding(text: string): Promise<number[]> {
  const { embeddingProvider, localModel } = useSettingsStore.getState();

  if (embeddingProvider === 'local') {
    return getLocalEmbeddingWithFallback(text, localModel);
  }

  return getServerEmbedding(text);
}

// Get embedding from local model
async function getLocalEmbeddingWithFallback(
  text: string,
  modelKey: string
): Promise<number[]> {
  try {
    // Check if the right model is loaded
    if (!isModelLoaded() || getCurrentModel() !== modelKey) {
      // Model not loaded or wrong model - load it
      const { setModelLoadingState, setModelReady } = useSettingsStore.getState();
      setModelLoadingState(true, 0, 'Loading model...');

      try {
        await loadModel(modelKey as Parameters<typeof loadModel>[0]);
        setModelReady(true);
      } finally {
        setModelLoadingState(false, 100, 'Ready');
      }
    }

    return await getLocalEmbedding(text);
  } catch (error) {
    console.error('Local embedding error:', error);
    // Fall back to server
    return getServerEmbedding(text);
  }
}

// Get embedding from server
async function getServerEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${API_BASE}/embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('Failed to get embedding');
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('Server embedding API error:', error);
    return generateFallbackEmbedding(text);
  }
}

// Batch embeddings
export async function getBatchEmbeddings(
  texts: string[]
): Promise<Array<{ embedding: number[]; text: string }>> {
  const { embeddingProvider } = useSettingsStore.getState();

  if (embeddingProvider === 'local') {
    // Process locally one by one
    const results: Array<{ embedding: number[]; text: string }> = [];
    for (const text of texts) {
      const embedding = await getEmbedding(text);
      results.push({ embedding, text });
    }
    return results;
  }

  // Server batch
  try {
    const response = await fetch(`${API_BASE}/embeddings/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      throw new Error('Failed to get batch embeddings');
    }

    const data = await response.json();
    return data.embeddings;
  } catch (error) {
    console.error('Batch embedding API error:', error);
    return texts.map((text) => ({
      embedding: generateFallbackEmbedding(text),
      text,
    }));
  }
}

// Suggestions (always server-side)
export async function getSuggestions(
  focusedNode: string,
  existingNodes: Array<{ label: string }>,
  context?: string
): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focusedNode, existingNodes, context }),
    });

    if (!response.ok) {
      throw new Error('Failed to get suggestions');
    }

    const data = await response.json();
    return data.suggestions;
  } catch (error) {
    console.error('Suggestions API error:', error);
    return [];
  }
}

// Fallback embedding generator (semantic-aware mock)
function generateFallbackEmbedding(text: string): number[] {
  const t = text.toLowerCase();
  const dim = 384; // Match local model dimensions
  const embedding = new Array(dim).fill(0);

  // Seed based on text for consistency
  let seed = 0;
  for (let i = 0; i < t.length; i++) {
    seed = ((seed << 5) - seed) + t.charCodeAt(i);
    seed = seed & seed;
  }

  // Generate base random values
  for (let i = 0; i < dim; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    embedding[i] = (seed / 0x7fffffff) * 2 - 1;
  }

  // Add semantic bias
  const categories: Record<string, string[]> = {
    tech: ['code', 'programming', 'software', 'app', 'web', 'api', 'database', 'server', 'typescript', 'javascript', 'react', 'node'],
    game: ['game', 'play', 'level', 'score', 'player', 'character', 'enemy', 'boss', 'rpg', 'idle', 'clicker'],
    graphics: ['art', 'visual', 'design', 'color', 'pixel', '2d', '3d', 'animation', 'sprite', 'texture', 'shader'],
    mechanics: ['mechanic', 'system', 'feature', 'combat', 'skill', 'ability', 'upgrade', 'progression', 'achievement'],
    audio: ['sound', 'music', 'audio', 'sfx', 'soundtrack', 'voice', 'ambient'],
    resource: ['mining', 'ore', 'gold', 'wood', 'stone', 'iron', 'copper', 'resource', 'gather', 'farm', 'harvest'],
    craft: ['craft', 'build', 'create', 'recipe', 'item', 'equipment', 'weapon', 'armor', 'tool'],
    economy: ['market', 'trade', 'auction', 'buy', 'sell', 'price', 'currency', 'shop', 'store', 'economy'],
  };

  Object.entries(categories).forEach(([, keywords], catIndex) => {
    const hasKeyword = keywords.some(k => t.includes(k));
    if (hasKeyword) {
      for (let i = 0; i < 48; i++) {
        const dimIndex = (catIndex * 48 + i) % dim;
        embedding[dimIndex] += 0.5;
      }
    }
  });

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(v => v / magnitude);
}
