import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  X,
  Server,
  Cpu,
  Check,
  Loader2,
  Download,
  Trash2,
  Zap,
} from 'lucide-react';
import { useSettingsStore, type EmbeddingProvider } from '../store/settingsStore';
import {
  LOCAL_MODELS,
  type LocalModelKey,
  loadModel,
  isModelLoaded,
  getCurrentModel,
  unloadModel,
  subscribeToProgress,
} from '../utils/localEmbeddings';
import { KEYBINDS, matchesKeybind } from '../config/keybinds';
import { KeybindHintWithLabel } from './KeybindHint';

export default function SettingsPanel() {
  const {
    isSettingsOpen,
    setSettingsOpen,
    embeddingProvider,
    setEmbeddingProvider,
    localModel,
    setLocalModel,
    isModelLoading,
    modelLoadProgress,
    modelLoadStatus,
    setModelLoadingState,
    isModelReady,
    setModelReady,
  } = useSettingsStore();

  const [loadingModel, setLoadingModel] = useState<string | null>(null);

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = subscribeToProgress((progress, status) => {
      setModelLoadingState(progress < 100, progress, status);
    });
    return unsubscribe;
  }, [setModelLoadingState]);

  // Check if model is already loaded on mount
  useEffect(() => {
    if (isModelLoaded()) {
      setModelReady(true);
    }
  }, [setModelReady]);

  // Keyboard shortcut for settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesKeybind(e, KEYBINDS.SETTINGS)) {
        e.preventDefault();
        setSettingsOpen(!isSettingsOpen);
      }
      if (matchesKeybind(e, KEYBINDS.ESCAPE) && isSettingsOpen) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isSettingsOpen, setSettingsOpen]);

  const handleProviderChange = async (provider: EmbeddingProvider) => {
    setEmbeddingProvider(provider);

    // If switching to local and model not loaded, prompt to load
    if (provider === 'local' && (!isModelLoaded() || getCurrentModel() !== localModel)) {
      await handleLoadModel(localModel);
    }
  };

  const handleModelChange = async (modelKey: LocalModelKey) => {
    setLocalModel(modelKey);

    // If local provider is active, load the new model
    if (embeddingProvider === 'local') {
      await handleLoadModel(modelKey);
    }
  };

  const handleLoadModel = async (modelKey: LocalModelKey) => {
    setLoadingModel(modelKey);
    setModelLoadingState(true, 0, 'Initializing...');

    try {
      await loadModel(modelKey);
      setModelReady(true);
    } catch (error) {
      console.error('Failed to load model:', error);
      setModelReady(false);
    } finally {
      setLoadingModel(null);
      setModelLoadingState(false, 100, 'Ready');
    }
  };

  const handleUnloadModel = () => {
    unloadModel();
    setModelReady(false);
  };

  const currentModelLoaded = isModelLoaded() && getCurrentModel() === localModel;

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="fixed top-4 right-4 z-40 p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg hover:bg-white/10 transition-colors group cursor-pointer"
        title={`${KEYBINDS.SETTINGS.description} (${KEYBINDS.SETTINGS.displayText})`}
      >
        <Settings size={18} className="text-white/60 group-hover:text-white transition-colors" />
      </button>

      {/* Settings Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setSettingsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gray-900/95 backdrop-blur-xl border-l border-white/10 z-50 overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Settings size={20} />
                  Settings
                </h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} className="text-white/60" />
                </button>
              </div>

              <div className="p-4 space-y-6">
                {/* Embedding Provider Section */}
                <section>
                  <h3 className="text-sm font-medium text-white/80 uppercase tracking-wider mb-3">
                    Embedding Provider
                  </h3>

                  <div className="space-y-2">
                    {/* Server Option */}
                    <button
                      onClick={() => handleProviderChange('server')}
                      className={`w-full p-4 rounded-xl border transition-all text-left cursor-pointer ${
                        embeddingProvider === 'server'
                          ? 'bg-storm-600/20 border-storm-500/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          embeddingProvider === 'server' ? 'bg-storm-500/30' : 'bg-white/10'
                        }`}>
                          <Server size={20} className={
                            embeddingProvider === 'server' ? 'text-storm-400' : 'text-white/60'
                          } />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">Server</span>
                            {embeddingProvider === 'server' && (
                              <Check size={16} className="text-storm-400" />
                            )}
                          </div>
                          <p className="text-sm text-white/50 mt-1">
                            Uses OpenAI API or mock embeddings. Requires network connection.
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Local Option */}
                    <button
                      onClick={() => handleProviderChange('local')}
                      className={`w-full p-4 rounded-xl border transition-all text-left cursor-pointer ${
                        embeddingProvider === 'local'
                          ? 'bg-emerald-600/20 border-emerald-500/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          embeddingProvider === 'local' ? 'bg-emerald-500/30' : 'bg-white/10'
                        }`}>
                          <Cpu size={20} className={
                            embeddingProvider === 'local' ? 'text-emerald-400' : 'text-white/60'
                          } />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">Local (Browser)</span>
                            <Zap size={14} className="text-amber-400" />
                            {embeddingProvider === 'local' && (
                              <Check size={16} className="text-emerald-400" />
                            )}
                          </div>
                          <p className="text-sm text-white/50 mt-1">
                            Runs directly in your browser. Zero latency, works offline.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </section>

                {/* Local Model Selection */}
                {embeddingProvider === 'local' && (
                  <section>
                    <h3 className="text-sm font-medium text-white/80 uppercase tracking-wider mb-3">
                      Local Model
                    </h3>

                    <div className="space-y-2">
                      {Object.entries(LOCAL_MODELS).map(([key, model]) => {
                        const isSelected = localModel === key;
                        const isLoading = loadingModel === key;
                        const isCurrentlyLoaded = currentModelLoaded && key === localModel;

                        return (
                          <button
                            key={key}
                            onClick={() => handleModelChange(key as LocalModelKey)}
                            disabled={isModelLoading}
                            className={`w-full p-4 rounded-xl border transition-all text-left ${
                              isSelected
                                ? 'bg-white/10 border-white/30'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            } ${isModelLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white">{model.name}</span>
                                  {isSelected && (
                                    <Check size={16} className="text-emerald-400" />
                                  )}
                                  {isCurrentlyLoaded && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                                      Loaded
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-white/50 mt-1">
                                  {model.description}
                                </p>
                                <p className="text-xs text-white/30 mt-1">
                                  Size: {model.size}
                                </p>
                              </div>

                              {isLoading ? (
                                <Loader2 size={18} className="text-white/60 animate-spin" />
                              ) : !isCurrentlyLoaded && isSelected ? (
                                <Download size={18} className="text-white/40" />
                              ) : null}
                            </div>

                            {/* Progress bar */}
                            {isLoading && (
                              <div className="mt-3">
                                <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                                  <span>{modelLoadStatus}</span>
                                  <span>{modelLoadProgress}%</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 transition-all duration-300"
                                    style={{ width: `${modelLoadProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Unload Model Button */}
                    {isModelReady && (
                      <button
                        onClick={handleUnloadModel}
                        className="mt-3 w-full p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Trash2 size={16} />
                        Unload Model (Free Memory)
                      </button>
                    )}
                  </section>
                )}

                {/* Info Section */}
                <section className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-sm font-medium text-white/80 mb-2">
                    About Local Embeddings
                  </h4>
                  <ul className="text-sm text-white/50 space-y-1">
                    <li>- First load downloads the model (~23-33MB)</li>
                    <li>- Model is cached in browser for future use</li>
                    <li>- Zero network latency for embeddings</li>
                    <li>- Works completely offline after download</li>
                    <li>- Uses WebAssembly for fast inference</li>
                  </ul>
                </section>

                {/* Keyboard Shortcuts */}
                <section className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-sm font-medium text-white/80 mb-2">
                    Keyboard Shortcuts
                  </h4>
                  <div className="text-sm text-white/50 space-y-1">
                    <KeybindHintWithLabel keybind={KEYBINDS.SETTINGS} kbdClassName="px-1.5 py-0.5 bg-white/10 rounded text-xs" />
                    <KeybindHintWithLabel keybind={KEYBINDS.COMMAND_PALETTE} kbdClassName="px-1.5 py-0.5 bg-white/10 rounded text-xs" />
                    <KeybindHintWithLabel keybind={KEYBINDS.PROJECTS_SIDEBAR} kbdClassName="px-1.5 py-0.5 bg-white/10 rounded text-xs" />
                    <KeybindHintWithLabel keybind={KEYBINDS.TOGGLE_MODE} kbdClassName="px-1.5 py-0.5 bg-white/10 rounded text-xs" />
                  </div>
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
