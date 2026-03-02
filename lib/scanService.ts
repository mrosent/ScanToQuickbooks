import OpenAI from "openai";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import type { ScannedDocument } from "./types";

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

For INVOICE: Extract invoice number, vendor, date, line items, amounts, totals, due date. Use <invoice> structure.

For BUSINESS CARD: Extract name, title, company, phone, email, address. Use <business_card> with <contact> fields.

For PRESCRIPTION: Extract patient name, medication, dosage, doctor, date. Use <prescription> tags.

For CONTRACT: Extract parties, dates, key terms, signatures. Use <contract> structure.

For CERTIFICATE: Extract recipient, issuing authority, date, credential type.

For GENERIC: Use <document> with <section> and <paragraph> tags preserving structure.

Always include:
- detectedLanguage: ISO 639-1 code (e.g. en, es, zh, ar)
- rawText: full extracted text preserving line breaks
- fields: array of {label, value} for key-value pairs
- formattedContent: the tagged XML/HTML-like structured output

Respond with valid JSON only, no markdown.`;

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

export async function scanDocumentWithAI(imageUri: string): Promise<ScannedDocument | null> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured. Add EXPO_PUBLIC_OPENAI_API_KEY to .env");
  }

  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const mimeType = imageUri.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";
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
            image_url: { url: base64Image },
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
    const doc: ScannedDocument = {
      ...parsed,
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      imageUri,
      scannedAt: new Date().toISOString(),
      title: parsed.title || `Document - ${parsed.type}`,
      fields: Array.isArray(parsed.fields) ? parsed.fields : [],
      rawText: parsed.rawText || "",
      detectedLanguage: parsed.detectedLanguage || "unknown",
      formattedContent: parsed.formattedContent || parsed.rawText || "",
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
