import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import Graph from './components/Graph';
import InputBar from './components/InputBar';
import CommandPalette from './components/CommandPalette';
import SettingsPanel from './components/SettingsPanel';
import ModelLoadingIndicator from './components/ModelLoadingIndicator';
import ProjectSidebar from './components/ProjectSidebar';
import ProjectModal from './components/ProjectModal';
import { useProjectStore } from './store/projectStore';
import { useGraphStore } from './store/graphStore';

export default function App() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const { setState: setGraphState, clearHistory } = useGraphStore();

  // Load active project data into graphStore when switching projects
  useEffect(() => {
    if (!activeProjectId) return;

    const activeProject = useProjectStore.getState().projects[activeProjectId];
    if (activeProject) {
      setGraphState({
        nodes: JSON.parse(JSON.stringify(activeProject.data.nodes)),
        edges: JSON.parse(JSON.stringify(activeProject.data.edges)),
        colorIndex: activeProject.data.colorIndex,
        selectedNodeId: 'root',
      });
      clearHistory();
    }
  }, [activeProjectId, setGraphState, clearHistory]);

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 font-sans overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-storm-600/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px]" />
      </div>

      <ReactFlowProvider>
        <ProjectSidebar />
        <Graph />
        <InputBar />
        <CommandPalette />
        <SettingsPanel />
        <ModelLoadingIndicator />
        <ProjectModal />
      </ReactFlowProvider>
    </div>
  );
}
