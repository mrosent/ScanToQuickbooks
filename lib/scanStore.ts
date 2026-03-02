import type { ScannedDocument } from "./types";

let currentScan: ScannedDocument | null = null;

export function setCurrentScan(doc: ScannedDocument | null) {
  currentScan = doc;
}

export function getCurrentScan(): ScannedDocument | null {
  return currentScan;
}
