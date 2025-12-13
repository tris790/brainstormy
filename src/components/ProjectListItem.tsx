import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2, Palette, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Project } from '../types';
import { useProjectStore } from '../store/projectStore';
import { useGraphStore } from '../store/graphStore';
import { formatRelativeTime } from '../utils/projectUtils';
import { KEYBINDS, matchesKeybind } from '../config/keybinds';

interface ProjectListItemProps {
  project: Project;
}

export default function ProjectListItem({ project }: ProjectListItemProps) {
  const { activeProjectId, switchProject, setModalState, exportProject, renameProject } = useProjectStore();
  const { setNodes, setEdges, setState: setGraphState, clearHistory, centerOnRootAndFocus } = useGraphStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isActive = activeProjectId === project.id;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  // Cleanup click timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    if (!isEditing && !isActive) {
      // Clear any existing timeout to prevent click from firing on double-click
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }

      // Delay the click to allow double-click to cancel it
      clickTimeoutRef.current = setTimeout(() => {
        // Switch project: load its data into graphStore and clear history
        switchProject(project.id);

        // Load project data into graphStore
        setGraphState({
          nodes: JSON.parse(JSON.stringify(project.data.nodes)),
          edges: JSON.parse(JSON.stringify(project.data.edges)),
          colorIndex: project.data.colorIndex,
          selectedNodeId: 'root',
        });

        // Clear undo/redo history
        clearHistory();

        // Center camera on root and focus input
        setTimeout(() => centerOnRootAndFocus(), 100);
      }, 200);
    }
  };

  const handleDoubleClick = () => {
    // Cancel the pending single click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    setIsEditing(true);
    setEditName(project.name);
  };

  const handleRename = () => {
    if (editName.trim() && editName !== project.name) {
      renameProject(project.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (matchesKeybind(e.nativeEvent, KEYBINDS.ENTER)) {
      handleRename();
    } else if (matchesKeybind(e.nativeEvent, KEYBINDS.ESCAPE)) {
      setIsEditing(false);
      setEditName(project.name);
    }
  };

  const handleMenuAction = (action: string) => {
    setIsMenuOpen(false);

    switch (action) {
      case 'rename':
        setIsEditing(true);
        break;
      case 'color':
        setModalState({
          type: 'rename', // We'll use a color picker in the modal
          projectId: project.id,
        });
        break;
      case 'delete':
        setModalState({
          type: 'delete',
          projectId: project.id,
        });
        break;
      case 'export':
        const data = exportProject(project.id);
        if (data) {
          const safeName = project.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 30);
          const filename = `${safeName}-${new Date().toISOString().split('T')[0]}.json`;
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
        }
        break;
    }
  };

  return (
    <div className="relative">
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={`w-full p-3 rounded-lg text-left transition-colors group cursor-pointer ${
          isActive
            ? 'bg-white/10 border border-white/20'
            : 'hover:bg-white/5 border border-transparent'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Color indicator */}
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
          />

          {/* Project name */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyDown}
                className="w-full bg-white/5 border border-white/20 rounded px-2 py-1 text-sm text-white outline-none focus:border-storm-500"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="text-sm text-white font-medium truncate">
                  {project.name}
                </div>
                <div className="text-xs text-white/40">
                  {formatRelativeTime(project.modifiedAt)}
                </div>
              </>
            )}
          </div>

          {/* Menu button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity shrink-0"
          >
            <MoreVertical className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full mt-1 w-48 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 py-1"
          >
            <button
              onClick={() => handleMenuAction('rename')}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-3"
            >
              <Edit2 className="w-4 h-4" />
              Rename
            </button>
            <button
              onClick={() => handleMenuAction('color')}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-3"
            >
              <Palette className="w-4 h-4" />
              Change color
            </button>
            <button
              onClick={() => handleMenuAction('export')}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-3"
            >
              <Download className="w-4 h-4" />
              Export project
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleMenuAction('delete')}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
