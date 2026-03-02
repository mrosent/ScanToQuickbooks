import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  exportDocument,
  shareExportedFile,
  EXPORT_FORMATS,
  type ExportFormat,
} from "../lib/exportService";
import type { ScannedDocument } from "../lib/types";

const FORMAT_ICONS: Record<ExportFormat, keyof typeof Ionicons.glyphMap> = {
  pdf: "document-text",
  jpg: "image",
  png: "image",
  docx: "document",
  txt: "document-text-outline",
  md: "code-slash",
  html: "code",
  rtf: "document-outline",
};

export interface ExportModalProps {
  visible: boolean;
  document: ScannedDocument;
  content: string;
  onClose: () => void;
}

export function ExportModal({
  visible,
  document,
  content,
  onClose,
}: ExportModalProps) {
  const handleExport = async (format: ExportFormat) => {
    if (format === "jpg" || format === "png") {
      if (!document.imageUri) {
        Alert.alert("No Image", "This document has no scanned image to export.");
        return;
      }
    }

    try {
      const { uri, mimeType } = await exportDocument(document, content, format);
      await shareExportedFile(uri, mimeType, `Export as ${EXPORT_FORMATS.find((f) => f.format === format)?.label}`);
      onClose();
    } catch (error) {
      Alert.alert(
        "Export Failed",
        error instanceof Error ? error.message : "Could not export document."
      );
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Export Document</Text>
          <Text style={styles.headerSubtitle}>Choose format</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#94a3b8" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {EXPORT_FORMATS.map(({ format, label }) => (
            <ExportFormatButton
              key={format}
              format={format}
              label={label}
              disabled={(format === "jpg" || format === "png") && !document.imageUri}
              onPress={async () => {
                await handleExport(format);
              }}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ExportFormatButton({
  format,
  label,
  disabled,
  onPress,
}: {
  format: ExportFormat;
  label: string;
  disabled: boolean;
  onPress: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (disabled) return;
    setLoading(true);
    try {
      await onPress();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      style={[styles.formatButton, disabled && styles.formatButtonDisabled]}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#38bdf8" />
      ) : (
        <Ionicons
          name={FORMAT_ICONS[format]}
          size={24}
          color={disabled ? "#475569" : "#38bdf8"}
        />
      )}
      <Text style={[styles.formatLabel, disabled && styles.formatLabelDisabled]}>
        {label}
      </Text>
      {!disabled && !loading && (
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f8fafc",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 24,
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  formatButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  formatButtonDisabled: {
    opacity: 0.6,
  },
  formatLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#f8fafc",
    marginLeft: 16,
  },
  formatLabelDisabled: {
    color: "#64748b",
  },
});
