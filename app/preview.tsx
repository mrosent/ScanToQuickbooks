import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getCurrentScan, setCurrentScan, getEditingStoredId } from "../lib/scanStore";
import { saveScan, updateScan } from "../lib/storage";
import { DocumentEditorModal } from "../components/DocumentEditorModal";
import { ExportModal } from "../components/ExportModal";
import { isMarkdown } from "../lib/documentFormat";
import type { ScannedDocument } from "../lib/types";

function contentForPreview(content: string): string {
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

function toDisplayString(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return JSON.stringify(val);
}

function formatTaggedContent(content: string): string {
  return content
    .replace(/<([a-z_]+)(?:\s+name="([^"]*)")?>/gi, (_, tag, name) => {
      const label = name ? ` [${name}]` : "";
      return `\n▸ ${tag.toUpperCase()}${label}:\n`;
    })
    .replace(/<\/[a-z_]+>/gi, "")
    .replace(/<([a-z_]+)>/gi, (_, tag) => `\n▸ ${tag.toUpperCase()}: `)
    .trim();
}

function DocumentTypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    passport: "book-outline",
    id_card: "card-outline",
    driver_license: "car-outline",
    receipt: "receipt-outline",
    invoice: "document-text-outline",
    business_card: "briefcase-outline",
    prescription: "medical-outline",
    contract: "document-outline",
    certificate: "ribbon-outline",
    generic: "document-outline",
  };
  return (
    <Ionicons
      name={(icons[type] as keyof typeof Ionicons.glyphMap) ?? "document-outline"}
      size={24}
      color="#38bdf8"
    />
  );
}

export default function PreviewScreen() {
  const router = useRouter();
  const [document, setDocument] = useState<ScannedDocument | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingStoredId, setEditingStoredId] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);

  useEffect(() => {
    const scan = getCurrentScan();
    const storedId = getEditingStoredId();
    setDocument(scan);
    setEditingStoredId(storedId);
    if (scan) {
      const formatted = typeof scan.formattedContent === "string" ? scan.formattedContent : "";
      const raw = typeof scan.rawText === "string" ? scan.rawText : "";
      const isEditorFormat =
        formatted.startsWith("<") && /<(p|div|span|strong|em|h[1-6]|ul|ol|li|br)\b/i.test(formatted);
      const isMarkdownContent = isMarkdown(formatted);
      setEditedContent(
        formatted
          ? isEditorFormat || isMarkdownContent
            ? formatted
            : formatTaggedContent(formatted)
          : raw
      );
    } else {
      router.back();
    }
    return () => setCurrentScan(null);
  }, [router]);

  const handleSave = async () => {
    if (!document) return;
    setIsSaving(true);
    try {
      const toSave: ScannedDocument = {
        ...document,
        formattedContent: editedContent,
        rawText: editedContent || document.rawText,
      };
      if (editingStoredId) {
        await updateScan(editingStoredId, toSave);
        Alert.alert("Saved", "Document updated.", [
          { text: "OK", onPress: () => router.replace("/(tabs)/history") },
        ]);
      } else {
        await saveScan({
          id: `stored_${Date.now()}`,
          document: toSave,
          createdAt: new Date().toISOString(),
        });
        Alert.alert("Saved", "Document saved to history.", [
          { text: "OK", onPress: () => router.replace("/(tabs)/history") },
        ]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save document.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => router.back();

  const handleCancel = () => {
    if (editingStoredId) {
      Alert.alert(
        "Discard changes?",
        "Your edits will not be saved.",
        [
          { text: "Keep Editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  if (!document) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ActivityIndicator size="large" color="#38bdf8" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Floating Save + Cancel - always on top */}
      <View style={styles.floatingActions}>
        <Pressable
          style={styles.cancelFloatingButton}
          onPress={handleCancel}
        >
          <Text style={styles.cancelFloatingButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.floatingSaveButton, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <>
              <Ionicons name="save-outline" size={24} color="#0f172a" />
              <Text style={styles.floatingSaveButtonText}>Save to History</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={editingStoredId ? handleCancel : handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </Pressable>
        <View style={styles.headerCenter}>
          <DocumentTypeIcon type={document.type} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {toDisplayString(document.title)}
          </Text>
          <Text style={styles.headerSubtitle}>
            {toDisplayString(document.type).replace("_", " ")} • {toDisplayString(document.detectedLanguage)}
          </Text>
        </View>
        <Pressable onPress={() => setExportVisible(true)} style={styles.exportButton}>
          <Ionicons name="share-outline" size={24} color="#38bdf8" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image thumbnail */}
        <View style={styles.thumbnailSection}>
          <Image
            source={{ uri: document.imageUri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        </View>

        {/* Structured fields */}
        {document.fields.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extracted Data</Text>
            <View style={styles.fieldsGrid}>
              {document.fields.map((field, i) => (
                <View key={i} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{toDisplayString(field?.label)}</Text>
                  <Text style={styles.fieldValue}>{toDisplayString(field?.value)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Formatted content - tap to open professional editor */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Formatted Document</Text>
          <Text style={styles.contentHint}>Tap to open full document editor</Text>
          <Pressable
            style={styles.contentBox}
            onPress={() => setEditorVisible(true)}
          >
            <Text style={styles.contentPreview} numberOfLines={8}>
              {contentForPreview(editedContent) || "No content extracted"}
            </Text>
            <View style={styles.tapToEditRow}>
              <Ionicons name="create-outline" size={18} color="#64748b" />
              <Text style={styles.tapToEditText}>Tap to edit with formatting</Text>
            </View>
          </Pressable>
        </View>

        <ExportModal
          visible={exportVisible}
          document={document}
          content={editedContent}
          onClose={() => setExportVisible(false)}
        />

        {editorVisible && (
          <DocumentEditorModal
            visible
            content={editedContent}
            onSave={(html) => {
              setEditedContent(html);
              setEditorVisible(false);
            }}
            onCancel={() => setEditorVisible(false)}
          />
        )}

        {/* Raw text (collapsed by default) */}
        {document.rawText && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Raw Text</Text>
            <View style={styles.rawTextBox}>
              <Text style={styles.rawText}>{toDisplayString(document.rawText)}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    zIndex: 100,
    backgroundColor: "#0f172a",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  exportButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerRight: {
    width: 40,
  },
  floatingActions: {
    position: "absolute",
    top: 60,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 1000,
    elevation: 10,
  },
  cancelFloatingButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  cancelFloatingButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#94a3b8",
  },
  floatingSaveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#38bdf8",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingSaveButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 100,
    paddingBottom: 40,
  },
  thumbnailSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  thumbnail: {
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: "#1e293b",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  contentHint: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
  fieldsGrid: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  fieldLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f8fafc",
  },
  contentBox: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    minHeight: 160,
    padding: 16,
  },
  contentPreview: {
    fontSize: 14,
    color: "#e2e8f0",
    lineHeight: 22,
  },
  tapToEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  tapToEditText: {
    fontSize: 13,
    color: "#64748b",
  },
  rawTextBox: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  rawText: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
