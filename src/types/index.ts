import type { Node, Edge } from '@xyflow/react';

export interface BrainstormNodeData extends Record<string, unknown> {
  label: string;
  topic?: string;
  color?: string;
  vector?: number[];
  parentId?: string;
  isAnchor?: boolean;
  createdAt: number;
  [key: string]: unknown;
}

export type BrainstormNode = Node<BrainstormNodeData, 'anchor' | 'satellite'>;
export type BrainstormEdge = Edge;

export interface GraphState {
  nodes: BrainstormNode[];
  edges: BrainstormEdge[];
  selectedNodeId: string | null;
  searchQuery: string;
  isCommandPaletteOpen: boolean;
}

export interface EmbeddingResponse {
  embedding: number[];
  text: string;
}

export interface ExportData {
  nodes: Array<{
    id: string;
    label: string;
    topic?: string;
    parentId?: string;
    children: string[];
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
  metadata: {
    exportedAt: string;
    nodeCount: number;
    edgeCount: number;
  };
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  modifiedAt: number;
  contentHash: string;
  data: {
    nodes: BrainstormNode[];
    edges: BrainstormEdge[];
    colorIndex: number;
  };
}

export interface ImportResult {
  success: boolean;
  isDuplicate: boolean;
  duplicateProject?: Project;
  newProjectId?: string;
  error?: string;
}
