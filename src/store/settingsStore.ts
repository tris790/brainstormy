import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LocalModelKey } from '../utils/localEmbeddings';

export type EmbeddingProvider = 'server' | 'local';

interface SettingsState {
  // Embedding settings
  embeddingProvider: EmbeddingProvider;
  localModel: LocalModelKey;

  // Model loading state (not persisted)
  isModelLoading: boolean;
  modelLoadProgress: number;
  modelLoadStatus: string;
  isModelReady: boolean;

  // UI settings
  isSettingsOpen: boolean;

  // Actions
  setEmbeddingProvider: (provider: EmbeddingProvider) => void;
  setLocalModel: (model: LocalModelKey) => void;
  setModelLoadingState: (isLoading: boolean, progress: number, status: string) => void;
  setModelReady: (ready: boolean) => void;
  toggleSettings: () => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      embeddingProvider: 'local',
      localModel: 'all-MiniLM-L6-v2',

      // Non-persisted state
      isModelLoading: false,
      modelLoadProgress: 0,
      modelLoadStatus: '',
      isModelReady: false,

      isSettingsOpen: false,

      // Actions
      setEmbeddingProvider: (provider) => set({ embeddingProvider: provider }),
      setLocalModel: (model) => set({ localModel: model }),
      setModelLoadingState: (isLoading, progress, status) => set({
        isModelLoading: isLoading,
        modelLoadProgress: progress,
        modelLoadStatus: status,
      }),
      setModelReady: (ready) => set({ isModelReady: ready }),
      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
    }),
    {
      name: 'brainstormy-settings',
      partialize: (state) => ({
        embeddingProvider: state.embeddingProvider,
        localModel: state.localModel,
      }),
    }
  )
);
