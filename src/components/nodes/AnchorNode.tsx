import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Sparkles, Trash2, Edit2, Check, X } from 'lucide-react';
import type { BrainstormNode } from '../../types';
import { useGraphStore } from '../../store/graphStore';
import { KEYBINDS, matchesKeybind } from '../../config/keybinds';

interface AnchorNodeProps {
  data: BrainstormNode['data'];
  id: string;
  selected: boolean;
}

function AnchorNode({ data, id, selected }: AnchorNodeProps) {
  const { editingNodeId, setEditingNodeId, updateNodeLabel, deleteNode } = useGraphStore();
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingNodeId === id;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Reset the edit value to current label when entering edit mode
      setEditValue(data.label);
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, data.label]);

  const handleSave = () => {
    if (editValue.trim()) {
      updateNodeLabel(id, editValue.trim());
    }
    setEditingNodeId(null);
  };

  const handleCancel = () => {
    setEditValue(data.label);
    setEditingNodeId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (matchesKeybind(e.nativeEvent, KEYBINDS.ENTER)) {
      handleSave();
    } else if (matchesKeybind(e.nativeEvent, KEYBINDS.ESCAPE)) {
      handleCancel();
    }
    e.stopPropagation();
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`
        relative px-5 py-3 rounded-xl min-w-[180px] max-w-[300px]
        backdrop-blur-xl bg-gradient-to-br from-white/15 to-white/5
        border-2 transition-all duration-200 group
        ${selected ? 'border-white/50 shadow-lg shadow-white/10' : 'border-white/20'}
        hover:border-white/40 hover:shadow-lg hover:shadow-white/5
      `}
      style={{
        borderLeftColor: data.color || '#636ef1',
        borderLeftWidth: '4px',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-white/30 !border-2 !border-white/50 transition-all hover:!bg-white/60"
      />

      {/* Topic badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={12} style={{ color: data.color || '#636ef1' }} />
        <span
          className="text-[10px] font-mono uppercase tracking-widest opacity-70"
          style={{ color: data.color || '#636ef1' }}
        >
          Topic
        </span>
      </div>

      {/* Label */}
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-white/10 text-white text-sm font-semibold rounded px-2 py-1 outline-none focus:ring-2 focus:ring-white/30 flex-1 min-w-0"
          />
          <button
            onClick={handleSave}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <Check size={14} className="text-green-400" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X size={14} className="text-red-400" />
          </button>
        </div>
      ) : (
        <div className="text-white text-sm font-semibold leading-tight break-words">
          {data.label}
        </div>
      )}

      {/* Actions */}
      {!isEditing && (
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditingNodeId(id)}
            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-sm"
          >
            <Edit2 size={12} className="text-white" />
          </button>
          {id !== 'root' && (
            <button
              onClick={() => deleteNode(id)}
              className="p-1.5 bg-red-500/30 hover:bg-red-500/50 rounded-full transition-colors backdrop-blur-sm"
            >
              <Trash2 size={12} className="text-red-300" />
            </button>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-white/30 !border-2 !border-white/50 transition-all hover:!bg-white/60"
      />
    </motion.div>
  );
}

export default memo(AnchorNode);
