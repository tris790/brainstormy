import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import ProjectListItem from './ProjectListItem';
import { KEYBINDS, matchesKeybind } from '../config/keybinds';

export default function ProjectSidebar() {
  const { isSidebarOpen, toggleSidebar, createProject, getAllProjects, setModalState } = useProjectStore();
  const projects = getAllProjects();

  // Keyboard shortcut for toggling sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesKeybind(e, KEYBINDS.PROJECTS_SIDEBAR)) {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [toggleSidebar]);

  // Sort projects by modified date (most recent first)
  const sortedProjects = [...projects].sort((a, b) => b.modifiedAt - a.modifiedAt);

  const handleNewProject = () => {
    setModalState({ type: 'create' });
  };

  return (
    <>
      {/* Sidebar */}
      <motion.div
        initial={{ x: -280 }}
        animate={{ x: isSidebarOpen ? 0 : -280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 bottom-0 w-[280px] bg-gray-900/95 backdrop-blur-xl border-r border-white/10 z-40 flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            Projects
          </h2>
          <button
            onClick={toggleSidebar}
            className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* New Project Button */}
        <div className="p-3 shrink-0">
          <button
            onClick={handleNewProject}
            className="w-full px-4 py-2 bg-storm-600/20 border border-storm-500/50 rounded-lg text-sm text-white hover:bg-storm-600/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-2">
          {sortedProjects.length === 0 ? (
            <div className="text-center text-white/40 text-sm py-8">
              No projects yet
            </div>
          ) : (
            <div className="space-y-1">
              {sortedProjects.map((project) => (
                <ProjectListItem key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>

        {/* Footer with storage info */}
        <div className="p-3 border-t border-white/5 shrink-0">
          <div className="text-xs text-white/30">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </div>
        </div>
      </motion.div>

      {/* Sidebar toggle button (when closed) */}
      {!isSidebarOpen && (
        <motion.button
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          onClick={toggleSidebar}
          className="fixed left-4 top-4 z-40 p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Open sidebar"
        >
          <ChevronRight className="w-4 h-4 text-white/60" />
        </motion.button>
      )}
    </>
  );
}
