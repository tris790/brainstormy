import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useGraphStore } from '../store/graphStore';
import { KEYBINDS, matchesKeybind } from '../config/keybinds';

// Topic colors (same as in stores)
const TOPIC_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#e11d48', // Rose
  '#6366f1', // Indigo
];

export default function ProjectModal() {
  const { modalState, setModalState, createProject, renameProject, deleteProject, updateProjectColor, projects, switchProject } = useProjectStore();
  const { setNodes, setEdges, setState: setGraphState, clearHistory, focusInputBar, centerOnRootAndFocus } = useGraphStore();
  const [inputValue, setInputValue] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = modalState.type !== null;
  const project = modalState.projectId ? projects[modalState.projectId] : null;

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Set initial values when modal opens
  useEffect(() => {
    if (modalState.type === 'create') {
      setInputValue('');
      setSelectedColor(TOPIC_COLORS[0]);
    } else if (modalState.type === 'rename' && project) {
      setInputValue(project.name);
      setSelectedColor(project.color);
    }
  }, [modalState.type, project]);

  const handleClose = () => {
    setModalState({ type: null });
    setInputValue('');
  };

  const handleConfirm = () => {
    switch (modalState.type) {
      case 'create':
        const newProjectId = createProject(inputValue.trim() || undefined);
        switchProject(newProjectId);

        // Load new project data into graphStore
        const newProject = projects[newProjectId];
        if (newProject) {
          setGraphState({
            nodes: JSON.parse(JSON.stringify(newProject.data.nodes)),
            edges: JSON.parse(JSON.stringify(newProject.data.edges)),
            colorIndex: newProject.data.colorIndex,
            selectedNodeId: 'root',
          });
          clearHistory();
        }

        // Center camera on root and focus the idea input bar
        setTimeout(() => centerOnRootAndFocus(), 100);
        break;

      case 'rename':
        if (modalState.projectId) {
          if (inputValue.trim()) {
            renameProject(modalState.projectId, inputValue.trim());
          }
          if (selectedColor && selectedColor !== project?.color) {
            updateProjectColor(modalState.projectId, selectedColor);
          }
        }
        break;

      case 'delete':
        if (modalState.projectId) {
          deleteProject(modalState.projectId);
        }
        break;

      case 'duplicate':
        // User chose to switch to existing duplicate
        if (modalState.duplicateProject) {
          switchProject(modalState.duplicateProject.id);
          setGraphState({
            nodes: JSON.parse(JSON.stringify(modalState.duplicateProject.data.nodes)),
            edges: JSON.parse(JSON.stringify(modalState.duplicateProject.data.edges)),
            colorIndex: modalState.duplicateProject.data.colorIndex,
            selectedNodeId: 'root',
          });
          clearHistory();

          // Center camera on root and focus input
          setTimeout(() => centerOnRootAndFocus(), 100);
        }
        break;
    }

    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (matchesKeybind(e.nativeEvent, KEYBINDS.ENTER) && modalState.type !== 'delete') {
      handleConfirm();
    } else if (matchesKeybind(e.nativeEvent, KEYBINDS.ESCAPE)) {
      handleClose();
    }
  };

  const getModalContent = () => {
    switch (modalState.type) {
      case 'create':
        return {
          title: 'Create New Project',
          confirmText: 'Create',
          confirmClass: 'bg-storm-600 hover:bg-storm-700',
          content: (
            <>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Project name (optional)"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 outline-none focus:border-storm-500 transition-colors"
              />
              <div className="mt-4">
                <label className="text-sm text-white/60 mb-2 block">Project Color</label>
                <div className="grid grid-cols-5 gap-2">
                  {TOPIC_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-full aspect-square rounded-lg transition-all ${
                        selectedColor === color
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </>
          ),
        };

      case 'rename':
        return {
          title: 'Edit Project',
          confirmText: 'Save',
          confirmClass: 'bg-storm-600 hover:bg-storm-700',
          content: (
            <>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Project name"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 outline-none focus:border-storm-500 transition-colors"
              />
              <div className="mt-4">
                <label className="text-sm text-white/60 mb-2 block">Project Color</label>
                <div className="grid grid-cols-5 gap-2">
                  {TOPIC_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-full aspect-square rounded-lg transition-all ${
                        selectedColor === color
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </>
          ),
        };

      case 'delete':
        return {
          title: 'Delete Project',
          confirmText: 'Delete',
          confirmClass: 'bg-red-600 hover:bg-red-700',
          content: (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white">
                    Are you sure you want to delete <strong>{project?.name}</strong>?
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    This action cannot be undone. All brainstorm data will be permanently deleted.
                  </p>
                </div>
              </div>
            </div>
          ),
        };

      case 'duplicate':
        return {
          title: 'Duplicate Project Found',
          confirmText: 'Switch to Existing',
          confirmClass: 'bg-storm-600 hover:bg-storm-700',
          content: (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white">
                    This project already exists as <strong>{modalState.duplicateProject?.name}</strong>.
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Would you like to switch to the existing project?
                  </p>
                </div>
              </div>
            </div>
          ),
        };

      default:
        return null;
    }
  };

  const modalContent = getModalContent();
  if (!modalContent) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed w-full max-w-md z-50"
            style={{
              top: '50%',
              left: '50%',
            }}
          >
            <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">{modalContent.title}</h3>
                <button
                  onClick={handleClose}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">{modalContent.content}</div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${modalContent.confirmClass}`}
                >
                  {modalContent.confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
