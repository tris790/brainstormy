import { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  Panel,
  BackgroundVariant,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../store/graphStore';
import { useProjectStore } from '../store/projectStore';
import { nodeTypes } from './nodes';
import type { BrainstormNode } from '../types';
import { KEYBINDS, matchesKeybind, isTypingInInput } from '../config/keybinds';
import KeybindHint from './KeybindHint';

export default function Graph() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setSelectedNodeId,
    selectedNodeId,
    layoutGraph,
    setFitViewFn,
  } = useGraphStore();

  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const projects = useProjectStore((state) => state.projects);
  const activeProject = activeProjectId ? projects[activeProjectId] : null;

  const { fitView, setCenter, getViewport } = useReactFlow();
  const hasPerformedInitialLayout = useRef(false);
  const previousNodeCount = useRef(nodes.length);
  const previousProjectId = useRef(activeProjectId);

  // Register fitView function with store
  useEffect(() => {
    const fitViewFunc = () => {
      fitView({ duration: 500, padding: 0.3 });
    };
    setFitViewFn(fitViewFunc);

    return () => {
      setFitViewFn(null);
    };
  }, [fitView, setFitViewFn]);

  // Reset layout flag when project changes
  useEffect(() => {
    if (previousProjectId.current !== activeProjectId) {
      hasPerformedInitialLayout.current = false;
      previousProjectId.current = activeProjectId;
    }
  }, [activeProjectId]);

  // Initial layout when project loads
  useEffect(() => {
    // Only run if we haven't performed initial layout yet AND we have more than just the default root node
    if (!hasPerformedInitialLayout.current && nodes.length > 1) {
      hasPerformedInitialLayout.current = true;
      layoutGraph().then(() => {
        setTimeout(() => fitView({ duration: 500, padding: 0.3 }), 100);
      });
    }
  }, [nodes.length, layoutGraph, fitView]);

  // Center on newly added node while keeping current zoom
  useEffect(() => {
    // Skip if we haven't performed initial layout yet or node count decreased (deletion)
    if (!hasPerformedInitialLayout.current || nodes.length <= previousNodeCount.current) {
      previousNodeCount.current = nodes.length;
      return;
    }

    // A node was added - center on the selected node (which is the new node)
    if (selectedNodeId) {
      const newNode = nodes.find(n => n.id === selectedNodeId);
      if (newNode && newNode.position) {
        const currentZoom = getViewport().zoom;
        // Center on the node with current zoom level
        // Add small offset for node dimensions (approximate center)
        setCenter(newNode.position.x + 100, newNode.position.y + 25, {
          duration: 400,
          zoom: currentZoom,
        });
      }
    }

    previousNodeCount.current = nodes.length;
  }, [nodes, selectedNodeId, getViewport, setCenter]);

  // Handle node selection
  const onNodeClick: NodeMouseHandler<Node> = useCallback(
    (_, node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo (always active, even when typing)
      if (matchesKeybind(e, KEYBINDS.UNDO)) {
        e.preventDefault();
        useGraphStore.getState().undo();
        return;
      }

      if (matchesKeybind(e, KEYBINDS.REDO)) {
        e.preventDefault();
        useGraphStore.getState().redo();
        return;
      }

      // Search nodes (Ctrl+F) - always active, even when typing
      if (matchesKeybind(e, KEYBINDS.SEARCH_NODES)) {
        e.preventDefault();
        useGraphStore.getState().openCommandPaletteWithQuery('>');
        return;
      }

      // Toggle input mode with Tab
      // If we're typing in input, let the InputBar handle it (for consistency)
      // If we're not typing, toggle mode here and prevent Tab from switching focus
      if (matchesKeybind(e, KEYBINDS.TOGGLE_MODE)) {
        if (!isTypingInInput()) {
          e.preventDefault();
          useGraphStore.getState().toggleInputBarMode();
          return;
        }
        // If typing in input, let InputBar's onKeyDown handle it
        return;
      }

      // Focus input bar with Escape
      if (matchesKeybind(e, KEYBINDS.ESCAPE)) {
        if (!isTypingInInput()) {
          e.preventDefault();
          useGraphStore.getState().focusInputBar();
          return;
        }
      }

      // Skip if typing in input
      if (isTypingInInput()) {
        return;
      }

      // Fit view
      if (matchesKeybind(e, KEYBINDS.FIT_VIEW)) {
        fitView({ duration: 800, padding: 0.2 });
      }

      // Delete selected node
      if ((matchesKeybind(e, KEYBINDS.DELETE_NODE) || e.key === 'Backspace') && selectedNodeId && selectedNodeId !== 'root') {
        useGraphStore.getState().deleteNode(selectedNodeId);
      }

      // Navigate between nodes with arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        navigateNodes(e.key);
      }

      // Edit selected node
      if (matchesKeybind(e, KEYBINDS.EDIT_NODE) && selectedNodeId) {
        e.preventDefault();
        useGraphStore.getState().setEditingNodeId(selectedNodeId);
      }
    };

    const navigateNodes = (key: string) => {
      const currentNode = nodes.find(n => n.id === selectedNodeId);
      if (!currentNode) return;

      const { x, y } = currentNode.position;

      // Find nearest node in direction
      let candidates = nodes.filter(n => n.id !== selectedNodeId);

      switch (key) {
        case 'ArrowRight':
          candidates = candidates.filter(n => n.position.x > x);
          break;
        case 'ArrowLeft':
          candidates = candidates.filter(n => n.position.x < x);
          break;
        case 'ArrowDown':
          candidates = candidates.filter(n => n.position.y > y);
          break;
        case 'ArrowUp':
          candidates = candidates.filter(n => n.position.y < y);
          break;
      }

      if (candidates.length === 0) return;

      // Sort by distance
      candidates.sort((a, b) => {
        const distA = Math.hypot(a.position.x - x, a.position.y - y);
        const distB = Math.hypot(b.position.x - x, b.position.y - y);
        return distA - distB;
      });

      const nextNode = candidates[0];
      setSelectedNodeId(nextNode.id);
      setCenter(nextNode.position.x + 100, nextNode.position.y + 25, {
        duration: 300,
        zoom: 1,
      });
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [fitView, selectedNodeId, nodes, setSelectedNodeId, setCenter]);

  // Prepare nodes with selection state
  const displayNodes = nodes.map(n => ({
    ...n,
    selected: n.id === selectedNodeId,
  }));

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.05)"
        />

        <Controls
          className="!bg-white/5 !border-white/10 !rounded-lg [&>button]:!bg-white/10 [&>button]:!border-white/10 [&>button]:!text-white/60 [&>button:hover]:!bg-white/20"
          showInteractive={false}
        />

        <MiniMap
          nodeColor={(node) => (node.data as BrainstormNode['data'])?.color || '#636ef1'}
          maskColor="rgba(0, 0, 0, 0.8)"
          className="!bg-black/50 !border-white/10 !rounded-lg"
          pannable
          zoomable
        />

        {/* Stats panel with active project indicator */}
        <Panel position="top-left" className="!m-4 !ml-16">
          <div className="space-y-2">
            {/* Active project name */}
            {activeProject && (
              <div className="flex items-center gap-2 text-sm text-white">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeProject.color }} />
                <span className="font-semibold truncate max-w-[200px]">{activeProject.name}</span>
              </div>
            )}

            {/* Stats */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 text-xs text-white/50 font-mono">
              <span className="text-white/80">{nodes.length}</span> nodes
              <span className="mx-2">·</span>
              <span className="text-white/80">{edges.length}</span> connections
            </div>
          </div>
        </Panel>

        {/* Keyboard hints */}
        <Panel position="top-right" className="!m-4">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white/40 font-mono space-y-1">
            <div><KeybindHint keybind={KEYBINDS.COMMAND_PALETTE} className="text-white/60" /> {KEYBINDS.COMMAND_PALETTE.description}</div>
            <div><KeybindHint keybind={KEYBINDS.SEARCH_NODES} className="text-white/60" /> {KEYBINDS.SEARCH_NODES.description}</div>
            <div><KeybindHint keybind={KEYBINDS.PROJECTS_SIDEBAR} className="text-white/60" /> {KEYBINDS.PROJECTS_SIDEBAR.description}</div>
            <div><KeybindHint keybind={KEYBINDS.UNDO} className="text-white/60" /> {KEYBINDS.UNDO.description}</div>
            <div><KeybindHint keybind={KEYBINDS.REDO} className="text-white/60" /> {KEYBINDS.REDO.description}</div>
            <div><KeybindHint keybind={KEYBINDS.FIT_VIEW} className="text-white/60" /> {KEYBINDS.FIT_VIEW.description}</div>
            <div><KeybindHint keybind={KEYBINDS.EDIT_NODE} className="text-white/60" /> {KEYBINDS.EDIT_NODE.description}</div>
            <div><KeybindHint keybind={KEYBINDS.NAVIGATE_UP} className="text-white/60" /> Navigate</div>
            <div><KeybindHint keybind={KEYBINDS.DELETE_NODE} className="text-white/60" /> {KEYBINDS.DELETE_NODE.description}</div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
