import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getStoredScans, deleteScan, lockScans, unlockScan, removeLock } from "../../lib/storage";
import { setCurrentScan } from "../../lib/scanStore";
import { ExportModal } from "../../components/ExportModal";
import { PinModal } from "../../components/PinModal";
import { isMarkdown } from "../../lib/documentFormat";
import type { StoredScan } from "../../lib/types";

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

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diff < 172800000) return `Yesterday, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ScanItemCard({
  item,
  onPress,
  selected,
  selectingMode,
  onToggleSelect,
}: {
  item: StoredScan;
  onPress: () => void;
  selected?: boolean;
  selectingMode?: boolean;
  onToggleSelect?: () => void;
}) {
  const doc = item.document;
  const isLocked = item.isLocked === true;
  return (
    <Pressable
      style={[styles.scanCard, selected && styles.scanCardSelected]}
      onPress={selectingMode ? onToggleSelect : onPress}
    >
      {selectingMode && (
        <View style={styles.selectWrap}>
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Ionicons name="checkmark" size={16} color="#0f172a" />}
          </View>
        </View>
      )}
      {doc.imageUri && !isLocked ? (
        <Image
          source={{ uri: doc.imageUri }}
          style={styles.scanCardThumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.scanCardThumbnailPlaceholder}>
          <Ionicons
            name={isLocked ? "lock-closed" : "document-text"}
            size={28}
            color={isLocked ? "#f59e0b" : "#64748b"}
          />
        </View>
      )}
      <View style={styles.scanCardContent}>
        <View style={styles.scanCardTitleRow}>
          <Text style={styles.scanCardTitle} numberOfLines={1}>
            {doc.title}
          </Text>
          {isLocked && (
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={10} color="#f59e0b" />
              <Text style={styles.lockedBadgeText}>Locked</Text>
            </View>
          )}
        </View>
        <Text style={styles.scanCardDate}>{formatDate(item.createdAt)}</Text>
        <View style={styles.scanCardMeta}>
          <Text style={styles.scanCardMetaText}>
            {doc.type.replace("_", " ")} • {doc.fields?.length ?? 0} fields
          </Text>
        </View>
      </View>
      {!selectingMode && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color="#64748b"
          style={styles.scanCardChevron}
        />
      )}
    </Pressable>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [scans, setScans] = useState<StoredScan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exportItem, setExportItem] = useState<StoredScan | null>(null);
  const [selectingMode, setSelectingMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pinModal, setPinModal] = useState<{
    visible: boolean;
    mode: "lock" | "unlock";
    ids: string[];
    item?: StoredScan;
    removeLockOnly?: boolean;
  }>({ visible: false, mode: "lock", ids: [] });

  const loadScans = useCallback(async () => {
    const data = await getStoredScans();
    setScans(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadScans();
    }, [loadScans])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadScans();
    setRefreshing(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLockSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const unlockable = ids.filter((id) => scans.find((s) => s.id === id)?.isLocked);
    if (unlockable.length > 0) {
      Alert.alert("Cannot lock", "Some selected documents are already locked. Unlock them first.");
      return;
    }
    setPinModal({ visible: true, mode: "lock", ids });
  };

  const handlePinConfirm = async (pin: string) => {
    if (pinModal.mode === "lock") {
      await lockScans(pinModal.ids, pin);
      setSelectingMode(false);
      setSelectedIds(new Set());
      loadScans();
    } else {
      const item = pinModal.item;
      if (!item) return;
      if (pinModal.removeLockOnly) {
        const ok = await removeLock(item.id, pin);
        if (!ok) throw new Error("Invalid PIN");
        loadScans();
      } else {
        const unlocked = await unlockScan(item.id, pin);
        if (!unlocked) throw new Error("Invalid PIN");
        setCurrentScan(unlocked.document, unlocked.id);
        router.push("/preview");
        loadScans();
      }
    }
    setPinModal({ visible: false, mode: "lock", ids: [] });
  };

  const handlePress = (item: StoredScan) => {
    if (item.isLocked) {
      Alert.alert(item.document.title, "This document is locked.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlock & Open",
          onPress: () => setPinModal({ visible: true, mode: "unlock", ids: [], item }),
        },
        {
          text: "Remove PIN",
          onPress: () =>
            setPinModal({
              visible: true,
              mode: "unlock",
              ids: [],
              item,
              removeLockOnly: true,
            }),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDelete(item),
        },
      ]);
      return;
    }
    Alert.alert(item.document.title, "What would you like to do?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Edit",
        onPress: () => {
          setCurrentScan(item.document, item.id);
          router.push("/preview");
        },
      },
      {
        text: "Export",
        onPress: () => setExportItem(item),
      },
      {
        text: "Lock with PIN",
        onPress: () => setPinModal({ visible: true, mode: "lock", ids: [item.id] }),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDelete(item),
      },
    ]);
  };

  const getExportContent = (item: StoredScan): string => {
    const formatted = item.document.formattedContent || "";
    const isEditorFormat =
      formatted.startsWith("<") && /<(p|div|span|strong|em|h[1-6]|ul|ol|li|br)\b/i.test(formatted);
    const isMarkdownContent = isMarkdown(formatted);
    return formatted
      ? isEditorFormat || isMarkdownContent
        ? formatted
        : formatTaggedContent(formatted)
      : item.document.rawText || "";
  };

  const handleDelete = (item: StoredScan) => {
    Alert.alert(
      "Delete Scan",
      `Delete "${item.document.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteScan(item.id);
            loadScans();
          },
        },
      ]
    );
  };

  const totalPages = scans.reduce((acc, s) => acc + 1, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSubtitle}>
          {scans.length} scanned document{scans.length !== 1 ? "s" : ""}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{scans.length}</Text>
          <Text style={styles.statLabel}>Total Scans</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalPages}</Text>
          <Text style={styles.statLabel}>Documents</Text>
        </View>
      </View>

      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionLabel}>Recent Scans</Text>
          <Pressable
            style={styles.selectButton}
            onPress={() => {
              setSelectingMode((m) => !m);
              if (selectingMode) setSelectedIds(new Set());
            }}
          >
            <Text style={styles.selectButtonText}>
              {selectingMode ? "Cancel" : "Select"}
            </Text>
          </Pressable>
        </View>

        {selectingMode && selectedIds.size > 0 && (
          <View style={styles.lockBar}>
            <Text style={styles.lockBarText}>
              {selectedIds.size} selected
            </Text>
            <Pressable style={styles.lockBarButton} onPress={handleLockSelected}>
              <Ionicons name="lock-closed-outline" size={18} color="#0f172a" />
              <Text style={styles.lockBarButtonText}>Lock with PIN</Text>
            </Pressable>
          </View>
        )}

        <FlatList
          data={scans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ScanItemCard
              item={item}
              onPress={() => handlePress(item)}
              selected={selectedIds.has(item.id)}
              selectingMode={selectingMode}
              onToggleSelect={() => toggleSelect(item.id)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            scans.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#334155" />
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptySubtitle}>
                Scan a document on the Scanner and save it here
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#38bdf8"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </View>

      {exportItem && (
        <ExportModal
          visible
          document={exportItem.document}
          content={getExportContent(exportItem)}
          onClose={() => setExportItem(null)}
        />
      )}

      <PinModal
        visible={pinModal.visible}
        mode={pinModal.mode}
        title={
          pinModal.removeLockOnly
            ? "Enter PIN to remove protection"
            : pinModal.mode === "unlock"
              ? "Enter PIN to open"
              : "Create PIN"
        }
        subtitle={
          pinModal.mode === "lock" && pinModal.ids.length > 1
            ? `Lock ${pinModal.ids.length} documents`
            : pinModal.mode === "lock"
              ? "Protect this document with a PIN"
              : undefined
        }
        requireConfirm={pinModal.mode === "lock"}
        confirmLabel={pinModal.removeLockOnly ? "Remove PIN" : undefined}
        onConfirm={handlePinConfirm}
        onCancel={() => setPinModal({ visible: false, mode: "lock", ids: [] })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#f8fafc",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#38bdf8",
  },
  statLabel: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 4,
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 24,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  selectButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#38bdf8",
  },
  lockBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  lockBarText: {
    fontSize: 14,
    color: "#94a3b8",
  },
  lockBarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#38bdf8",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  lockBarButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyList: {
    flexGrow: 1,
  },
  scanCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  scanCardSelected: {
    borderColor: "#38bdf8",
    backgroundColor: "#1e3a4a",
  },
  selectWrap: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#64748b",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    borderColor: "#38bdf8",
    backgroundColor: "#38bdf8",
  },
  scanCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#f59e0b",
    textTransform: "uppercase",
  },
  scanCardThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    marginRight: 16,
  },
  scanCardThumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  scanCardContent: {
    flex: 1,
  },
  scanCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8fafc",
  },
  scanCardDate: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  scanCardMeta: {
    marginTop: 4,
  },
  scanCardMetaText: {
    fontSize: 12,
    color: "#64748b",
  },
  scanCardChevron: {
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#475569",
    marginTop: 8,
    textAlign: "center",
  },
});
