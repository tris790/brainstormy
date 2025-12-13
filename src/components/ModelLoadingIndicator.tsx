import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';

export default function ModelLoadingIndicator() {
  const { isModelLoading, modelLoadProgress, modelLoadStatus, embeddingProvider } = useSettingsStore();

  // Only show when using local provider and loading
  if (embeddingProvider !== 'local' || !isModelLoading) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3">
          <div className="relative">
            <Cpu size={20} className="text-emerald-400" />
            <Loader2 size={12} className="text-emerald-400 animate-spin absolute -bottom-1 -right-1" />
          </div>

          <div className="flex flex-col">
            <span className="text-sm text-white font-medium">
              Loading AI Model
            </span>
            <span className="text-xs text-white/50">
              {modelLoadStatus}
            </span>
          </div>

          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden ml-2">
            <motion.div
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${modelLoadProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <span className="text-xs text-white/50 font-mono w-8">
            {modelLoadProgress}%
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
