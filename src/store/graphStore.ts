import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
    applyNodeChanges,
    applyEdgeChanges,
    type NodeChange,
    type EdgeChange,
} from "@xyflow/react";
import type { BrainstormNode, BrainstormEdge } from "../types";
import { getLayoutedElements } from "../utils/layout";
import { findParentForNewNode } from "../utils/semantic";
import { getEmbedding } from "../utils/api";

// Topic colors for visual distinction
const TOPIC_COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ec4899", // Pink
    "#8b5cf6", // Violet
    "#06b6d4", // Cyan
    "#f97316", // Orange
    "#84cc16", // Lime
    "#e11d48", // Rose
    "#6366f1", // Indigo
];

interface HistoryState {
    nodes: BrainstormNode[];
    edges: BrainstormEdge[];
    selectedNodeId: string | null;
    colorIndex: number;
}

interface GraphStore {
    // State
    nodes: BrainstormNode[];
    edges: BrainstormEdge[];
    selectedNodeId: string | null;
    searchQuery: string;
    isCommandPaletteOpen: boolean;
    isProcessing: boolean;
    colorIndex: number;
    editingNodeId: string | null;
    inputBarFocusFn: (() => void) | null;
    fitViewFn: (() => void) | null;

    // History state
    history: HistoryState[];
    historyIndex: number;
    maxHistorySize: number;

    // Actions
    setState: (state: Partial<Omit<GraphStore, 'setState' | 'history' | 'historyIndex' | 'maxHistorySize'>>) => void;
    setNodes: (nodes: BrainstormNode[]) => void;
    setEdges: (edges: BrainstormEdge[]) => void;
    onNodesChange: (changes: NodeChange<BrainstormNode>[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    setSelectedNodeId: (id: string | null) => void;
    setSearchQuery: (query: string) => void;
    toggleCommandPalette: () => void;
    setCommandPaletteOpen: (open: boolean) => void;
    openCommandPaletteWithQuery: (query: string) => void;
    setEditingNodeId: (id: string | null) => void;
    setInputBarFocusFn: (fn: (() => void) | null) => void;
    focusInputBar: () => void;
    setFitViewFn: (fn: (() => void) | null) => void;
    centerOnRootAndFocus: () => void;

    // History actions
    saveToHistory: () => void;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;

    // Graph operations
    addNode: (text: string, parentId?: string) => Promise<void>;
    addNodeToSelected: (text: string) => Promise<void>;
    deleteNode: (nodeId: string) => void;
    updateNodeLabel: (nodeId: string, label: string) => void;
    layoutGraph: () => Promise<void>;

    // Export
    exportToJson: () => object;
    exportToMarkdown: () => string;

    // Reset
    resetGraph: () => void;

    // Project sync
    clearHistory: () => void;
    syncToProject: () => void;
}

const initialNodes: BrainstormNode[] = [
    {
        id: "root",
        type: "anchor",
        position: { x: 0, y: 0 },
        data: {
            label: "Brainstorm",
            topic: "Main",
            color: "#636ef1",
            isAnchor: true,
            createdAt: Date.now(),
        },
    },
];

const initialEdges: BrainstormEdge[] = [];

export const useGraphStore = create<GraphStore>()(
    persist(
        (set, get) => ({
            // Initial state
            nodes: initialNodes,
            edges: initialEdges,
            selectedNodeId: "root",
            searchQuery: "",
            isCommandPaletteOpen: false,
            isProcessing: false,
            colorIndex: 0,
            editingNodeId: null,
            inputBarFocusFn: null,
            fitViewFn: null,

            // History state - initialized with initial state
            history: [{
                nodes: initialNodes,
                edges: initialEdges,
                selectedNodeId: "root",
                colorIndex: 0,
            }],
            historyIndex: 0,
            maxHistorySize: 50,

            // Basic setters
            setState: (state) => set(state),
            setNodes: (nodes) => set({ nodes }),
            setEdges: (edges) => set({ edges }),

            onNodesChange: (changes) => {
                set({
                    nodes: applyNodeChanges(changes, get().nodes),
                });
            },

            onEdgesChange: (changes) => {
                set({
                    edges: applyEdgeChanges(changes, get().edges),
                });
            },

            setSelectedNodeId: (id) => set({ selectedNodeId: id }),
            setSearchQuery: (query) => set({ searchQuery: query }),
            toggleCommandPalette: () =>
                set((state) => ({
                    isCommandPaletteOpen: !state.isCommandPaletteOpen,
                })),
            setCommandPaletteOpen: (open) =>
                set({ isCommandPaletteOpen: open }),
            openCommandPaletteWithQuery: (query) =>
                set({ isCommandPaletteOpen: true, searchQuery: query }),
            setEditingNodeId: (id) => set({ editingNodeId: id }),
            setInputBarFocusFn: (fn) => set({ inputBarFocusFn: fn }),
            focusInputBar: () => {
                const { inputBarFocusFn } = get();
                if (inputBarFocusFn) {
                    inputBarFocusFn();
                }
            },
            setFitViewFn: (fn) => set({ fitViewFn: fn }),
            centerOnRootAndFocus: () => {
                const { fitViewFn, inputBarFocusFn } = get();
                if (fitViewFn) {
                    fitViewFn();
                }
                // Focus input bar after a short delay to allow camera animation
                setTimeout(() => {
                    if (inputBarFocusFn) {
                        inputBarFocusFn();
                    }
                }, 100);
            },

            // History management
            saveToHistory: () => {
                const { nodes, edges, selectedNodeId, colorIndex, history, historyIndex, maxHistorySize } = get();

                // Create new history state
                const newState: HistoryState = {
                    nodes: JSON.parse(JSON.stringify(nodes)),
                    edges: JSON.parse(JSON.stringify(edges)),
                    selectedNodeId,
                    colorIndex,
                };

                // Remove any future history if we're not at the end
                const newHistory = history.slice(0, historyIndex + 1);

                // Add new state
                newHistory.push(newState);

                // Limit history size
                let newIndex = historyIndex + 1;
                if (newHistory.length > maxHistorySize) {
                    newHistory.shift();
                    newIndex = maxHistorySize - 1;
                }

                set({
                    history: newHistory,
                    historyIndex: newIndex,
                });
            },

            undo: () => {
                const { history, historyIndex } = get();

                if (historyIndex > 0) {
                    const newIndex = historyIndex - 1;
                    const state = history[newIndex];

                    set({
                        nodes: JSON.parse(JSON.stringify(state.nodes)),
                        edges: JSON.parse(JSON.stringify(state.edges)),
                        selectedNodeId: state.selectedNodeId,
                        colorIndex: state.colorIndex,
                        historyIndex: newIndex,
                    });
                }
            },

            redo: () => {
                const { history, historyIndex } = get();

                if (historyIndex < history.length - 1) {
                    const newIndex = historyIndex + 1;
                    const state = history[newIndex];

                    set({
                        nodes: JSON.parse(JSON.stringify(state.nodes)),
                        edges: JSON.parse(JSON.stringify(state.edges)),
                        selectedNodeId: state.selectedNodeId,
                        colorIndex: state.colorIndex,
                        historyIndex: newIndex,
                    });
                }
            },

            canUndo: () => {
                const { historyIndex } = get();
                return historyIndex > 0;
            },

            canRedo: () => {
                const { history, historyIndex } = get();
                return historyIndex < history.length - 1;
            },

            // Add node with semantic clustering
            addNode: async (text: string, forceParentId?: string) => {
                const { nodes, edges, colorIndex } = get();
                set({ isProcessing: true });

                try {
                    // Get embedding for the new text
                    const embedding = await getEmbedding(text);

                    let parentNode: BrainstormNode | null = null;
                    let newNodeType: "anchor" | "satellite" = "satellite";
                    let nodeColor = "#636ef1";
                    let nodeTopic = "General";

                    if (false || forceParentId) {
                        // If parent is specified, use it directly
                        parentNode =
                            nodes.find((n) => n.id === forceParentId) || null;
                        if (parentNode) {
                            nodeColor = parentNode.data.color || nodeColor;
                            nodeTopic = parentNode.data.topic || nodeTopic;
                        }
                    } else {
                        // Semantic clustering: find best parent based on similarity
                        parentNode = findParentForNewNode(embedding, nodes, edges, 0.4);

                        if (parentNode) {
                            // Found a good match - attach as satellite
                            nodeColor = parentNode.data.color || nodeColor;
                            nodeTopic = parentNode.data.topic || nodeTopic;
                            newNodeType = "satellite";
                        } else {
                            // No good match - create new anchor (topic)
                            const newColor =
                                TOPIC_COLORS[colorIndex % TOPIC_COLORS.length];
                            nodeColor = newColor;
                            nodeTopic = text;
                            newNodeType = "anchor";
                            parentNode =
                                nodes.find((n) => n.id === "root") || null;
                            set({ colorIndex: colorIndex + 1 });
                        }
                    }

                    // Create new node
                    const newNodeId = `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    const newNode: BrainstormNode = {
                        id: newNodeId,
                        type: newNodeType,
                        position: { x: 0, y: 0 },
                        data: {
                            label: text,
                            topic: nodeTopic,
                            color: nodeColor,
                            vector: embedding,
                            parentId: parentNode?.id,
                            isAnchor: newNodeType === "anchor",
                            createdAt: Date.now(),
                        },
                    };

                    // Create edge
                    const newEdge: BrainstormEdge = {
                        id: `e-${parentNode?.id || "root"}-${newNodeId}`,
                        source: parentNode?.id || "root",
                        target: newNodeId,
                        type: "smoothstep",
                        style: {
                            stroke: nodeColor,
                            strokeWidth: newNodeType === "anchor" ? 2 : 1.5,
                            opacity: newNodeType === "anchor" ? 0.8 : 0.5,
                        },
                        animated: false,
                    };

                    const newNodes = [...nodes, newNode];
                    const newEdges = [...edges, newEdge];

                    // Apply layout
                    const layouted = await getLayoutedElements(
                        newNodes,
                        newEdges,
                    );

                    set({
                        nodes: layouted.nodes,
                        edges: layouted.edges,
                        selectedNodeId: newNodeId,
                        isProcessing: false,
                    });

                    // Save the new state to history
                    get().saveToHistory();

                    // Sync to project store
                    get().syncToProject();
                } catch (error) {
                    console.error("Error adding node:", error);
                    set({ isProcessing: false });
                }
            },

            // Add node to currently selected node
            addNodeToSelected: async (text: string) => {
                const { selectedNodeId, addNode } = get();
                await addNode(text, selectedNodeId || undefined);
            },

            // Delete node and its descendants
            deleteNode: (nodeId: string) => {
                if (nodeId === "root") return; // Can't delete root

                const { nodes, edges } = get();

                // Find all descendant node IDs
                const descendantIds = new Set<string>();
                const findDescendants = (id: string) => {
                    descendantIds.add(id);
                    edges
                        .filter((e) => e.source === id)
                        .forEach((e) => findDescendants(e.target));
                };
                findDescendants(nodeId);

                // Remove nodes and edges
                const newNodes = nodes.filter((n) => !descendantIds.has(n.id));
                const newEdges = edges.filter(
                    (e) =>
                        !descendantIds.has(e.source) &&
                        !descendantIds.has(e.target),
                );

                set({
                    nodes: newNodes,
                    edges: newEdges,
                    selectedNodeId:
                        get().selectedNodeId === nodeId
                            ? "root"
                            : get().selectedNodeId,
                });

                // Save the new state to history
                get().saveToHistory();

                // Sync to project store
                get().syncToProject();

                // Re-layout
                get().layoutGraph();
            },

            // Update node label
            updateNodeLabel: (nodeId: string, label: string) => {
                set({
                    nodes: get().nodes.map((n) =>
                        n.id === nodeId
                            ? { ...n, data: { ...n.data, label } }
                            : n,
                    ),
                    editingNodeId: null,
                });

                // Save the new state to history
                get().saveToHistory();

                // Sync to project store
                get().syncToProject();
            },

            // Re-apply layout
            layoutGraph: async () => {
                const { nodes, edges } = get();
                const layouted = await getLayoutedElements(nodes, edges);
                set({ nodes: layouted.nodes, edges: layouted.edges });
            },

            // Export to JSON
            exportToJson: () => {
                const { nodes, edges } = get();

                const childrenMap = new Map<string, string[]>();

                edges.forEach((e) => {
                    if (!childrenMap.has(e.source)) {
                        childrenMap.set(e.source, []);
                    }
                    childrenMap.get(e.source)!.push(e.target);
                });

                return {
                    nodes: nodes.map((n) => ({
                        id: n.id,
                        label: n.data.label,
                        topic: n.data.topic,
                        parentId: n.data.parentId,
                        isAnchor: n.data.isAnchor,
                        children: childrenMap.get(n.id) || [],
                    })),
                    edges: edges.map((e) => ({
                        source: e.source,
                        target: e.target,
                    })),
                    metadata: {
                        exportedAt: new Date().toISOString(),
                        nodeCount: nodes.length,
                        edgeCount: edges.length,
                    },
                };
            },

            // Export to Markdown
            exportToMarkdown: () => {
                const { nodes, edges } = get();

                const childrenMap = new Map<string, string[]>();
                edges.forEach((e) => {
                    if (!childrenMap.has(e.source)) {
                        childrenMap.set(e.source, []);
                    }
                    childrenMap.get(e.source)!.push(e.target);
                });

                const nodeMap = new Map(nodes.map((n) => [n.id, n]));
                const lines: string[] = [];

                const renderNode = (nodeId: string, depth: number) => {
                    const node = nodeMap.get(nodeId);
                    if (!node) return;

                    const indent = "  ".repeat(depth);
                    const prefix = depth === 0 ? "# " : `${indent}- `;
                    lines.push(`${prefix}${node.data.label}`);

                    const children = childrenMap.get(nodeId) || [];
                    children.forEach((childId) =>
                        renderNode(childId, depth + 1),
                    );
                };

                renderNode("root", 0);

                return lines.join("\n");
            },

            // Reset graph
            resetGraph: () => {
                set({
                    nodes: initialNodes,
                    edges: initialEdges,
                    selectedNodeId: "root",
                    colorIndex: 0,
                });
                get().saveToHistory();
                get().syncToProject();
            },

            // Clear history (used when switching projects)
            clearHistory: () => {
                const { nodes, edges, selectedNodeId, colorIndex } = get();
                set({
                    history: [{
                        nodes: JSON.parse(JSON.stringify(nodes)),
                        edges: JSON.parse(JSON.stringify(edges)),
                        selectedNodeId,
                        colorIndex,
                    }],
                    historyIndex: 0,
                });
            },

            // Sync current state to project store
            syncToProject: () => {
                const { nodes, edges, colorIndex } = get();
                // Dynamic import to avoid circular dependency
                import('./projectStore').then(({ useProjectStore }) => {
                    useProjectStore.getState().syncActiveProjectData({
                        nodes,
                        edges,
                        colorIndex,
                    });
                });
            },
        }),
        {
            name: "brainstormy-graph-temp",
            partialize: () => ({}), // Don't persist - projectStore owns the data
        },
    ),
);
