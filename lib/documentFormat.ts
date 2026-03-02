import TurndownService from "turndown";
import { marked } from "marked";

const turndown = new TurndownService({ headingStyle: "atx" });
turndown.addRule("strikethrough", {
  filter: ["del", "s", "strike"],
  replacement: (content: string) => `~~${content}~~`,
});

/**
 * Convert HTML from the rich text editor to Markdown for storage.
 * Formatting will be applied when exporting later.
 */
export function htmlToMarkdown(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("<") || !trimmed.includes(">")) return trimmed;
  try {
    return turndown.turndown(trimmed).trim();
  } catch {
    return htmlToPlainText(trimmed);
  }
}

/**
 * Convert Markdown to HTML for loading into the rich text editor.
 */
export function markdownToHtml(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return "<p></p>";
  if (trimmed.startsWith("<") && trimmed.includes(">")) return trimmed;
  try {
    const html = marked(trimmed) as string;
    return html || `<p>${escapeHtml(trimmed)}</p>`;
  } catch {
    return plainTextToHtml(trimmed);
  }
}

/**
 * Convert plain text to HTML (wrap paragraphs).
 */
export function plainTextToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "<p></p>";
  return trimmed
    .split("\n")
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect if content is stored as Markdown (vs legacy HTML or plain text).
 */
export function isMarkdown(content: string): boolean {
  if (!content || content.length < 2) return false;
  if (content.startsWith("<") && content.includes(">")) return false;
  return /^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|\*\*[^*]+\*\*|__[^_]+__|\[.+\]\(.+\)/.test(content);
}
