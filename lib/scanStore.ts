import type { ScannedDocument } from "./types";

let currentScan: ScannedDocument | null = null;
let editingStoredId: string | null = null;

export function setCurrentScan(doc: ScannedDocument | null, storedId?: string) {
  currentScan = doc;
  editingStoredId = storedId ?? null;
}

export function getCurrentScan(): ScannedDocument | null {
  return currentScan;
}

export function getEditingStoredId(): string | null {
  return editingStoredId;
}
