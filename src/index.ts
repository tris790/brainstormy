import { serve } from "bun";
import index from "./index.html";
import OpenAI from "openai";

// Initialize OpenAI client only if API key is present
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// In-memory cache for embeddings
const embeddingCache = new Map<string, number[]>();

// Mock embedding generator (semantic-aware for common categories)
function generateMockEmbedding(text: string): number[] {
  const t = text.toLowerCase();
  const dim = 256;
  const embedding = new Array(dim).fill(0);

  let seed = 0;
  for (let i = 0; i < t.length; i++) {
    seed = ((seed << 5) - seed) + t.charCodeAt(i);
    seed = seed & seed;
  }

  for (let i = 0; i < dim; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    embedding[i] = (seed / 0x7fffffff) * 2 - 1;
  }

  const categories = {
    tech: ['code', 'programming', 'software', 'app', 'web', 'api', 'database', 'server', 'typescript', 'javascript', 'react', 'node'],
    game: ['game', 'play', 'level', 'score', 'player', 'character', 'enemy', 'boss', 'rpg', 'idle', 'clicker'],
    graphics: ['art', 'visual', 'design', 'color', 'pixel', '2d', '3d', 'animation', 'sprite', 'texture', 'shader'],
    mechanics: ['mechanic', 'system', 'feature', 'combat', 'skill', 'ability', 'upgrade', 'progression', 'achievement'],
    audio: ['sound', 'music', 'audio', 'sfx', 'soundtrack', 'voice', 'ambient'],
    resource: ['mining', 'ore', 'gold', 'wood', 'stone', 'iron', 'copper', 'resource', 'gather', 'farm', 'harvest'],
    craft: ['craft', 'build', 'create', 'recipe', 'item', 'equipment', 'weapon', 'armor', 'tool'],
    economy: ['market', 'trade', 'auction', 'buy', 'sell', 'price', 'currency', 'shop', 'store', 'economy'],
  };

  Object.entries(categories).forEach(([_, keywords], catIndex) => {
    const hasKeyword = keywords.some(k => t.includes(k));
    if (hasKeyword) {
      for (let i = 0; i < 32; i++) {
        const dimIndex = (catIndex * 32 + i) % dim;
        embedding[dimIndex] += 0.5;
      }
    }
  });

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(v => v / magnitude);
}

// Mock suggestions generator
function generateMockSuggestions(focusedNode: string): string[] {
  const suggestionMap: Record<string, string[]> = {
    'game': ['Multiplayer', 'Story Mode', 'Achievements'],
    'graphics': ['Pixel Art', 'Low Poly', 'Shaders'],
    'mechanics': ['Combat System', 'Skill Tree', 'Inventory'],
    'audio': ['Background Music', 'Sound Effects', 'Voice Acting'],
    'mining': ['Ore Types', 'Mining Tools', 'Gem Deposits'],
    'crafting': ['Recipe System', 'Material Tiers', 'Workbenches'],
    'market': ['Trading Post', 'Auction House', 'Price History'],
  };

  const lowerNode = (focusedNode || '').toLowerCase();

  for (const [key, suggestions] of Object.entries(suggestionMap)) {
    if (lowerNode.includes(key)) {
      return suggestions;
    }
  }

  return ['Sub-topic 1', 'Related Idea', 'Expansion'];
}

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes
    "/*": index,

    // Health check
    "/api/health": {
      async GET() {
        return Response.json({
          status: 'ok',
          hasOpenAI: !!process.env.OPENAI_API_KEY,
          timestamp: new Date().toISOString()
        });
      }
    },

    // Get embedding for text
    "/api/embedding": {
      async POST(req) {
        try {
          const body = await req.json();
          const { text } = body;

          if (!text || typeof text !== 'string') {
            return Response.json({ error: 'Text is required' }, { status: 400 });
          }

          const normalizedText = text.toLowerCase().trim();

          // Check cache first
          if (embeddingCache.has(normalizedText)) {
            return Response.json({
              embedding: embeddingCache.get(normalizedText),
              text: normalizedText,
              cached: true
            });
          }

          // If no API key, use fallback mock embeddings
          if (!openai) {
            const mockEmbedding = generateMockEmbedding(normalizedText);
            embeddingCache.set(normalizedText, mockEmbedding);
            return Response.json({
              embedding: mockEmbedding,
              text: normalizedText,
              mock: true
            });
          }

          // Get embedding from OpenAI
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: normalizedText,
          });

          const embedding = response.data[0]?.embedding;
          if (embedding) {
            embeddingCache.set(normalizedText, embedding);
          }

          return Response.json({ embedding, text: normalizedText });
        } catch (error) {
          console.error('Embedding error:', error);

          // Fallback to mock on error
          const body = await req.json();
          const mockEmbedding = generateMockEmbedding(body.text || '');
          return Response.json({
            embedding: mockEmbedding,
            text: body.text,
            fallback: true
          });
        }
      }
    },

    // Batch embeddings endpoint
    "/api/embeddings/batch": {
      async POST(req) {
        try {
          const body = await req.json();
          const { texts } = body;

          if (!Array.isArray(texts)) {
            return Response.json({ error: 'Texts array is required' }, { status: 400 });
          }

          const results: any[] = [];
          const uncachedTexts: string[] = [];
          const uncachedIndices: number[] = [];

          // Check cache for each text
          texts.forEach((text, index) => {
            const normalized = text.toLowerCase().trim();
            if (embeddingCache.has(normalized)) {
              results[index] = {
                embedding: embeddingCache.get(normalized),
                text: normalized,
                cached: true
              };
            } else {
              uncachedTexts.push(normalized);
              uncachedIndices.push(index);
            }
          });

          // Get uncached embeddings
          if (uncachedTexts.length > 0) {
            if (!openai) {
              // Mock embeddings
              uncachedTexts.forEach((text, i) => {
                const mockEmbedding = generateMockEmbedding(text);
                embeddingCache.set(text, mockEmbedding);
                results[uncachedIndices[i]!] = {
                  embedding: mockEmbedding,
                  text,
                  mock: true
                };
              });
            } else {
              const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: uncachedTexts,
              });

              response.data.forEach((item, i) => {
                const text = uncachedTexts[i];
                if (text && item.embedding) {
                  embeddingCache.set(text, item.embedding);
                  results[uncachedIndices[i]!] = {
                    embedding: item.embedding,
                    text
                  };
                }
              });
            }
          }

          return Response.json({ embeddings: results });
        } catch (error) {
          console.error('Batch embedding error:', error);
          return Response.json({ error: 'Failed to generate embeddings' }, { status: 500 });
        }
      }
    },

    // LLM-powered node suggestions
    "/api/suggest": {
      async POST(req) {
        try {
          const body = await req.json();
          const { context, focusedNode, existingNodes } = body;

          if (!openai) {
            // Return mock suggestions
            const mockSuggestions = generateMockSuggestions(focusedNode);
            return Response.json({ suggestions: mockSuggestions });
          }

          const existingLabels = existingNodes.map((n: any) => n.label).join(', ');

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a brainstorming assistant. Given a context and a focused topic, suggest 3 short, distinct sub-topics or related ideas. Each suggestion should be 1-4 words. Return only a JSON array of strings.`
              },
              {
                role: 'user',
                content: `Context: ${context || 'General brainstorming'}
Focused on: "${focusedNode}"
Existing ideas: ${existingLabels}

Suggest 3 new related ideas that aren't already listed.`
              }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 150,
          });

          const content = completion.choices[0]?.message.content;
          const parsed = content ? JSON.parse(content) : {};
          const suggestions = parsed.suggestions || parsed.ideas || [];

          return Response.json({ suggestions: suggestions.slice(0, 3) });
        } catch (error) {
          console.error('Suggestion error:', error);
          const body = await req.json();
          const mockSuggestions = generateMockSuggestions(body.focusedNode);
          return Response.json({ suggestions: mockSuggestions, fallback: true });
        }
      }
    }
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Brainstormy server running at ${server.url}`);
console.log(`OpenAI API: ${process.env.OPENAI_API_KEY ? 'configured' : 'not configured (using mock embeddings)'}`);
