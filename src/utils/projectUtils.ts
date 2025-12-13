import type { BrainstormNode, BrainstormEdge } from '../types';

/**
 * Generate a unique project ID
 * Format: "proj-{timestamp}-{random}"
 */
export function generateProjectId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a content hash for duplicate detection
 * Uses SHA-256 to hash the semantic content of the graph (excluding positions, colors, timestamps)
 */
export async function generateContentHash(
  nodes: BrainstormNode[],
  edges: BrainstormEdge[]
): Promise<string> {
  // Normalize data to focus on semantic content only
  const normalized = {
    nodes: nodes
      .map((n) => ({
        id: n.id,
        label: n.data.label,
        parentId: n.data.parentId,
        isAnchor: n.data.isAnchor,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges
      .map((e) => ({
        source: e.source,
        target: e.target,
      }))
      .sort((a, b) =>
        `${a.source}-${a.target}`.localeCompare(`${b.source}-${b.target}`)
      ),
  };

  // Generate SHA-256 hash using Web Crypto API
  const msgUint8 = new TextEncoder().encode(JSON.stringify(normalized));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format a timestamp as a relative time string
 * Examples: "Just now", "2m ago", "1h ago", "Yesterday", "Jan 15"
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;

  // For older dates, show the date
  const date = new Date(timestamp);
  const thisYear = new Date().getFullYear();
  const dateYear = date.getFullYear();

  if (dateYear === thisYear) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

/**
 * Get the current size of localStorage in bytes
 */
export function getStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += key.length + (localStorage.getItem(key)?.length || 0);
    }
  }
  return total;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Storage size thresholds
 */
export const STORAGE_WARNING_THRESHOLD = 4 * 1024 * 1024; // 4MB
export const STORAGE_MAX_THRESHOLD = 8 * 1024 * 1024; // 8MB
export const MAX_PROJECTS = 50;
