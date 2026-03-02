import { Image } from "react-native";
import OpenAI from "openai";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import Constants from "expo-constants";
import type { ScannedDocument } from "./types";

const MAX_IMAGE_HEIGHT = 4000;

const OPENAI_API_KEY =
  Constants.expoConfig?.extra?.openaiApiKey ??
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_OPENAI_API_KEY) ??
  "";

const DOCUMENT_SYSTEM_PROMPT = `You are an expert document analyzer and OCR system. Your task is to:
1. Extract ALL visible text from the image in its ORIGINAL language (support 100+ languages: Latin, Cyrillic, Arabic, Chinese, Japanese, Korean, etc.)
2. Detect the document type from: passport, id_card, driver_license, receipt, invoice, business_card, prescription, contract, certificate, or generic
3. Structure the output based on document type with appropriate semantic tags

For PASSPORT: Extract Type, Country Code, Surname, Given Names, Nationality, Date of Birth, Sex, Place of Birth, Date of Issue, Date of Expiry, Authority, Document Number, MRZ lines. Use <passport> wrapper with <field name="...">value</field> tags.

For ID CARD / DRIVER LICENSE: Extract Name, ID Number, Date of Birth, Address, Issue/Expiry dates, Photo info. Use <id_document> with structured fields.

For RECEIPT: Extract merchant, date, items with prices, subtotal, tax, total, payment method. Use <receipt> with <line_item>, <total> etc.
CRITICAL for receipts: Prices and numbers must be EXACT. Double-check every digit. Watch for: 0 vs O, 1 vs l, 5 vs S, decimal points, currency symbols. Preserve exact formatting (e.g. 1.99 not 199).

For INVOICE: Extract invoice number, vendor, date, line items, amounts, totals, due date. Use <invoice> structure.

For BUSINESS CARD: Extract name, title, company, phone, email, address. Use <business_card> with <contact> fields.

For PRESCRIPTION: Extract patient name, medication, dosage, doctor, date. Use <prescription> tags.

For CONTRACT: Extract parties, dates, key terms, signatures. Use <contract> structure.

For CERTIFICATE: Extract recipient, issuing authority, date, credential type.

For GENERIC: Use <document> with <section> and <paragraph> tags preserving structure.

ACCURACY: For any document with prices, amounts, or numbers, transcribe them character-for-character. Do not guess or approximate.

Always include:
- detectedLanguage: ISO 639-1 code (e.g. en, es, zh, ar)
- rawText: full extracted text preserving line breaks
- fields: array of {label, value} for key-value pairs
- formattedContent: the tagged XML/HTML-like structured output

Respond with valid JSON only, no markdown.`;

const MULTI_PAGE_PROMPT = `These images are overlapping photos of a receipt or document, captured from TOP to BOTTOM in sequence. Each image overlaps with the next.

Your task: Extract the COMPLETE document as ONE continuous output. Merge overlapping sections intelligently:
- Do NOT duplicate any line, item, or content that appears in multiple images
- Do NOT omit any unique content
- Output a single seamless document with each line appearing exactly once
- Preserve the correct top-to-bottom order

Use the same output format as single-document extraction. Return valid JSON with: type, title, rawText, detectedLanguage, fields (array of {label, value}), formattedContent.`;

/** Converts OpenAI/API errors into user-friendly messages. */
export function getFriendlyErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/429|quota|exceeded|billing|plan/i.test(msg)) {
    return "You've exceeded your OpenAI usage limit. Check your plan and billing at platform.openai.com";
  }
  if (/401|invalid.*api.*key|unauthorized/i.test(msg)) {
    return "Invalid API key. Add EXPO_PUBLIC_OPENAI_API_KEY to your .env file.";
  }
  if (/503|rate limit|too many requests/i.test(msg)) {
    return "OpenAI is busy. Please try again in a moment.";
  }
  if (/network|fetch|connection|timeout/i.test(msg)) {
    return "Connection failed. Check your internet and try again.";
  }
  return "Failed to analyze document. Check your API key and connection.";
}

async function ensureImageSize(imageUri: string): Promise<string> {
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(imageUri, (w, h) => resolve({ width: w, height: h }), reject);
  });
  if (height <= MAX_IMAGE_HEIGHT) return imageUri;
  const scale = MAX_IMAGE_HEIGHT / height;
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: Math.round(width * scale), height: MAX_IMAGE_HEIGHT } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function scanDocumentWithAI(imageUri: string): Promise<ScannedDocument | null> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured. Add EXPO_PUBLIC_OPENAI_API_KEY to .env");
  }

  const uriToUse = await ensureImageSize(imageUri);

  const base64 = await FileSystem.readAsStringAsync(uriToUse, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const mimeType = uriToUse.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";
  const base64Image = `data:${mimeType};base64,${base64}`;

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: DOCUMENT_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract and structure all text from this document. Support any language. Return valid JSON with: type, title, rawText, detectedLanguage, fields (array of {label, value}), formattedContent.",
          },
          {
            type: "image_url",
            image_url: { url: base64Image, detail: "high" as const },
          },
        ],
      },
    ],
  });

  let content = response.choices[0]?.message?.content?.trim();
  if (!content) return null;

  // Strip markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) content = jsonMatch[1].trim();

  try {
    const parsed = JSON.parse(content) as Omit<ScannedDocument, "id" | "imageUri" | "scannedAt">;
    const rawFields = Array.isArray(parsed.fields) ? parsed.fields : [];
    const fields = rawFields.map((f: unknown) => {
      const item = f && typeof f === "object" ? (f as Record<string, unknown>) : {};
      const label = item.label;
      const value = item.value;
      return {
        label: typeof label === "string" ? label : String(label ?? ""),
        value: typeof value === "string" ? value : String(value ?? ""),
      };
    });
    const doc: ScannedDocument = {
      ...parsed,
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      imageUri,
      scannedAt: new Date().toISOString(),
      title: typeof parsed.title === "string" ? parsed.title : `Document - ${parsed.type}`,
      fields,
      rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
      detectedLanguage: typeof parsed.detectedLanguage === "string" ? parsed.detectedLanguage : "unknown",
      formattedContent: typeof parsed.formattedContent === "string" ? parsed.formattedContent : (typeof parsed.rawText === "string" ? parsed.rawText : ""),
    };
    return doc;
  } catch {
    return {
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: "generic",
      title: "Scanned Document",
      rawText: content,
      detectedLanguage: "unknown",
      fields: [],
      formattedContent: content,
      imageUri,
      scannedAt: new Date().toISOString(),
    };
  }
}

/**
 * Sends all overlapping photos to the AI for content-level merge.
 * No image stitching - the AI merges overlapping content and returns one continuous document.
 */
export async function scanMultiPageReceipt(
  imageUris: string[]
): Promise<ScannedDocument | null> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured. Add EXPO_PUBLIC_OPENAI_API_KEY to .env");
  }
  if (imageUris.length === 0) return null;

  const urisToUse = await Promise.all(imageUris.map(ensureImageSize));
  const base64Images = await Promise.all(
    urisToUse.map((uri) =>
      FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
    )
  );

  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }> = [
    { type: "text", text: "Extract and merge all content from these overlapping photos into one continuous document. No duplicates, no omissions. Return valid JSON with: type, title, rawText, detectedLanguage, fields (array of {label, value}), formattedContent." },
  ];
  for (const base64 of base64Images) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" },
    });
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4096,
    messages: [
      { role: "system", content: DOCUMENT_SYSTEM_PROMPT + "\n\n" + MULTI_PAGE_PROMPT },
      { role: "user", content },
    ],
  });

  let responseContent = response.choices[0]?.message?.content?.trim();
  if (!responseContent) return null;

  const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) responseContent = jsonMatch[1].trim();

  try {
    const parsed = JSON.parse(responseContent) as Omit<ScannedDocument, "id" | "imageUri" | "scannedAt">;
    const rawFields = Array.isArray(parsed.fields) ? parsed.fields : [];
    const fields = rawFields.map((f: unknown) => {
      const item = f && typeof f === "object" ? (f as Record<string, unknown>) : {};
      return {
        label: typeof item.label === "string" ? item.label : String(item.label ?? ""),
        value: typeof item.value === "string" ? item.value : String(item.value ?? ""),
      };
    });
    return {
      ...parsed,
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      imageUri: imageUris[0],
      scannedAt: new Date().toISOString(),
      title: typeof parsed.title === "string" ? parsed.title : `Document - ${parsed.type}`,
      fields,
      rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
      detectedLanguage: typeof parsed.detectedLanguage === "string" ? parsed.detectedLanguage : "unknown",
      formattedContent: typeof parsed.formattedContent === "string" ? parsed.formattedContent : (typeof parsed.rawText === "string" ? parsed.rawText : ""),
    };
  } catch {
    return {
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: "generic",
      title: "Scanned Document",
      rawText: responseContent,
      detectedLanguage: "unknown",
      fields: [],
      formattedContent: responseContent,
      imageUri: imageUris[0],
      scannedAt: new Date().toISOString(),
    };
  }
}
