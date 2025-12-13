import type { BrainstormNode, BrainstormEdge } from '../types';

// Cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    console.warn('Vector dimension mismatch');
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

// Compute centroid (average) of multiple vectors
export function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dims = vectors[0].length;
  const centroid = new Array(dims).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dims; i++) {
      centroid[i] += vec[i];
    }
  }

  for (let i = 0; i < dims; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}

// Build a children map from edges
function buildChildrenMap(
  edges: BrainstormEdge[]
): Map<string, Set<string>> {
  const childrenMap = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, new Set());
    }
    childrenMap.get(edge.source)!.add(edge.target);
  }
  return childrenMap;
}

// Get all descendant vectors for a node
function getDescendantVectors(
  nodeId: string,
  nodes: BrainstormNode[],
  childrenMap: Map<string, Set<string>>
): number[][] {
  const vectors: number[][] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const collectVectors = (id: string) => {
    const node = nodeMap.get(id);
    if (node?.data.vector) {
      vectors.push(node.data.vector);
    }
    const children = childrenMap.get(id);
    if (children) {
      for (const childId of children) {
        collectVectors(childId);
      }
    }
  };

  collectVectors(nodeId);
  return vectors;
}

// Find the best parent node for a new node based on semantic similarity
export function findBestParent(
  newVector: number[],
  nodes: BrainstormNode[],
  edges: BrainstormEdge[] = []
): { node: BrainstormNode | null; similarity: number } {
  // Skip root in similarity checks
  const candidates = nodes.filter((n) => n.id !== 'root' && n.data.vector);

  if (candidates.length === 0) {
    return { node: null, similarity: 0 };
  }

  // Simple case: less than 3 nodes, just use direct similarity
  if (candidates.length < 3 || edges.length === 0) {
    let bestNode: BrainstormNode | null = null;
    let maxSimilarity = -1;

    for (const node of candidates) {
      if (!node.data.vector) continue;

      const similarity = cosineSimilarity(newVector, node.data.vector);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestNode = node;
      }
    }

    return { node: bestNode, similarity: maxSimilarity };
  }

  // Build hierarchy information
  const childrenMap = buildChildrenMap(edges);

  // Two-pass approach:
  // 1. First, find the best cluster head (node with children) based on cluster centroid similarity
  // 2. Then, find the best leaf node for direct attachment
  // Prefer cluster heads when the new node fits a cluster well

  let bestClusterHead: BrainstormNode | null = null;
  let bestClusterScore = -Infinity;
  let bestClusterSimilarity = 0;
  let bestClusterDirectSim = 0; // Track direct similarity to cluster head

  let bestLeaf: BrainstormNode | null = null;
  let bestLeafScore = -Infinity;
  let bestLeafSimilarity = 0;

  for (const node of candidates) {
    if (!node.data.vector) continue;

    const directSim = cosineSimilarity(newVector, node.data.vector);
    const children = childrenMap.get(node.id);
    const hasChildren = children && children.size > 0;

    if (hasChildren) {
      // For cluster heads, score based on how well new node fits the cluster
      const descendantVectors = getDescendantVectors(node.id, nodes, childrenMap);
      const centroid = computeCentroid(descendantVectors);
      const clusterSim = cosineSimilarity(newVector, centroid);

      // Score cluster heads primarily by cluster fit
      const score = clusterSim * 0.7 + directSim * 0.3;

      if (score > bestClusterScore) {
        bestClusterScore = score;
        bestClusterHead = node;
        bestClusterSimilarity = clusterSim;
        bestClusterDirectSim = directSim;
      }
    } else {
      // For leaf nodes, score by direct similarity
      if (directSim > bestLeafScore) {
        bestLeafScore = directSim;
        bestLeaf = node;
        bestLeafSimilarity = directSim;
      }
    }
  }

  // Decision: prefer leaf if it has higher direct similarity than cluster head
  // This fixes the "shoes -> plant" bug where the cluster centroid was artificially
  // boosting plant's score even though walking had higher direct similarity
  // Compare direct similarities (apples to apples) instead of weighted cluster score
  if (bestLeaf && bestClusterHead) {
    // If leaf has higher direct similarity, prefer the leaf
    if (bestLeafScore > bestClusterDirectSim) {
      return { node: bestLeaf, similarity: bestLeafSimilarity };
    }
    // Otherwise use cluster head
    return { node: bestClusterHead, similarity: bestClusterSimilarity };
  }

  // Only cluster head available
  if (bestClusterHead) {
    return { node: bestClusterHead, similarity: bestClusterSimilarity };
  }

  // Fall back to leaf node if no good cluster fit
  if (bestLeaf) {
    return { node: bestLeaf, similarity: bestLeafSimilarity };
  }

  // If no leaf, use cluster head anyway
  return {
    node: bestClusterHead,
    similarity: bestClusterSimilarity,
  };
}

/**
 * Find parent for a new node using production logic.
 * This includes the similarity threshold and anchor redirection logic from graphStore.
 *
 * @param newVector - Embedding vector for the new node
 * @param nodes - All existing nodes in the graph
 * @param edges - All edges in the graph
 * @param similarityThreshold - Minimum similarity to consider a match (default: 0.4)
 * @returns The parent node to attach to, or null if should attach to root
 */
export function findParentForNewNode(
  newVector: number[],
  nodes: BrainstormNode[],
  edges: BrainstormEdge[],
  similarityThreshold: number = 0.4
): BrainstormNode | null {
  const result = findBestParent(newVector, nodes, edges);

  if (result.node && result.similarity > similarityThreshold) {
    // Return the best matching node directly
    // Previously this redirected satellites to their anchors, but that caused
    // "plant" to attach to "mining" instead of "farming" (its true best match)
    return result.node;
  }

  // No good match - return null to indicate should attach to root
  return null;
}

// Find all nodes similar to a query
export function findSimilarNodes(
  queryVector: number[],
  nodes: BrainstormNode[],
  threshold: number = 0.5
): Array<{ node: BrainstormNode; similarity: number }> {
  const results: Array<{ node: BrainstormNode; similarity: number }> = [];

  for (const node of nodes) {
    if (!node.data.vector) continue;

    const similarity = cosineSimilarity(queryVector, node.data.vector);

    if (similarity >= threshold) {
      results.push({ node, similarity });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

// Simple text-based similarity for search (when no vector)
export function textSimilarity(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase().trim();

  if (t.includes(q)) return 1;
  if (q.includes(t)) return 0.8;

  // Word overlap
  const qWords = new Set(q.split(/\s+/));
  const tWords = new Set(t.split(/\s+/));

  let overlap = 0;
  qWords.forEach((word) => {
    if (tWords.has(word)) overlap++;
  });

  if (qWords.size === 0) return 0;
  return overlap / qWords.size;
}
