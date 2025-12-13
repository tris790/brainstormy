import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, ImportResult, BrainstormNode, BrainstormEdge } from '../types';
import {
  generateProjectId,
  generateContentHash,
  getStorageSize,
  STORAGE_WARNING_THRESHOLD,
  STORAGE_MAX_THRESHOLD,
  MAX_PROJECTS,
} from '../utils/projectUtils';

// Topic colors (same as in graphStore)
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

interface ProjectStore {
  // State
  activeProjectId: string | null;
  projects: Record<string, Project>;
  isSidebarOpen: boolean;

  // Modal state
  modalState: {
    type: 'create' | 'rename' | 'delete' | 'duplicate' | null;
    projectId?: string;
    duplicateProject?: Project;
  };

  // Actions
  createProject: (name?: string) => string;
  deleteProject: (id: string) => void;
  switchProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  updateProjectColor: (id: string, color: string) => void;
  importProject: (jsonData: string) => Promise<ImportResult>;
  exportProject: (id: string) => object | null;
  exportAllProjects: () => object;
  syncActiveProjectData: (data: { nodes: BrainstormNode[]; edges: BrainstormEdge[]; colorIndex: number }) => void;
  toggleSidebar: () => void;
  setModalState: (state: ProjectStore['modalState']) => void;

  // Getters
  getActiveProject: () => Project | null;
  getAllProjects: () => Project[];
  findDuplicateByHash: (hash: string) => Project | null;
}

// Initial nodes for new projects
const initialNodes: BrainstormNode[] = [
  {
    id: 'root',
    type: 'anchor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Brainstorm',
      topic: 'Main',
      color: '#636ef1',
      isAnchor: true,
      createdAt: Date.now(),
    },
  },
];

const initialEdges: BrainstormEdge[] = [];

/**
 * Migrate from legacy storage to new project system
 */
function migrateFromLegacyStorage(): Project | null {
  const legacy = localStorage.getItem('brainstormy-storage');
  if (!legacy) return null;

  try {
    const parsed = JSON.parse(legacy);

    const defaultProject: Project = {
      id: generateProjectId(),
      name: 'My First Brainstorm',
      color: '#636ef1',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      contentHash: '', // Will be computed async
      data: {
        nodes: parsed.state?.nodes || initialNodes,
        edges: parsed.state?.edges || initialEdges,
        colorIndex: parsed.state?.colorIndex || 0,
      },
    };

    // Compute hash synchronously for migration (will be async in normal flow)
    generateContentHash(defaultProject.data.nodes, defaultProject.data.edges).then(
      (hash) => {
        const store = useProjectStore.getState();
        const projects = store.projects;
        if (projects[defaultProject.id]) {
          projects[defaultProject.id].contentHash = hash;
        }
      }
    );

    // Remove legacy key after migration
    localStorage.removeItem('brainstormy-storage');

    return defaultProject;
  } catch (error) {
    console.error('Failed to migrate legacy storage:', error);
    return null;
  }
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Initial state
      activeProjectId: null,
      projects: {},
      isSidebarOpen: true,
      modalState: { type: null },

      // Create a new project
      createProject: (name?: string) => {
        const { projects } = get();

        // Check project limit
        if (Object.keys(projects).length >= MAX_PROJECTS) {
          throw new Error(`Maximum ${MAX_PROJECTS} projects reached. Please delete some projects.`);
        }

        // Check storage size
        const storageSize = getStorageSize();
        if (storageSize > STORAGE_MAX_THRESHOLD) {
          throw new Error('Storage limit reached. Please export and delete old projects.');
        }

        const projectId = generateProjectId();
        const newProject: Project = {
          id: projectId,
          name: name || `Brainstorm ${Object.keys(projects).length + 1}`,
          color: TOPIC_COLORS[Object.keys(projects).length % TOPIC_COLORS.length],
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          contentHash: '',
          data: {
            nodes: JSON.parse(JSON.stringify(initialNodes)),
            edges: JSON.parse(JSON.stringify(initialEdges)),
            colorIndex: 0,
          },
        };

        // Compute initial hash
        generateContentHash(newProject.data.nodes, newProject.data.edges).then((hash) => {
          const store = useProjectStore.getState();
          const projects = store.projects;
          if (projects[projectId]) {
            projects[projectId].contentHash = hash;
          }
        });

        set({
          projects: { ...projects, [projectId]: newProject },
        });

        return projectId;
      },

      // Delete a project
      deleteProject: (id: string) => {
        const { projects, activeProjectId } = get();

        // Prevent deletion of last project
        if (Object.keys(projects).length === 1) {
          throw new Error('Cannot delete the last project');
        }

        // If deleting active project, switch to another one
        if (id === activeProjectId) {
          const remainingIds = Object.keys(projects).filter((k) => k !== id);

          // Sort by modifiedAt descending
          const sortedIds = remainingIds.sort(
            (a, b) => projects[b].modifiedAt - projects[a].modifiedAt
          );

          if (sortedIds.length > 0) {
            get().switchProject(sortedIds[0]);
          }
        }

        // Remove project
        const newProjects = { ...projects };
        delete newProjects[id];
        set({ projects: newProjects });
      },

      // Switch to a different project
      switchProject: (id: string) => {
        const { projects } = get();
        const project = projects[id];

        if (!project) {
          console.error('Project not found:', id);
          return;
        }

        // This will be handled by graphStore to load the data and clear history
        set({
          activeProjectId: id,
          projects: {
            ...projects,
            [id]: {
              ...project,
              modifiedAt: Date.now(),
            },
          },
        });
      },

      // Rename a project
      renameProject: (id: string, name: string) => {
        const { projects } = get();
        const project = projects[id];

        if (!project) return;

        set({
          projects: {
            ...projects,
            [id]: {
              ...project,
              name,
              modifiedAt: Date.now(),
            },
          },
        });
      },

      // Update project color
      updateProjectColor: (id: string, color: string) => {
        const { projects } = get();
        const project = projects[id];

        if (!project) return;

        set({
          projects: {
            ...projects,
            [id]: {
              ...project,
              color,
              modifiedAt: Date.now(),
            },
          },
        });
      },

      // Import a project from JSON
      importProject: async (jsonData: string): Promise<ImportResult> => {
        try {
          const parsed = JSON.parse(jsonData);

          // Validate structure
          if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
            return { success: false, error: 'Invalid JSON format: missing or invalid nodes array', isDuplicate: false };
          }
          if (!parsed.edges || !Array.isArray(parsed.edges)) {
            return { success: false, error: 'Invalid JSON format: missing or invalid edges array', isDuplicate: false };
          }

          // Validate nodes
          for (const node of parsed.nodes) {
            if (!node.id || !node.data?.label) {
              return { success: false, error: 'Invalid node structure', isDuplicate: false };
            }
          }

          // Validate edges reference existing nodes
          const nodeIds = new Set(parsed.nodes.map((n: BrainstormNode) => n.id));
          for (const edge of parsed.edges) {
            if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
              return { success: false, error: 'Invalid edge references', isDuplicate: false };
            }
          }

          // Generate content hash
          const hash = await generateContentHash(parsed.nodes, parsed.edges);

          // Check for duplicates
          const duplicate = get().findDuplicateByHash(hash);
          if (duplicate) {
            return {
              success: false,
              isDuplicate: true,
              duplicateProject: duplicate,
            };
          }

          // Create new project from imported data
          const projectName =
            parsed.projectName ||
            (parsed.metadata?.exportedAt
              ? `Imported ${new Date(parsed.metadata.exportedAt).toLocaleDateString()}`
              : `Imported ${new Date().toLocaleDateString()}`);

          const projectId = generateProjectId();
          const newProject: Project = {
            id: projectId,
            name: projectName,
            color: parsed.projectColor || TOPIC_COLORS[Math.floor(Math.random() * TOPIC_COLORS.length)],
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            contentHash: hash,
            data: {
              nodes: parsed.nodes,
              edges: parsed.edges,
              colorIndex: 0,
            },
          };

          set((state) => ({
            projects: { ...state.projects, [projectId]: newProject },
          }));

          return {
            success: true,
            isDuplicate: false,
            newProjectId: projectId,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to parse JSON',
            isDuplicate: false,
          };
        }
      },

      // Export a single project
      exportProject: (id: string) => {
        const { projects } = get();
        const project = projects[id];

        if (!project) return null;

        return {
          version: '2.0',
          projectId: project.id,
          projectName: project.name,
          projectColor: project.color,
          nodes: project.data.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: {
              label: n.data.label,
              topic: n.data.topic,
              color: n.data.color,
              parentId: n.data.parentId,
              isAnchor: n.data.isAnchor,
              createdAt: n.data.createdAt,
            },
          })),
          edges: project.data.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: e.type,
            style: e.style,
            animated: e.animated,
          })),
          metadata: {
            exportedAt: new Date().toISOString(),
            nodeCount: project.data.nodes.length,
            edgeCount: project.data.edges.length,
            createdAt: new Date(project.createdAt).toISOString(),
            modifiedAt: new Date(project.modifiedAt).toISOString(),
          },
        };
      },

      // Export all projects as a bundle
      exportAllProjects: () => {
        const { projects } = get();

        return {
          version: '2.0-bundle',
          exportedAt: new Date().toISOString(),
          projectCount: Object.keys(projects).length,
          projects: Object.values(projects).map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            createdAt: new Date(p.createdAt).toISOString(),
            modifiedAt: new Date(p.modifiedAt).toISOString(),
            data: {
              nodes: p.data.nodes.map((n) => ({
                id: n.id,
                type: n.type,
                position: n.position,
                data: {
                  label: n.data.label,
                  topic: n.data.topic,
                  color: n.data.color,
                  parentId: n.data.parentId,
                  isAnchor: n.data.isAnchor,
                  createdAt: n.data.createdAt,
                },
              })),
              edges: p.data.edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: e.type,
                style: e.style,
                animated: e.animated,
              })),
            },
          })),
        };
      },

      // Sync data from graphStore to active project
      syncActiveProjectData: (data: { nodes: BrainstormNode[]; edges: BrainstormEdge[]; colorIndex: number }) => {
        const { activeProjectId, projects } = get();

        if (!activeProjectId || !projects[activeProjectId]) return;

        // Update project with new data and modified timestamp
        const updatedProject = {
          ...projects[activeProjectId],
          modifiedAt: Date.now(),
          data,
        };

        // Compute new hash asynchronously
        generateContentHash(data.nodes, data.edges).then((hash) => {
          const store = useProjectStore.getState();
          const projects = store.projects;
          if (projects[activeProjectId]) {
            projects[activeProjectId].contentHash = hash;
          }
        });

        set({
          projects: {
            ...projects,
            [activeProjectId]: updatedProject,
          },
        });
      },

      // Toggle sidebar
      toggleSidebar: () => {
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
      },

      // Set modal state
      setModalState: (modalState) => {
        set({ modalState });
      },

      // Get active project
      getActiveProject: () => {
        const { activeProjectId, projects } = get();
        return activeProjectId ? projects[activeProjectId] || null : null;
      },

      // Get all projects as array
      getAllProjects: () => {
        return Object.values(get().projects);
      },

      // Find duplicate project by hash
      findDuplicateByHash: (hash: string) => {
        const { projects } = get();
        return Object.values(projects).find((p) => p.contentHash === hash) || null;
      },
    }),
    {
      name: 'brainstormy-projects-v2',
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        projects: state.projects,
        isSidebarOpen: state.isSidebarOpen,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Check for legacy storage migration
        const legacyProject = migrateFromLegacyStorage();

        // If no projects exist, create default or use migrated
        if (Object.keys(state.projects).length === 0) {
          const defaultProject = legacyProject || {
            id: generateProjectId(),
            name: 'My First Brainstorm',
            color: '#636ef1',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            contentHash: '',
            data: {
              nodes: JSON.parse(JSON.stringify(initialNodes)),
              edges: JSON.parse(JSON.stringify(initialEdges)),
              colorIndex: 0,
            },
          };

          state.projects = { [defaultProject.id]: defaultProject };
          state.activeProjectId = defaultProject.id;

          // Compute hash for default project
          generateContentHash(defaultProject.data.nodes, defaultProject.data.edges).then(
            (hash) => {
              const store = useProjectStore.getState();
              const projects = store.projects;
              if (projects[defaultProject.id]) {
                projects[defaultProject.id].contentHash = hash;
              }
            }
          );
        } else if (legacyProject) {
          // Migrated project exists, add it to projects
          state.projects = { [legacyProject.id]: legacyProject, ...state.projects };
          state.activeProjectId = legacyProject.id;
        }

        // Ensure active project is valid
        if (!state.activeProjectId || !state.projects[state.activeProjectId]) {
          // Select the most recently modified project
          const projectIds = Object.keys(state.projects);
          if (projectIds.length > 0) {
            const mostRecentProjectId = projectIds.reduce((latestId, currentId) => {
              const latestProject = state.projects[latestId];
              const currentProject = state.projects[currentId];
              return currentProject.modifiedAt > latestProject.modifiedAt
                ? currentId
                : latestId;
            });
            state.activeProjectId = mostRecentProjectId;
          }
        }

        // Check storage size and warn if needed
        const storageSize = getStorageSize();
        if (storageSize > STORAGE_WARNING_THRESHOLD) {
          console.warn(
            `localStorage is getting full (${(storageSize / 1024 / 1024).toFixed(2)}MB). Consider exporting and deleting old projects.`
          );
        }
      },
    }
  )
);
