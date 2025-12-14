import { useEffect, useState, useMemo, useRef } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileJson,
  FileText,
  Trash2,
  RefreshCw,
  Lightbulb,
  Keyboard,
  ZoomIn,
  ZoomOut,
  Maximize,
  X,
  Copy,
  Download,
  Folder,
  Plus,
  Upload
} from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { useProjectStore } from '../store/projectStore';
import { useReactFlow } from '@xyflow/react';
import { getSuggestions } from '../utils/api';
import { formatRelativeTime } from '../utils/projectUtils';
import { KEYBINDS, matchesKeybind, isTypingInInput } from '../config/keybinds';
import KeybindHint from './KeybindHint';

export default function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    searchQuery,
    setSearchQuery,
    exportToJson,
    exportToMarkdown,
    resetGraph,
    addNode,
    layoutGraph,
    focusInputBar,
    setState: setGraphState,
    clearHistory,
  } = useGraphStore();

  const { fitView, zoomIn, zoomOut, setCenter } = useReactFlow();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show notification with auto-dismiss
  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Auto-focus input when palette opens, refocus InputBar when palette closes
  useEffect(() => {
    if (isCommandPaletteOpen) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      // Refocus the main input bar when command palette closes
      // Delay to allow exit animation to complete
      setTimeout(() => {
        focusInputBar();
      }, 100);
    }
  }, [isCommandPaletteOpen, focusInputBar]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesKeybind(e, KEYBINDS.COMMAND_PALETTE)) {
        e.preventDefault();
        e.stopPropagation();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (matchesKeybind(e, KEYBINDS.ESCAPE) && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
      // Focus search with /
      if (matchesKeybind(e, KEYBINDS.QUICK_COMMAND) && !isCommandPaletteOpen && !isTypingInInput()) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  // Check if in nodes-only mode (starts with '>')
  const isNodesOnlyMode = searchQuery.startsWith('>');
  const actualQuery = isNodesOnlyMode ? searchQuery.slice(1).trim() : searchQuery;

  // Filter nodes for search
  const filteredNodes = useMemo(() => {
    if (!actualQuery && !isNodesOnlyMode) return [];
    const query = actualQuery.toLowerCase();

    // If in nodes-only mode with no query, show all nodes (except root)
    if (isNodesOnlyMode && !query) {
      return nodes.filter(n => n.id !== 'root');
    }

    return nodes.filter(n =>
      n.id !== 'root' && (
        n.data.label.toLowerCase().includes(query) ||
        n.data.topic?.toLowerCase().includes(query)
      )
    );
  }, [nodes, actualQuery, isNodesOnlyMode]);

  // Load AI suggestions
  const loadSuggestions = async () => {
    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    if (!selectedNode) return;

    setIsLoadingSuggestions(true);
    try {
      const results = await getSuggestions(
        selectedNode.data.label,
        nodes.map(n => ({ label: n.data.label }))
      );
      setSuggestions(results);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
    setIsLoadingSuggestions(false);
  };

  // Jump to node
  const jumpToNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNodeId(nodeId);
      setCenter(node.position.x + 100, node.position.y + 25, {
        duration: 800,
        zoom: 1.2
      });
    }
    setCommandPaletteOpen(false);
    setSearchQuery('');
  };

  // Clipboard utilities
  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification(`${format} copied to clipboard!`);
      setCommandPaletteOpen(false);
    } catch (error) {
      console.error('Failed to copy:', error);
      showNotification(`Failed to copy ${format}`);
    }
  };

  // Download utilities
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      showNotification(`Downloaded ${filename}`);
      setCommandPaletteOpen(false);
    } catch (error) {
      console.error('Failed to download:', error);
      showNotification(`Failed to download file`);
    }
  };

  // Project store
  const {
    toggleSidebar,
    setModalState,
    exportProject,
    exportAllProjects,
    importProject,
    getActiveProject,
    getAllProjects,
    switchProject: switchToProject,
  } = useProjectStore();

  const activeProject = getActiveProject();
  const allProjects = getAllProjects();

  // Filter projects for search/switching (hide in nodes-only mode)
  const filteredProjects = useMemo(() => {
    if (!actualQuery || isNodesOnlyMode) return [];
    const query = actualQuery.toLowerCase();
    return allProjects.filter(p =>
      p.name.toLowerCase().includes(query)
    );
  }, [allProjects, actualQuery, isNodesOnlyMode]);

  // Export handlers
  const handleCopyJson = () => {
    const data = exportToJson();
    copyToClipboard(JSON.stringify(data, null, 2), 'JSON');
  };

  const handleCopyMarkdown = () => {
    const md = exportToMarkdown();
    copyToClipboard(md, 'Markdown');
  };

  const handleDownloadJson = () => {
    if (!activeProject) return;
    const data = exportProject(activeProject.id);
    if (!data) return;

    const safeName = activeProject.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);
    const filename = `${safeName}-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
  };

  const handleDownloadMarkdown = () => {
    if (!activeProject) return;
    const md = exportToMarkdown();
    const safeName = activeProject.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);
    const filename = `${safeName}-${new Date().toISOString().split('T')[0]}.md`;
    downloadFile(md, filename, 'text/markdown');
  };

  const handleDownloadAllProjects = () => {
    const data = exportAllProjects();
    const filename = `brainstormy-all-projects-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const result = await importProject(text);

      if (result.success && result.newProjectId) {
        showNotification('Project imported successfully!');
        handleProjectSwitch(result.newProjectId);
        setCommandPaletteOpen(false);
      } else if (result.isDuplicate && result.duplicateProject) {
        setModalState({
          type: 'duplicate',
          duplicateProject: result.duplicateProject,
        });
        setCommandPaletteOpen(false);
      } else {
        showNotification(`Import failed: ${result.error || 'Unknown error'}`);
      }
    };
    input.click();
  };

  const handleProjectSwitch = (projectId: string) => {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;

    switchToProject(projectId);
    setGraphState({
      nodes: JSON.parse(JSON.stringify(project.data.nodes)),
      edges: JSON.parse(JSON.stringify(project.data.edges)),
      colorIndex: project.data.colorIndex,
      selectedNodeId: 'root',
    });
    clearHistory();
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the graph? This cannot be undone.')) {
      resetGraph();
      setCommandPaletteOpen(false);
    }
  };

  const handleAddSuggestion = async (suggestion: string) => {
    await addNode(suggestion, selectedNodeId || undefined);
    setSuggestions(prev => prev.filter(s => s !== suggestion));
  };

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setCommandPaletteOpen(false)}
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed w-full max-w-xl z-50"
            style={{
              top: '50%',
              left: '50%'
            }}
          >
            <Command
              className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
              shouldFilter={false}
            >
              <div className="flex items-center px-4 border-b border-white/10">
                <Search className="w-4 h-4 text-white/40" />
                <Command.Input
                  ref={inputRef}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  placeholder={isNodesOnlyMode ? "Search nodes... (remove '>' to see commands)" : "Search nodes or type a command... (use '>' for nodes only)"}
                  className="flex-1 bg-transparent px-3 py-4 text-white placeholder-white/40 outline-none"
                />
                <button
                  onClick={() => setCommandPaletteOpen(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>

              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-white/40 text-sm">
                  No results found.
                </Command.Empty>

                {/* Search Results */}
                {filteredNodes.length > 0 && (
                  <Command.Group heading="Nodes" className="text-xs text-white/40 px-2 py-1 uppercase tracking-wider">
                    {filteredNodes.map(node => (
                      <Command.Item
                        key={node.id}
                        value={node.data.label}
                        onSelect={() => jumpToNode(node.id)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: node.data.color }}
                        />
                        <span>{node.data.label}</span>
                        <span className="ml-auto text-xs text-white/30">{node.data.topic}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* AI Suggestions - hide in nodes-only mode */}
                {!isNodesOnlyMode && (
                <Command.Group heading="AI Suggestions" className="text-xs text-white/40 px-2 py-1 uppercase tracking-wider">
                  <Command.Item
                    onSelect={loadSuggestions}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>{isLoadingSuggestions ? 'Loading...' : 'Generate suggestions'}</span>
                  </Command.Item>
                  {suggestions.map((suggestion, i) => (
                    <Command.Item
                      key={i}
                      onSelect={() => handleAddSuggestion(suggestion)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10 ml-4"
                    >
                      <span className="text-storm-400">+</span>
                      <span>{suggestion}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
                )}

                {/* View Commands - hide in nodes-only mode */}
                {!isNodesOnlyMode && (
                <Command.Group heading="View" className="text-xs text-white/40 px-2 py-1 uppercase tracking-wider">
                  <Command.Item
                    onSelect={() => { fitView({ duration: 800, padding: 0.2 }); setCommandPaletteOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Maximize className="w-4 h-4" />
                    <span>{KEYBINDS.FIT_VIEW.description}</span>
                    <KeybindHint keybind={KEYBINDS.FIT_VIEW} className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded" />
                  </Command.Item>
                  <Command.Item
                    onSelect={() => { zoomIn({ duration: 300 }); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <ZoomIn className="w-4 h-4" />
                    <span>Zoom in</span>
                    <kbd className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded">+</kbd>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => { zoomOut({ duration: 300 }); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <ZoomOut className="w-4 h-4" />
                    <span>Zoom out</span>
                    <kbd className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded">-</kbd>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => { layoutGraph(); setCommandPaletteOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Re-layout graph</span>
                  </Command.Item>
                </Command.Group>
                )}

                {/* Project switcher (when searching) */}
                {filteredProjects.length > 0 && (
                  <Command.Group heading="Switch Project" className="text-xs text-white/40 px-2 py-1 uppercase tracking-wider">
                    {filteredProjects.slice(0, 5).map(project => (
                      <Command.Item
                        key={project.id}
                        value={project.name}
                        onSelect={() => {
                          handleProjectSwitch(project.id);
                          setCommandPaletteOpen(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <span>{project.name}</span>
                        <span className="ml-auto text-xs text-white/30">{formatRelativeTime(project.modifiedAt)}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Projects Commands - hide in nodes-only mode */}
                {!isNodesOnlyMode && (
                <Command.Group heading="Projects" className="text-xs text-white/40 px-2 py-1 uppercase tracking-wider">
                  <Command.Item
                    onSelect={() => { toggleSidebar(); setCommandPaletteOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Folder className="w-4 h-4" />
                    <span>Toggle project sidebar</span>
                    <KeybindHint keybind={KEYBINDS.PROJECTS_SIDEBAR} className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded" />
                  </Command.Item>
                  <Command.Item
                    onSelect={() => { setModalState({ type: 'create' }); setCommandPaletteOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New project</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => { handleImport(); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Upload className="w-4 h-4 text-blue-400" />
                    <span>Import project</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={handleDownloadAllProjects}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Download className="w-4 h-4 text-purple-400" />
                    <span>Export all projects</span>
                  </Command.Item>
                </Command.Group>
                )}

                {/* Export Commands - hide in nodes-only mode */}
                {!isNodesOnlyMode && (
                <Command.Group heading="Export" className="text-xs text-white/40 px-2 py-1 uppercase tracking-wider">
                  <Command.Item
                    onSelect={handleCopyJson}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Copy className="w-4 h-4 text-blue-400" />
                    <span>Copy JSON to clipboard</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={handleDownloadJson}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Download className="w-4 h-4 text-blue-400" />
                    <span>Download JSON file</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={handleCopyMarkdown}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Copy className="w-4 h-4 text-green-400" />
                    <span>Copy Markdown to clipboard</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={handleDownloadMarkdown}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-white/80 hover:bg-white/10 data-[selected=true]:bg-white/10"
                  >
                    <Download className="w-4 h-4 text-green-400" />
                    <span>Download Markdown file</span>
                  </Command.Item>
                </Command.Group>
                )}

                {/* Danger Zone - hide in nodes-only mode */}
                {!isNodesOnlyMode && (
                <Command.Group heading="Danger Zone" className="text-xs text-white/40 px-2 py-1 uppercase tracking-wider">
                  <Command.Item
                    onSelect={handleReset}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-red-400 hover:bg-red-500/10 data-[selected=true]:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Reset graph</span>
                  </Command.Item>
                </Command.Group>
                )}

                {/* Keyboard shortcuts hint */}
                <div className="flex items-center gap-2 px-4 py-3 mt-2 border-t border-white/5 text-[10px] text-white/30">
                  <Keyboard className="w-3 h-3" />
                  <span>Navigate with arrow keys, Enter to select</span>
                </div>
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}

      {/* Notification Toast */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-lg px-6 py-3 shadow-2xl"
        >
          <p className="text-white text-sm font-medium">{notification}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
