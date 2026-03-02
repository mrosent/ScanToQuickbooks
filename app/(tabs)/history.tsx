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
import { getStoredScans, deleteScan } from "../../lib/storage";
import { setCurrentScan } from "../../lib/scanStore";
import type { StoredScan } from "../../lib/types";

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
  onLongPress,
}: {
  item: StoredScan;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const doc = item.document;
  return (
    <Pressable
      style={styles.scanCard}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {doc.imageUri ? (
        <Image
          source={{ uri: doc.imageUri }}
          style={styles.scanCardThumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.scanCardThumbnailPlaceholder}>
          <Ionicons name="document-text" size={28} color="#64748b" />
        </View>
      )}
      <View style={styles.scanCardContent}>
        <Text style={styles.scanCardTitle} numberOfLines={1}>
          {doc.title}
        </Text>
        <Text style={styles.scanCardDate}>{formatDate(item.createdAt)}</Text>
        <View style={styles.scanCardMeta}>
          <Text style={styles.scanCardMetaText}>
            {doc.type.replace("_", " ")} • {doc.fields?.length ?? 0} fields
          </Text>
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color="#64748b"
        style={styles.scanCardChevron}
      />
    </Pressable>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [scans, setScans] = useState<StoredScan[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  const handlePress = (item: StoredScan) => {
    setCurrentScan(item.document);
    router.push("/preview");
  };

  const handleLongPress = (item: StoredScan) => {
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
        </View>

        <FlatList
          data={scans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ScanItemCard
              item={item}
              onPress={() => handlePress(item)}
              onLongPress={() => handleLongPress(item)}
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
                Scan a document on the Dashboard and save it here
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
