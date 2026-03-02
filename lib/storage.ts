import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
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

export async function deleteScan(id: string): Promise<void> {
  const scans = await getStoredScans();
  const filtered = scans.filter((s) => s.id !== id);
  await AsyncStorage.setItem(SCANS_KEY, JSON.stringify(filtered));
}
