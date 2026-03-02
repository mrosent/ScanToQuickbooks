import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import {
  encryptDocument,
  decryptDocument,
  lockedDocumentMeta,
} from "./lockStorage";
import type { StoredScan } from "./types";

const SCANS_KEY = "@scanner_vibe_scans";

export async function getStoredScans(): Promise<StoredScan[]> {
  try {
    const data = await AsyncStorage.getItem(SCANS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveScan(scan: StoredScan): Promise<void> {
  const scans = await getStoredScans();
  let document = scan.document;
  if (document.imageUri && document.imageUri.startsWith("file://")) {
    try {
      const ext = document.imageUri.includes(".png") ? "png" : "jpg";
      const destUri = `${FileSystem.documentDirectory}scans/${document.id}.${ext}`;
      const dir = `${FileSystem.documentDirectory}scans`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      await FileSystem.copyAsync({ from: document.imageUri, to: destUri });
      document = { ...document, imageUri: destUri };
    } catch {
      // Keep original URI if copy fails
    }
  }
  scans.unshift({ ...scan, document });
  await AsyncStorage.setItem(SCANS_KEY, JSON.stringify(scans));
}

export async function updateScan(id: string, document: StoredScan["document"]): Promise<void> {
  const scans = await getStoredScans();
  const idx = scans.findIndex((s) => s.id === id);
  if (idx < 0) return;
  let doc = document;
  if (doc.imageUri && doc.imageUri.startsWith("file://")) {
    try {
      const ext = doc.imageUri.includes(".png") ? "png" : "jpg";
      const destUri = `${FileSystem.documentDirectory}scans/${doc.id}.${ext}`;
      const dir = `${FileSystem.documentDirectory}scans`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      await FileSystem.copyAsync({ from: doc.imageUri, to: destUri });
      doc = { ...doc, imageUri: destUri };
    } catch {
      // Keep original URI if copy fails
    }
  }
  const existing = scans[idx];
  scans[idx] = { ...existing, document: doc };
  await AsyncStorage.setItem(SCANS_KEY, JSON.stringify(scans));
}

export async function deleteScan(id: string): Promise<void> {
  const scans = await getStoredScans();
  const filtered = scans.filter((s) => s.id !== id);
  await AsyncStorage.setItem(SCANS_KEY, JSON.stringify(filtered));
}

/** Lock one or more scans with a PIN. Returns true if all succeeded. */
export async function lockScans(ids: string[], pin: string): Promise<boolean> {
  const scans = await getStoredScans();
  const updated = [...scans];
  for (const id of ids) {
    const idx = updated.findIndex((s) => s.id === id);
    if (idx < 0 || updated[idx].isLocked) continue;
    const scan = updated[idx];
    const { encryptedPayload, salt } = await encryptDocument(scan.document, pin);
    updated[idx] = {
      id: scan.id,
      createdAt: scan.createdAt,
      isLocked: true,
      encryptedPayload,
      lockSalt: salt,
      document: lockedDocumentMeta(scan.document),
    };
  }
  await AsyncStorage.setItem(SCANS_KEY, JSON.stringify(updated));
  return true;
}

/** Unlock a scan with PIN. Returns the full StoredScan or null if PIN is wrong. */
export async function unlockScan(id: string, pin: string): Promise<StoredScan | null> {
  const scans = await getStoredScans();
  const idx = scans.findIndex((s) => s.id === id);
  if (idx < 0 || !scans[idx].isLocked || !scans[idx].encryptedPayload || !scans[idx].lockSalt) {
    return null;
  }
  const doc = await decryptDocument(
    scans[idx].encryptedPayload!,
    scans[idx].lockSalt!,
    pin
  );
  if (!doc) return null;
  const updated = [...scans];
  updated[idx] = {
    id: scans[idx].id,
    document: doc,
    createdAt: scans[idx].createdAt,
  };
  await AsyncStorage.setItem(SCANS_KEY, JSON.stringify(updated));
  return updated[idx];
}

/** Remove PIN protection from a scan (requires correct PIN). */
export async function removeLock(id: string, pin: string): Promise<boolean> {
  const unlocked = await unlockScan(id, pin);
  return unlocked !== null;
}
