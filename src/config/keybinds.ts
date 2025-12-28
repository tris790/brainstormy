/**
 * Centralized keyboard shortcuts configuration
 * This is the single source of truth for all keybinds in the application
 */

export interface Keybind {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  displayText: string; // How to display in UI (e.g., "Cmd+Shift+P")
}

export const KEYBINDS = {
  // Main application commands
  COMMAND_PALETTE: {
    key: 'k',
    ctrl: true,
    meta: true,
    description: 'Command palette',
    displayText: 'Cmd+K',
  },
  PROJECTS_SIDEBAR: {
    key: 'p',
    ctrl: true,
    meta: true,
    shift: false,
    description: 'Projects sidebar',
    displayText: 'Cmd+P',
  },
  SETTINGS: {
    key: ',',
    ctrl: true,
    meta: true,
    description: 'Open Settings',
    displayText: 'Cmd+,',
  },

  // Edit commands
  UNDO: {
    key: 'z',
    ctrl: true,
    meta: true,
    shift: false,
    description: 'Undo',
    displayText: 'Cmd+Z',
  },
  REDO: {
    key: 'y',
    ctrl: true,
    meta: true,
    description: 'Redo',
    displayText: 'Cmd+Y',
  },

  // View commands
  FIT_VIEW: {
    key: 'f',
    description: 'Fit view',
    displayText: 'F',
  },
  SEARCH_NODES: {
    key: 'f',
    ctrl: true,
    meta: true,
    description: 'Search nodes',
    displayText: 'Cmd+F',
  },

  // Node commands
  EDIT_NODE: {
    key: 'e',
    description: 'Edit node',
    displayText: 'E',
  },
  DELETE_NODE: {
    key: 'Delete', // Also supports 'Backspace'
    description: 'Delete node',
    displayText: 'Del',
  },

  // Navigation
  NAVIGATE_UP: {
    key: 'ArrowUp',
    description: 'Navigate up',
    displayText: 'Arrows',
  },
  NAVIGATE_DOWN: {
    key: 'ArrowDown',
    description: 'Navigate down',
    displayText: 'Arrows',
  },
  NAVIGATE_LEFT: {
    key: 'ArrowLeft',
    description: 'Navigate left',
    displayText: 'Arrows',
  },
  NAVIGATE_RIGHT: {
    key: 'ArrowRight',
    description: 'Navigate right',
    displayText: 'Arrows',
  },

  // Special keys
  QUICK_COMMAND: {
    key: '/',
    description: 'Quick command palette',
    displayText: '/',
  },
  TOGGLE_MODE: {
    key: 'Tab',
    shift: false,
    description: 'Toggle manual mode',
    displayText: 'Tab',
  },
  SWITCH_TO_AUTO: {
    key: 'Tab',
    shift: true,
    description: 'Switch to auto mode',
    displayText: 'Shift+Tab',
  },
  ESCAPE: {
    key: 'Escape',
    description: 'Close/Cancel',
    displayText: 'Esc',
  },
  ENTER: {
    key: 'Enter',
    description: 'Confirm/Add',
    displayText: 'Enter',
  },
} as const;

/**
 * Check if a keyboard event matches a keybind configuration
 */
export function matchesKeybind(event: KeyboardEvent, keybind: Keybind): boolean {
  // Check key match (case-insensitive for letters)
  const keyMatch = event.key.toLowerCase() === keybind.key.toLowerCase();
  if (!keyMatch) return false;

  // Check modifiers - if specified, they must match exactly
  // Ctrl and Meta are treated as equivalent (for cross-platform support)
  const hasCtrlOrMeta = event.ctrlKey || event.metaKey;

  const ctrlMatch = keybind.ctrl === undefined || hasCtrlOrMeta === keybind.ctrl;
  const metaMatch = keybind.meta === undefined || hasCtrlOrMeta === keybind.meta;
  const shiftMatch = keybind.shift === undefined || event.shiftKey === keybind.shift;
  const altMatch = keybind.alt === undefined || event.altKey === keybind.alt;

  return ctrlMatch && metaMatch && shiftMatch && altMatch;
}

/**
 * Get display text for a keybind with Ctrl/Cmd normalized to "Cmd" for consistency
 */
export function getKeybindDisplay(keybind: Keybind): string {
  return keybind.displayText;
}

/**
 * Helper to check if typing in an input element
 */
export function isTypingInInput(): boolean {
  return (
    document.activeElement?.tagName === 'INPUT' ||
    document.activeElement?.tagName === 'TEXTAREA'
  );
}
