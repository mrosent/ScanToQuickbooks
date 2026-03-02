import { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  RichText,
  Toolbar,
  useEditorBridge,
  defaultEditorTheme,
} from "@10play/tentap-editor";
import { htmlToMarkdown, markdownToHtml } from "../lib/documentFormat";

function toEditorContent(content: string): string {
  return markdownToHtml(content);
}

export interface DocumentEditorModalProps {
  visible: boolean;
  content: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export function DocumentEditorModal({
  visible,
  content,
  onSave,
  onCancel,
}: DocumentEditorModalProps) {
  const initialContent = toEditorContent(content);

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent,
    theme: defaultEditorTheme,
  });

  const handleSave = useCallback(async () => {
    try {
      const html = await editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onSave(markdown);
    } catch {
      onSave(content);
    }
  }, [editor, onSave, content]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header with Cancel and Save */}
          <View style={styles.header}>
            <Pressable onPress={onCancel} style={[styles.headerButton, styles.headerButtonLeft]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Edit Document</Text>
            <Pressable onPress={handleSave} style={[styles.headerButton, styles.headerButtonRight]}>
              <Ionicons name="checkmark" size={22} color="#38bdf8" />
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>

          {/* Rich text editor */}
          <View style={styles.editorContainer}>
            <RichText editor={editor} />
          </View>

          {/* Toolbar at bottom */}
          <View style={styles.toolbarWrapper}>
            <Toolbar editor={editor} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  headerButtonLeft: {
    justifyContent: "flex-start",
  },
  headerButtonRight: {
    justifyContent: "flex-end",
  },
  cancelText: {
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "500",
  },
  saveText: {
    fontSize: 16,
    color: "#38bdf8",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f8fafc",
  },
  editorContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  toolbarWrapper: {
    backgroundColor: "#0f172a",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
});
