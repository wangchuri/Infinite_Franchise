/**
 * Immutable editing helpers for a WorldLayout block tree.
 * Blocks nest via `slots` (e.g. columns → left/main/right).
 */
import type { Block } from "./world-layout";

export function findBlock(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.slots) {
      for (const arr of Object.values(b.slots)) {
        const found = findBlock(arr, id);
        if (found) return found;
      }
    }
  }
  return null;
}

/** The array that directly contains `id` (top-level or a slot array). */
export function findContainer(blocks: Block[], id: string): Block[] | null {
  if (blocks.some((b) => b.id === id)) return blocks;
  for (const b of blocks) {
    if (b.slots) {
      for (const arr of Object.values(b.slots)) {
        const c = findContainer(arr, id);
        if (c) return c;
      }
    }
  }
  return null;
}

export function updateBlock(
  blocks: Block[],
  id: string,
  fn: (block: Block) => Block,
): Block[] {
  return blocks.map((b) => {
    if (b.id === id) return fn(b);
    if (b.slots) {
      const slots: Record<string, Block[]> = {};
      for (const [k, arr] of Object.entries(b.slots)) {
        slots[k] = updateBlock(arr, id, fn);
      }
      return { ...b, slots };
    }
    return b;
  });
}

export function setBlockProps(
  blocks: Block[],
  id: string,
  patch: Record<string, unknown>,
): Block[] {
  return updateBlock(blocks, id, (b) => ({
    ...b,
    props: { ...(b.props ?? {}), ...patch },
  }));
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => {
      if (!b.slots) return b;
      const slots: Record<string, Block[]> = {};
      for (const [k, arr] of Object.entries(b.slots)) {
        slots[k] = removeBlock(arr, id);
      }
      return { ...b, slots };
    });
}

function swap(arr: Block[], i: number, dir: -1 | 1): Block[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function moveBlock(blocks: Block[], id: string, dir: -1 | 1): Block[] {
  const topIdx = blocks.findIndex((b) => b.id === id);
  if (topIdx >= 0) return swap(blocks, topIdx, dir);

  return blocks.map((b) => {
    if (!b.slots) return b;
    const slots: Record<string, Block[]> = {};
    let changed = false;
    for (const [k, arr] of Object.entries(b.slots)) {
      const i = arr.findIndex((x) => x.id === id);
      if (!changed && i >= 0) {
        slots[k] = swap(arr, i, dir);
        changed = true;
      } else {
        slots[k] = arr;
      }
    }
    return changed ? { ...b, slots } : b;
  });
}

export function addBlockToSlot(
  blocks: Block[],
  parentId: string,
  slotKey: string,
  block: Block,
): Block[] {
  return blocks.map((b) => {
    if (b.id === parentId) {
      const slots = { ...(b.slots ?? {}) };
      slots[slotKey] = [...(slots[slotKey] ?? []), block];
      return { ...b, slots };
    }
    if (b.slots) {
      const slots: Record<string, Block[]> = {};
      for (const [k, arr] of Object.entries(b.slots)) {
        slots[k] = addBlockToSlot(arr, parentId, slotKey, block);
      }
      return { ...b, slots };
    }
    return b;
  });
}

function collectIds(block: Block, out: Set<string>): void {
  out.add(block.id);
  if (block.slots) {
    for (const arr of Object.values(block.slots)) {
      for (const child of arr) collectIds(child, out);
    }
  }
}

/** Immutably replace the array that directly contains `childId` with `next`. */
function replaceList(blocks: Block[], childId: string, next: Block[]): Block[] {
  if (blocks.some((b) => b.id === childId)) return next;
  return blocks.map((b) => {
    if (!b.slots) return b;
    const slots: Record<string, Block[]> = {};
    for (const [k, arr] of Object.entries(b.slots)) {
      slots[k] = replaceList(arr, childId, next);
    }
    return { ...b, slots };
  });
}

/**
 * Move `dragId` next to `targetId` (before/after), across slots and levels.
 * Drops into the dragged block's own subtree are ignored.
 */
export function moveBlockTo(
  blocks: Block[],
  dragId: string,
  targetId: string,
  position: "before" | "after",
): Block[] {
  if (dragId === targetId) return blocks;
  const dragged = findBlock(blocks, dragId);
  if (!dragged) return blocks;
  const subtree = new Set<string>();
  collectIds(dragged, subtree);
  if (subtree.has(targetId)) return blocks;

  const without = removeBlock(blocks, dragId);
  const list = findContainer(without, targetId);
  if (!list) return blocks;
  const idx = list.findIndex((b) => b.id === targetId);
  if (idx < 0) return blocks;
  const next = [...list];
  next.splice(position === "before" ? idx : idx + 1, 0, dragged);
  return replaceList(without, targetId, next);
}

export function newBlockId(type: string): string {
  return `${type}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** Insert a block into a flat list at `index` (clamped). */
export function insertBlockAt(
  blocks: Block[],
  index: number,
  block: Block,
): Block[] {
  const next = [...blocks];
  const at = Math.max(0, Math.min(index, next.length));
  next.splice(at, 0, block);
  return next;
}

/** Duplicate a block in a flat list, inserting the copy right after it. */
export function duplicateBlock(
  blocks: Block[],
  id: string,
  newId: string,
): Block[] {
  const index = blocks.findIndex((b) => b.id === id);
  if (index < 0) return blocks;
  const src = blocks[index];
  const copy: Block = {
    ...src,
    id: newId,
    props: src.props ? { ...src.props } : undefined,
  };
  const next = [...blocks];
  next.splice(index + 1, 0, copy);
  return next;
}

/** Move a block to an insertion index in a flat list (drop-zone semantics). */
export function moveBlockToIndex(
  blocks: Block[],
  id: string,
  index: number,
): Block[] {
  const from = blocks.findIndex((b) => b.id === id);
  if (from < 0) return blocks;
  const next = [...blocks];
  const [block] = next.splice(from, 1);
  const at = Math.max(0, Math.min(from < index ? index - 1 : index, next.length));
  next.splice(at, 0, block);
  return next;
}
