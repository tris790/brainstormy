import ELK from 'elkjs/lib/elk.bundled';
import type { BrainstormNode, BrainstormEdge } from '../types';

const elk = new ELK();

// ELK options for mind-map style layout
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '120',
  'elk.spacing.nodeNode': '50',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.edgeRouting': 'SPLINES',
  'elk.layered.mergeEdges': 'true',
};

interface LayoutResult {
  nodes: BrainstormNode[];
  edges: BrainstormEdge[];
}

export async function getLayoutedElements(
  nodes: BrainstormNode[],
  edges: BrainstormEdge[]
): Promise<LayoutResult> {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  // Estimate node dimensions based on label length
  const getNodeDimensions = (node: BrainstormNode) => {
    const label = node.data.label || '';
    const isAnchor = node.data.isAnchor;
    const baseWidth = isAnchor ? 180 : 150;
    const baseHeight = isAnchor ? 50 : 40;
    const charWidth = isAnchor ? 10 : 8;

    return {
      width: Math.max(baseWidth, Math.min(label.length * charWidth + 40, 300)),
      height: baseHeight,
    };
  };

  const graph = {
    id: 'root',
    layoutOptions: elkOptions,
    children: nodes.map((node) => {
      const { width, height } = getNodeDimensions(node);
      return {
        id: node.id,
        width,
        height,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  try {
    const layoutedGraph = await elk.layout(graph);

    const layoutedNodes = nodes.map((node) => {
      const layoutNode = layoutedGraph.children?.find((n) => n.id === node.id);

      return {
        ...node,
        position: {
          x: layoutNode?.x ?? node.position.x,
          y: layoutNode?.y ?? node.position.y,
        },
      };
    });

    return {
      nodes: layoutedNodes,
      edges,
    };
  } catch (error) {
    console.error('Layout failed:', error);
    return { nodes, edges };
  }
}

// Alternative radial layout for certain views
export function getRadialLayout(
  nodes: BrainstormNode[],
  edges: BrainstormEdge[],
  centerX: number = 0,
  centerY: number = 0
): LayoutResult {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  // Build adjacency map
  const children = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!children.has(e.source)) {
      children.set(e.source, []);
    }
    children.get(e.source)!.push(e.target);
  });

  // Find root
  const rootNode = nodes.find((n) => n.id === 'root') || nodes[0];
  const positioned = new Map<string, { x: number; y: number }>();

  // BFS to assign positions
  const positionNode = (
    nodeId: string,
    depth: number,
    angleStart: number,
    angleEnd: number
  ) => {
    const radius = depth * 200;
    const angle = (angleStart + angleEnd) / 2;

    positioned.set(nodeId, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });

    const nodeChildren = children.get(nodeId) || [];
    if (nodeChildren.length === 0) return;

    const angleStep = (angleEnd - angleStart) / nodeChildren.length;
    nodeChildren.forEach((childId, i) => {
      const childAngleStart = angleStart + i * angleStep;
      const childAngleEnd = childAngleStart + angleStep;
      positionNode(childId, depth + 1, childAngleStart, childAngleEnd);
    });
  };

  positionNode(rootNode.id, 0, 0, 2 * Math.PI);

  const layoutedNodes = nodes.map((node) => ({
    ...node,
    position: positioned.get(node.id) || node.position,
  }));

  return { nodes: layoutedNodes, edges };
}
