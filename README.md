# Scanner Vibe

A React Native + Expo document scanner with **OpenAI-powered text extraction** and smart document type detection.

## Tech Stack

- **Expo SDK 54**
- **React Native** with Expo Router
- **OpenAI GPT-4 Vision** for document analysis
- **TypeScript**

## Features

### Dashboard
- **Camera** – Capture documents
- **Upload** – Pick from photo library
- **Extract Text with AI** – Multi-language OCR powered by GPT-4 Vision
- Document type detection (passport, ID, receipt, invoice, etc.)

### Document Types Supported
- Passport (structured fields)
- ID Card / Driver License
- Receipt
- Invoice
- Business Card
- Prescription
- Contract
- Certificate
- Generic documents

### Preview
- View extracted text and structured fields
- Edit content before saving
- Formatted output based on document type
- Raw text view

### History
- Saved scans with thumbnails
- Pull to refresh
- Long-press to delete

## Setup

### 1. API Key

Copy `.env.example` to `.env` and add your OpenAI API key:

```
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-key-here
```

**Security Note:** For production, use a backend proxy instead of storing the API key in the app.

### 2. Run

```bash
npm install
npx expo start
```

- **i** – iOS simulator  
- **a** – Android emulator  
- Scan QR code with Expo Go on device

## Project Structure

```
app/
  (tabs)/
    dashboard.tsx   # Scan / upload / extract
    history.tsx    # Saved documents
  preview.tsx      # Document preview & save
lib/
  scanService.ts   # OpenAI Vision API
  storage.ts       # AsyncStorage + file persistence
  scanStore.ts     # In-memory scan state
  types.ts         # Document types
```
