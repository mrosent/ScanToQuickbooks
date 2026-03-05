/**
 * Stub for html-to-docx when building for React Native.
 * The real html-to-docx requires Node.js built-ins (crypto, fs, util) which
 * are not available in RN. This stub throws so the catch in exportService
 * shows "DOCX export is not supported on this device".
 */
export default function HTMLToDocx(): Promise<never> {
  throw new Error("DOCX export is not supported on this device. Try PDF or RTF instead.");
}
