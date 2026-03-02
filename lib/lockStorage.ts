import CryptoJS from "crypto-js";
import type { ScannedDocument } from "./types";

const LOCK_ITERATIONS = 10000;

/** Derive AES key from PIN and salt using PBKDF2 */
function deriveKey(pin: string, saltBase64: string): string {
  const salt = CryptoJS.enc.Base64.parse(saltBase64);
  const key = CryptoJS.PBKDF2(pin, salt, {
    keySize: 256 / 32,
    hasher: CryptoJS.algo.SHA256,
    iterations: LOCK_ITERATIONS,
  });
  return key.toString(CryptoJS.enc.Hex);
}

/** Get 32 random bytes for salt. Uses CryptoJS (no native crypto) for Expo Go / web compatibility. */
function getRandomSaltBase64(): string {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Base64);
}

/** Encrypt document JSON with PIN-derived key */
export async function encryptDocument(
  document: ScannedDocument,
  pin: string
): Promise<{ encryptedPayload: string; salt: string }> {
  const saltBase64 = getRandomSaltBase64();
  const keyHex = deriveKey(pin, saltBase64);
  const plaintext = JSON.stringify(document);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, CryptoJS.enc.Hex.parse(keyHex), {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
    iv,
  });
  const ivB64 = iv.toString(CryptoJS.enc.Base64);
  const cipherB64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
  const combined = ivB64 + ":" + cipherB64;
  return { encryptedPayload: combined, salt: saltBase64 };
}

/** Decrypt document with PIN */
export async function decryptDocument(
  encryptedPayload: string,
  saltBase64: string,
  pin: string
): Promise<ScannedDocument | null> {
  try {
    const keyHex = deriveKey(pin, saltBase64);
    const parts = encryptedPayload.split(":");
    const [ivB64, cipherB64] = parts;
    if (!ivB64 || !cipherB64) return null;
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const iv = CryptoJS.enc.Base64.parse(ivB64);
    const ciphertext = CryptoJS.enc.Base64.parse(cipherB64);
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const str = decrypted.toString(CryptoJS.enc.Utf8);
    if (!str) return null;
    return JSON.parse(str) as ScannedDocument;
  } catch {
    return null;
  }
}

/** Create minimal document metadata for locked display (no sensitive content) */
export function lockedDocumentMeta(doc: ScannedDocument): ScannedDocument {
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    rawText: "",
    detectedLanguage: doc.detectedLanguage,
    fields: [],
    formattedContent: "",
    imageUri: "", // Don't show thumbnail for locked docs
    scannedAt: doc.scannedAt,
  };
}
