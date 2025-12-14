import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Trash2, Edit2, Check, X } from 'lucide-react';
import type { BrainstormNode } from '../../types';
import { useGraphStore } from '../../store/graphStore';
import { KEYBINDS, matchesKeybind } from '../../config/keybinds';

interface SatelliteNodeProps {
  data: BrainstormNode['data'];
  id: string;
  selected: boolean;
}

function SatelliteNode({ data, id, selected }: SatelliteNodeProps) {
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
      initial={{ scale: 0.8, opacity: 0, x: -20 }}
      animate={{ scale: 1, opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`
        relative px-4 py-2 rounded-lg min-w-[140px] max-w-[250px]
        backdrop-blur-md bg-white/5
        border transition-all duration-200 group
        ${selected ? 'border-white/40 bg-white/10' : 'border-white/10'}
        hover:border-white/30 hover:bg-white/10
      `}
      style={{
        borderLeftColor: data.color || '#636ef1',
        borderLeftWidth: '3px',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-transparent !border-0"
      />

      {/* Label */}
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-white/10 text-white/90 text-sm rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-white/30 flex-1 min-w-0"
          />
          <button
            onClick={handleSave}
            className="p-1 hover:bg-white/20 rounded transition-colors cursor-pointer"
          >
            <Check size={12} className="text-green-400" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-white/20 rounded transition-colors cursor-pointer"
          >
            <X size={12} className="text-red-400" />
          </button>
        </div>
      ) : (
        <div className="text-white/90 text-sm leading-tight break-words">
          {data.label}
        </div>
      )}

      {/* Actions */}
      {!isEditing && (
        <div className="absolute -top-1.5 -right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditingNodeId(id)}
            className="p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-sm cursor-pointer"
          >
            <Edit2 size={10} className="text-white" />
          </button>
          <button
            onClick={() => deleteNode(id)}
            className="p-1 bg-red-500/30 hover:bg-red-500/50 rounded-full transition-colors backdrop-blur-sm cursor-pointer"
          >
            <Trash2 size={10} className="text-red-300" />
          </button>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-transparent !border-0"
      />
    </motion.div>
  );
}

export default memo(SatelliteNode);
