import { describe, it, expect, beforeAll } from 'vitest';
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import type { BrainstormNode, BrainstormEdge } from '../types';
import { findParentForNewNode, cosineSimilarity } from './semantic';

// Real embedding model for accurate semantic tests
let extractor: FeatureExtractionPipeline;

async function getEmbedding(text: string): Promise<number[]> {
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

// Helper to create a node with embedding
async function createNode(
  id: string,
  label: string,
  parentId?: string
): Promise<BrainstormNode> {
  const vector = await getEmbedding(label);
  return {
    id,
    type: 'satellite',
    position: { x: 0, y: 0 },
    data: {
      label,
      topic: label,
      color: '#000',
      vector,
      parentId,
      isAnchor: !parentId,
      createdAt: Date.now(),
    },
  };
}

// Helper to create edge
function createEdge(source: string, target: string): BrainstormEdge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
  };
}

describe('Shoes Placement Bug Investigation', () => {
  beforeAll(async () => {
    // Load real embedding model
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }, 60000); // 60 second timeout for model loading

  describe('User-reported brainstorm session', () => {
    /**
     * Simulates the exact session where "shoes" was attached to "plant" instead of "walking"
     *
     * Data structure from user:
     * # Brainstorm
     *   - plant
     *     - tree
     *     - fruit
     *     - leaf
     *     - sun
     *     - shoes  ← BUG: Should be under "walking" instead
     *   - mining
     *     - ore
     *     - farming
     *     - diamond
     *     - iron
     *     - gold
     *     - copper
     *   - pickaxe
     *   - security
     *     - defence
     *   - windows defender
     *     - windows
     *     - bill gates
     *     - microsoft
     *   - walking
     */
    it('should reveal why shoes attached to plant', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      // Step 1: Build the graph up to the point before adding "shoes"
      const root = await createNode('root', 'Brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Plant cluster
      const plant = await createNode('plant', 'plant', 'root');
      plant.data.isAnchor = true;
      nodes.push(plant);
      edges.push(createEdge('root', 'plant'));

      const tree = await createNode('tree', 'tree', 'plant');
      nodes.push(tree);
      edges.push(createEdge('plant', 'tree'));

      const fruit = await createNode('fruit', 'fruit', 'plant');
      nodes.push(fruit);
      edges.push(createEdge('plant', 'fruit'));

      const leaf = await createNode('leaf', 'leaf', 'plant');
      nodes.push(leaf);
      edges.push(createEdge('plant', 'leaf'));

      const sun = await createNode('sun', 'sun', 'plant');
      nodes.push(sun);
      edges.push(createEdge('plant', 'sun'));

      // Mining cluster
      const mining = await createNode('mining', 'mining', 'root');
      mining.data.isAnchor = true;
      nodes.push(mining);
      edges.push(createEdge('root', 'mining'));

      const ore = await createNode('ore', 'ore', 'mining');
      nodes.push(ore);
      edges.push(createEdge('mining', 'ore'));

      const farming = await createNode('farming', 'farming', 'mining');
      nodes.push(farming);
      edges.push(createEdge('mining', 'farming'));

      const diamond = await createNode('diamond', 'diamond', 'mining');
      nodes.push(diamond);
      edges.push(createEdge('mining', 'diamond'));

      const iron = await createNode('iron', 'iron', 'mining');
      nodes.push(iron);
      edges.push(createEdge('mining', 'iron'));

      const gold = await createNode('gold', 'gold', 'mining');
      nodes.push(gold);
      edges.push(createEdge('mining', 'gold'));

      const copper = await createNode('copper', 'copper', 'mining');
      nodes.push(copper);
      edges.push(createEdge('mining', 'copper'));

      // Other nodes
      const pickaxe = await createNode('pickaxe', 'pickaxe', 'root');
      pickaxe.data.isAnchor = true;
      nodes.push(pickaxe);
      edges.push(createEdge('root', 'pickaxe'));

      const security = await createNode('security', 'security', 'root');
      security.data.isAnchor = true;
      nodes.push(security);
      edges.push(createEdge('root', 'security'));

      const defence = await createNode('defence', 'defence', 'security');
      nodes.push(defence);
      edges.push(createEdge('security', 'defence'));

      const windowsDefender = await createNode('windows-defender', 'windows defender', 'root');
      windowsDefender.data.isAnchor = true;
      nodes.push(windowsDefender);
      edges.push(createEdge('root', 'windows-defender'));

      const windows = await createNode('windows', 'windows', 'windows-defender');
      nodes.push(windows);
      edges.push(createEdge('windows-defender', 'windows'));

      const billGates = await createNode('bill-gates', 'bill gates', 'windows-defender');
      nodes.push(billGates);
      edges.push(createEdge('windows-defender', 'bill-gates'));

      const microsoft = await createNode('microsoft', 'microsoft', 'windows-defender');
      nodes.push(microsoft);
      edges.push(createEdge('windows-defender', 'microsoft'));

      const walking = await createNode('walking', 'walking', 'root');
      walking.data.isAnchor = true;
      nodes.push(walking);
      edges.push(createEdge('root', 'walking'));

      // Step 2: Test where "shoes" should go
      const shoesVector = await getEmbedding('shoes');

      // Calculate similarities to all potential parents
      console.log('\n=== SIMILARITY ANALYSIS FOR "shoes" ===');

      const shoesToWalking = cosineSimilarity(shoesVector, walking.data.vector!);
      console.log('shoes <-> walking:', shoesToWalking);

      const shoesToPlant = cosineSimilarity(shoesVector, plant.data.vector!);
      console.log('shoes <-> plant:', shoesToPlant);

      const shoesToTree = cosineSimilarity(shoesVector, tree.data.vector!);
      console.log('shoes <-> tree:', shoesToTree);

      const shoesToSun = cosineSimilarity(shoesVector, sun.data.vector!);
      console.log('shoes <-> sun:', shoesToSun);

      const shoesToMining = cosineSimilarity(shoesVector, mining.data.vector!);
      console.log('shoes <-> mining:', shoesToMining);

      const shoesToPickaxe = cosineSimilarity(shoesVector, pickaxe.data.vector!);
      console.log('shoes <-> pickaxe:', shoesToPickaxe);

      // Step 3: Find the parent using the production algorithm
      const parentNode = findParentForNewNode(shoesVector, nodes, edges);

      console.log('\n=== ALGORITHM RESULT ===');
      console.log('Production parent for shoes:', parentNode?.data.label);
      console.log('Expected: walking');
      console.log('Bug reproduced:', parentNode?.data.label === 'plant');

      // Step 4: Analyze the plant cluster centroid
      const plantClusterVectors = [
        plant.data.vector!,
        tree.data.vector!,
        fruit.data.vector!,
        leaf.data.vector!,
        sun.data.vector!,
      ];

      // Compute centroid
      const dims = plantClusterVectors[0].length;
      const centroid = new Array(dims).fill(0);
      for (const vec of plantClusterVectors) {
        for (let i = 0; i < dims; i++) {
          centroid[i] += vec[i];
        }
      }
      for (let i = 0; i < dims; i++) {
        centroid[i] /= plantClusterVectors.length;
      }

      const shoesToPlantCentroid = cosineSimilarity(shoesVector, centroid);
      console.log('\n=== CLUSTER ANALYSIS ===');
      console.log('shoes <-> plant cluster centroid:', shoesToPlantCentroid);

      // The test documents the bug
      console.log('\n=== ROOT CAUSE ===');
      console.log('If shoes was attached to plant, it means:');
      console.log('1. Direct similarity to plant OR its centroid was high enough');
      console.log('2. The similarity to walking was below threshold OR');
      console.log('3. The cluster scoring favored plant over walking');

      // Expectation: shoes should prefer walking
      expect(shoesToWalking).toBeGreaterThan(shoesToPlant);
    });

    it('should test semantic similarities between shoes and related concepts', async () => {
      // Test core concept similarities
      const shoesVec = await getEmbedding('shoes');
      const walkingVec = await getEmbedding('walking');
      const plantVec = await getEmbedding('plant');
      const clothingVec = await getEmbedding('clothing');
      const footwearVec = await getEmbedding('footwear');
      const treeVec = await getEmbedding('tree');
      const hikingVec = await getEmbedding('hiking');

      console.log('\n=== SEMANTIC SIMILARITY ANALYSIS ===');
      console.log('shoes <-> walking:', cosineSimilarity(shoesVec, walkingVec));
      console.log('shoes <-> plant:', cosineSimilarity(shoesVec, plantVec));
      console.log('shoes <-> clothing:', cosineSimilarity(shoesVec, clothingVec));
      console.log('shoes <-> footwear:', cosineSimilarity(shoesVec, footwearVec));
      console.log('shoes <-> tree:', cosineSimilarity(shoesVec, treeVec));
      console.log('shoes <-> hiking:', cosineSimilarity(shoesVec, hikingVec));

      // Shoes should be more related to walking/footwear than plants
      const shoesToWalking = cosineSimilarity(shoesVec, walkingVec);
      const shoesToPlant = cosineSimilarity(shoesVec, plantVec);

      expect(shoesToWalking).toBeGreaterThan(shoesToPlant);
    });

    it('should identify if the bug is due to timing or cluster scoring', async () => {
      /**
       * Test two scenarios:
       * 1. If "walking" was added BEFORE "shoes" - shoes should prefer walking
       * 2. If "walking" was added AFTER "shoes" - that explains the bug
       */
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'Brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      const plant = await createNode('plant', 'plant', 'root');
      plant.data.isAnchor = true;
      nodes.push(plant);
      edges.push(createEdge('root', 'plant'));

      const tree = await createNode('tree', 'tree', 'plant');
      nodes.push(tree);
      edges.push(createEdge('plant', 'tree'));

      const walking = await createNode('walking', 'walking', 'root');
      walking.data.isAnchor = true;
      nodes.push(walking);
      edges.push(createEdge('root', 'walking'));

      // Now add shoes - should go to walking
      const shoesVector = await getEmbedding('shoes');
      const parentNode = findParentForNewNode(shoesVector, nodes, edges);

      console.log('\n=== TIMING TEST ===');
      console.log('With walking already in graph:');
      console.log('shoes parent:', parentNode?.data.label);

      // With walking present, shoes should prefer it
      expect(
        parentNode?.data.label === 'walking' ||
        parentNode?.data.label === 'Brainstorm'
      ).toBe(true);
    });

    it('should test the exact order of node addition from the bug report', async () => {
      /**
       * Key question: When was "shoes" added relative to "walking"?
       *
       * Looking at the data structure:
       * - plant (with children: tree, fruit, leaf, sun, shoes)
       * - walking (no children)
       *
       * This suggests shoes was added BEFORE walking was added to the graph.
       */
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'Brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Scenario: Plant cluster exists, but "walking" hasn't been added yet
      const plant = await createNode('plant', 'plant', 'root');
      plant.data.isAnchor = true;
      nodes.push(plant);
      edges.push(createEdge('root', 'plant'));

      const tree = await createNode('tree', 'tree', 'plant');
      nodes.push(tree);
      edges.push(createEdge('plant', 'tree'));

      const fruit = await createNode('fruit', 'fruit', 'plant');
      nodes.push(fruit);
      edges.push(createEdge('plant', 'fruit'));

      // Add shoes BEFORE walking exists
      const shoesVector = await getEmbedding('shoes');
      const parentBeforeWalking = findParentForNewNode(shoesVector, nodes, edges);

      console.log('\n=== ORDER OF ADDITION TEST ===');
      console.log('shoes parent (without walking in graph):', parentBeforeWalking?.data.label);

      // Add shoes to graph
      const shoes = await createNode('shoes', 'shoes', parentBeforeWalking?.id);
      nodes.push(shoes);
      edges.push(createEdge(parentBeforeWalking?.id || 'root', 'shoes'));

      // NOW add walking
      const walking = await createNode('walking', 'walking', 'root');
      walking.data.isAnchor = true;
      nodes.push(walking);
      edges.push(createEdge('root', 'walking'));

      console.log('walking added AFTER shoes');
      console.log('\n=== ROOT CAUSE IDENTIFIED ===');
      console.log('If shoes was added before walking existed in the graph,');
      console.log('the algorithm would have chosen the best available parent at that time.');
      console.log('This would explain why shoes ended up under plant.');

      // Test: what if we had added walking first?
      const nodes2: BrainstormNode[] = [];
      const edges2: BrainstormEdge[] = [];

      const root2 = await createNode('root2', 'Brainstorm');
      root2.data.isAnchor = true;
      nodes2.push(root2);

      const walking2 = await createNode('walking2', 'walking', 'root2');
      walking2.data.isAnchor = true;
      nodes2.push(walking2);
      edges2.push(createEdge('root2', 'walking2'));

      const plant2 = await createNode('plant2', 'plant', 'root2');
      plant2.data.isAnchor = true;
      nodes2.push(plant2);
      edges2.push(createEdge('root2', 'plant2'));

      const shoesVector2 = await getEmbedding('shoes');
      const parentWithWalking = findParentForNewNode(shoesVector2, nodes2, edges2);

      console.log('\nComparison: shoes parent (WITH walking first):', parentWithWalking?.data.label);

      // When walking is present, shoes should prefer it
      expect(
        parentWithWalking?.data.label === 'walking' ||
        parentWithWalking?.data.label === 'Brainstorm'
      ).toBe(true);
    });
  });
});
