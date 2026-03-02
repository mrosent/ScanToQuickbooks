import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { markdownToHtml } from "./documentFormat";
import type { ScannedDocument } from "./types";

const CACHE_DIR = FileSystem.cacheDirectory ?? "";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_\.]/g, "_").slice(0, 80) || "document";
}

function contentToPlainText(content: string): string {
  if (!content) return "";
  if (content.includes("<") && content.includes(">")) {
    return content
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }
  return content;
}

function buildHtmlForPdf(document: ScannedDocument, content: string): string {
  const html = content.startsWith("<") && content.includes(">") ? content : markdownToHtml(content);
  const title = document.title || "Document";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; line-height: 1.6; }
    h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
    p { margin: 0.5em 0; }
    ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">${document.type.replace("_", " ")} • ${document.detectedLanguage}</p>
  <div class="content">${html}</div>
</body>
</html>`;
}

export type ExportFormat =
  | "pdf"
  | "jpg"
  | "png"
  | "docx"
  | "txt"
  | "md"
  | "html"
  | "rtf";

export const EXPORT_FORMATS: { format: ExportFormat; label: string; mimeType: string }[] = [
  { format: "pdf", label: "PDF", mimeType: "application/pdf" },
  { format: "jpg", label: "JPG Image", mimeType: "image/jpeg" },
  { format: "png", label: "PNG Image", mimeType: "image/png" },
  { format: "docx", label: "Word (DOCX)", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { format: "txt", label: "Plain Text", mimeType: "text/plain" },
  { format: "md", label: "Markdown", mimeType: "text/markdown" },
  { format: "html", label: "HTML", mimeType: "text/html" },
  { format: "rtf", label: "Rich Text (RTF)", mimeType: "application/rtf" },
];

export async function exportDocument(
  document: ScannedDocument,
  content: string,
  format: ExportFormat
): Promise<{ uri: string; mimeType: string }> {
  const baseName = sanitizeFilename(document.title);

  switch (format) {
    case "pdf": {
      const html = buildHtmlForPdf(document, content);
      const { uri } = await Print.printToFileAsync({ html });
      return { uri, mimeType: "application/pdf" };
    }

    case "jpg":
    case "png": {
      if (!document.imageUri) throw new Error("No image to export");
      const ext = format === "jpg" ? "jpg" : "png";
      const destUri = `${CACHE_DIR}${baseName}.${ext}`;
      await FileSystem.copyAsync({ from: document.imageUri, to: destUri });
      return {
        uri: destUri,
        mimeType: format === "jpg" ? "image/jpeg" : "image/png",
      };
    }

    case "docx": {
      try {
        const html = content.startsWith("<") && content.includes(">") ? content : markdownToHtml(content);
        const HTMLToDocx = (await import("html-to-docx")).default;
        const docxResult = await HTMLToDocx(html, null, {
          table: { row: { cantSplit: true } },
          font: "Arial",
          fontSize: "24",
        });
        const buf = docxResult as ArrayBuffer | Uint8Array | { buffer: ArrayBuffer };
        const bytes =
          buf instanceof Uint8Array
            ? buf
            : buf instanceof ArrayBuffer
              ? new Uint8Array(buf)
              : new Uint8Array((buf as { buffer: ArrayBuffer }).buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) {
          const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binary);
        const destUri = `${CACHE_DIR}${baseName}.docx`;
        await FileSystem.writeAsStringAsync(destUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return {
          uri: destUri,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
      } catch {
        throw new Error("DOCX export is not supported on this device. Try PDF or RTF instead.");
      }
    }

    case "txt": {
      const plainText = contentToPlainText(content);
      const destUri = `${CACHE_DIR}${baseName}.txt`;
      await FileSystem.writeAsStringAsync(destUri, plainText);
      return { uri: destUri, mimeType: "text/plain" };
    }

    case "md": {
      const mdContent = content.startsWith("<") ? contentToPlainText(content) : content;
      const destUri = `${CACHE_DIR}${baseName}.md`;
      await FileSystem.writeAsStringAsync(destUri, mdContent);
      return { uri: destUri, mimeType: "text/markdown" };
    }

    case "html": {
      const htmlContent = content.startsWith("<") && content.includes(">") ? content : markdownToHtml(content);
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${document.title}</title></head><body>${htmlContent}</body></html>`;
      const destUri = `${CACHE_DIR}${baseName}.html`;
      await FileSystem.writeAsStringAsync(destUri, fullHtml);
      return { uri: destUri, mimeType: "text/html" };
    }

    case "rtf": {
      const plainText = contentToPlainText(content);
      const escaped = plainText.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
      const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs24 ${escaped.replace(/\n/g, "\\par ")}}`;
      const destUri = `${CACHE_DIR}${baseName}.rtf`;
      await FileSystem.writeAsStringAsync(destUri, rtf);
      return { uri: destUri, mimeType: "application/rtf" };
    }

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

export async function shareExportedFile(uri: string, mimeType: string, dialogTitle?: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error("Sharing is not available");
  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: dialogTitle ?? "Export Document",
    UTI: mimeType === "application/pdf" ? ".pdf" : undefined,
  });
}
