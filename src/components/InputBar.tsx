import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2, Sparkles, Cpu, Server, CornerDownRight, Plus } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { useSettingsStore } from '../store/settingsStore';
import { KEYBINDS, matchesKeybind } from '../config/keybinds';
import { KeybindHintInline } from './KeybindHint';

export default function InputBar() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'auto' | 'child' | 'current'>('auto');
  const lastManualMode = useRef<'child' | 'current'>('child');
  const inputRef = useRef<HTMLInputElement>(null);

  const { addNode, addNodeToSelected, isProcessing, selectedNodeId, nodes, setInputBarFocusFn, setInputBarToggleModeFn, setInputBarAutoModeFn } = useGraphStore();
  const { embeddingProvider, isModelReady, isModelLoading, setSettingsOpen } = useSettingsStore();

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const toggleMode = () => {
    setMode(m => {
      if (m === 'auto') return 'child';
      if (m === 'child') return 'current';
      return 'auto';
    });
  };

  useEffect(() => {
    // Register focus function with store
    // Register functions with store
    const focusFn = () => {
      inputRef.current?.focus();
    };
    setInputBarFocusFn(focusFn);

    // Toggle strictly between manual modes (Tab)
    const toggleManualMode = () => {
      setMode(currentMode => {
        if (currentMode === 'auto') {
          // If in auto, switch to last manual mode
          return lastManualMode.current;
        }
        // If in manual, toggle and update ref
        const newMode = currentMode === 'child' ? 'current' : 'child';
        lastManualMode.current = newMode;
        return newMode;
      });
    };
    setInputBarToggleModeFn(toggleManualMode);

    // Switch to auto mode or back to manual (Shift+Tab)
    const toggleAutoMode = () => {
      setMode(currentMode => {
        if (currentMode === 'auto') {
          // Toggle back to manual
          return lastManualMode.current;
        }
        // Switch to auto
        return 'auto';
      });
    };
    setInputBarAutoModeFn(toggleAutoMode);

    // Focus input on mount
    inputRef.current?.focus();

    return () => {
      setInputBarFocusFn(null);
      setInputBarToggleModeFn(null);
      setInputBarAutoModeFn(null);
    };
  }, [setInputBarFocusFn, setInputBarToggleModeFn, setInputBarAutoModeFn]);

  const handleSubmit = async (e: React.KeyboardEvent) => {
    if (matchesKeybind(e.nativeEvent, KEYBINDS.ENTER) && input.trim() && !isProcessing) {
      const text = input.trim();
      setInput('');

      if (mode === 'auto') {
        await addNode(text);
      } else if (mode === 'child') {
        await addNodeToSelected(text, true);
      } else {
        // current mode - add to selected but don't select new node
        await addNodeToSelected(text, false);
      }

      // Refocus input
      inputRef.current?.focus();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, x: '-50%' }}
      animate={{ opacity: 1, scale: 1, x: '-50%' }}
      exit={{ opacity: 0, scale: 0.95, x: '-50%' }}
      transition={{ delay: 0.2 }}
      className="fixed w-full max-w-2xl px-4 z-50"
      style={{
        bottom: '1%',
        left: '50%'
      }}
    >
      <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Mode indicator */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <button
            onClick={toggleMode}
            className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${mode === 'auto'
              ? 'text-storm-400'
              : mode === 'child' ? 'text-emerald-400' : 'text-amber-400'
              }`}
          >
            {mode === 'auto' ? (
              <>
                <Sparkles size={12} />
                <span>Auto-organize</span>
              </>
            ) : mode === 'child' ? (
              <>
                <CornerDownRight size={12} />
                <span>Connect to child: <span className="text-white font-semibold">{selectedNode?.data.label}</span></span>
              </>
            ) : (
              <>
                <Plus size={12} />
                <span>Connect to current: <span className="text-white font-semibold">{selectedNode?.data.label}</span></span>
              </>
            )}
          </button>

          {/* Embedding provider indicator */}
          <button
            onClick={() => setSettingsOpen(true)}
            className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors hover:opacity-80 cursor-pointer ${embeddingProvider === 'local' ? 'text-emerald-400' : 'text-white/40'
              }`}
            title="Click to change embedding provider"
          >
            {embeddingProvider === 'local' ? (
              <>
                <Cpu size={10} />
                <span>Local{isModelLoading ? ' (loading...)' : ''}</span>
              </>
            ) : (
              <>
                <Server size={10} />
                <span>Server</span>
              </>
            )}
          </button>
        </div>

        {/* Input field */}
        <div className="relative">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (matchesKeybind(e.nativeEvent, KEYBINDS.SWITCH_TO_AUTO)) {
                e.preventDefault();
                // Toggle Auto <-> Manual (Shift+Tab)
                useGraphStore.getState().switchToAutoMode();
              } else if (matchesKeybind(e.nativeEvent, KEYBINDS.TOGGLE_MODE)) {
                e.preventDefault();
                // Toggle Manual Child <-> Current (Tab)
                useGraphStore.getState().toggleInputBarMode();
              } else {
                handleSubmit(e);
              }
            }}
            placeholder={mode === 'auto'
              ? "Type an idea... (AI will organize it)"
              : mode === 'child'
                ? `Add child to "${selectedNode?.data.label}"...`
                : `Add to "${selectedNode?.data.label}"...`
            }
            className="w-full bg-transparent px-5 py-4 text-lg text-white placeholder-white/30 outline-none font-light"
            disabled={isProcessing}
          />

          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <Loader2 className="w-5 h-5 text-storm-400 animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-white/30 font-mono">
          <span>
            <KeybindHintInline keybind={KEYBINDS.ENTER} showLabel={false} kbdClassName="px-1.5 py-0.5 bg-white/10 rounded text-white/50" /> Add
          </span>
          <span>
            <KeybindHintInline keybind={KEYBINDS.COMMAND_PALETTE} showLabel={false} kbdClassName="px-1.5 py-0.5 bg-white/10 rounded text-white/50" /> Commands
          </span>
          <span>
            <KeybindHintInline keybind={KEYBINDS.SETTINGS} showLabel={false} kbdClassName="px-1.5 py-0.5 bg-white/10 rounded text-white/50" /> Settings
          </span>
        </div>
      </div>
    </motion.div>
  );
}
