import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize OpenAI client only if API key is present
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// In-memory cache for embeddings (in production, use Redis or similar)
const embeddingCache = new Map();

// Get embedding for text
app.post('/api/embedding', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const normalizedText = text.toLowerCase().trim();

    // Check cache first
    if (embeddingCache.has(normalizedText)) {
      return res.json({
        embedding: embeddingCache.get(normalizedText),
        text: normalizedText,
        cached: true
      });
    }

    // If no API key, use fallback mock embeddings
    if (!openai) {
      const mockEmbedding = generateMockEmbedding(normalizedText);
      embeddingCache.set(normalizedText, mockEmbedding);
      return res.json({
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

    const embedding = response.data[0].embedding;
    embeddingCache.set(normalizedText, embedding);

    res.json({ embedding, text: normalizedText });
  } catch (error) {
    console.error('Embedding error:', error);

    // Fallback to mock on error
    const mockEmbedding = generateMockEmbedding(req.body.text || '');
    res.json({
      embedding: mockEmbedding,
      text: req.body.text,
      fallback: true
    });
  }
});

// Batch embeddings endpoint
app.post('/api/embeddings/batch', async (req, res) => {
  try {
    const { texts } = req.body;

    if (!Array.isArray(texts)) {
      return res.status(400).json({ error: 'Texts array is required' });
    }

    const results = [];
    const uncachedTexts = [];
    const uncachedIndices = [];

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
          results[uncachedIndices[i]] = {
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
          embeddingCache.set(text, item.embedding);
          results[uncachedIndices[i]] = {
            embedding: item.embedding,
            text
          };
        });
      }
    }

    res.json({ embeddings: results });
  } catch (error) {
    console.error('Batch embedding error:', error);
    res.status(500).json({ error: 'Failed to generate embeddings' });
  }
});

// LLM-powered node suggestions
app.post('/api/suggest', async (req, res) => {
  try {
    const { context, focusedNode, existingNodes } = req.body;

    if (!openai) {
      // Return mock suggestions
      const mockSuggestions = generateMockSuggestions(focusedNode);
      return res.json({ suggestions: mockSuggestions });
    }

    const existingLabels = existingNodes.map(n => n.label).join(', ');

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

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content);
    const suggestions = parsed.suggestions || parsed.ideas || [];

    res.json({ suggestions: suggestions.slice(0, 3) });
  } catch (error) {
    console.error('Suggestion error:', error);
    const mockSuggestions = generateMockSuggestions(req.body.focusedNode);
    res.json({ suggestions: mockSuggestions, fallback: true });
  }
});

// Mock embedding generator (semantic-aware for common categories)
function generateMockEmbedding(text) {
  const t = text.toLowerCase();
  const dim = 256; // Smaller dimension for mock
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

  // Add semantic bias based on categories
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

  // Apply category biases
  Object.entries(categories).forEach(([category, keywords], catIndex) => {
    const hasKeyword = keywords.some(k => t.includes(k));
    if (hasKeyword) {
      // Boost specific dimensions for this category
      for (let i = 0; i < 32; i++) {
        const dimIndex = (catIndex * 32 + i) % dim;
        embedding[dimIndex] += 0.5;
      }
    }
  });

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(v => v / magnitude);
}

// Mock suggestions generator
function generateMockSuggestions(focusedNode) {
  const suggestionMap = {
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Brainstormy API server running on port ${port}`);
  console.log(`OpenAI API: ${process.env.OPENAI_API_KEY ? 'configured' : 'not configured (using mock embeddings)'}`);
});
