// Document types detected by AI
export type DocumentType =
  | "passport"
  | "id_card"
  | "driver_license"
  | "receipt"
  | "invoice"
  | "business_card"
  | "prescription"
  | "contract"
  | "certificate"
  | "generic";

// Field with label and value for structured extraction
export interface DocumentField {
  label: string;
  value: string;
}

// Structured document output from OpenAI
export interface ScannedDocument {
  id: string;
  type: DocumentType;
  title: string;
  rawText: string;
  detectedLanguage: string;
  fields: DocumentField[];
  formattedContent: string;
  imageUri: string;
  scannedAt: string;
}

// Stored scan for history
export interface StoredScan {
  id: string;
  document: ScannedDocument;
  createdAt: string;
}
