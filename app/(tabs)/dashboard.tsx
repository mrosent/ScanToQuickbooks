import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { scanDocumentWithAI, getFriendlyErrorMessage } from "../../lib/scanService";
import { setCurrentScan } from "../../lib/scanStore";

export default function DashboardScreen() {
  type CropHandle =
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "topLeft"
    | "topRight"
    | "bottomLeft"
    | "bottomRight";

  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isManipulating, setIsManipulating] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [previewLayout, setPreviewLayout] = useState<{ width: number; height: number } | null>(null);
  const [cropRect, setCropRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const cropRectRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const dragStartRectRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Access Required",
        "Please grant camera permission to scan documents."
      );
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photo Access Required",
        "Please grant photo library permission to upload documents."
      );
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    setIsLoading(true);
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(
        "Camera Unavailable",
        "The camera isn't available (e.g. on iOS Simulator). Would you like to choose an image from your photo library instead?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Choose Photo", onPress: handleUploadImage },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadImage = async () => {
    setIsLoading(true);
    try {
      const hasPermission = await requestMediaLibraryPermission();
      if (!hasPermission) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearImage = () => {
    setImageUri(null);
    setIsCropMode(false);
    setCropRect(null);
    setImageSize(null);
    setPreviewLayout(null);
  };

  const handleRotateLeft = async () => {
    if (!imageUri) return;
    setIsManipulating(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ rotate: -90 }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImageUri(result.uri);
    } catch {
      Alert.alert("Error", "Failed to rotate image.");
    } finally {
      setIsManipulating(false);
    }
  };

  const handleRotateRight = async () => {
    if (!imageUri) return;
    setIsManipulating(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ rotate: 90 }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImageUri(result.uri);
    } catch {
      Alert.alert("Error", "Failed to rotate image.");
    } finally {
      setIsManipulating(false);
    }
  };

  const getDisplayedImageRect = () => {
    if (!previewLayout || !imageSize) return null;
    const { width: containerWidth, height: containerHeight } = previewLayout;
    const { width: sourceWidth, height: sourceHeight } = imageSize;
    if (!containerWidth || !containerHeight || !sourceWidth || !sourceHeight) return null;

    const containerRatio = containerWidth / containerHeight;
    const imageRatio = sourceWidth / sourceHeight;

    if (containerRatio > imageRatio) {
      const height = containerHeight;
      const width = height * imageRatio;
      return {
        x: (containerWidth - width) / 2,
        y: 0,
        width,
        height,
      };
    }

    const width = containerWidth;
    const height = width / imageRatio;
    return {
      x: 0,
      y: (containerHeight - height) / 2,
      width,
      height,
    };
  };

  const initializeCropRect = () => {
    const displayed = getDisplayedImageRect();
    if (!displayed) return;
    const inset = Math.max(12, Math.min(displayed.width, displayed.height) * 0.08);
    setCropRect({
      x: displayed.x + inset,
      y: displayed.y + inset,
      width: displayed.width - inset * 2,
      height: displayed.height - inset * 2,
    });
  };

  useEffect(() => {
    if (isCropMode && !cropRect && imageSize && previewLayout) {
      initializeCropRect();
    }
  }, [isCropMode, cropRect, imageSize, previewLayout]);

  useEffect(() => {
    cropRectRef.current = cropRect;
  }, [cropRect]);

  const handlePreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width === 0 || height === 0) return;
    setPreviewLayout({ width, height });
  };

  const handleCrop = async () => {
    if (!imageUri || isExtracting || isManipulating) return;
    try {
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(
          imageUri,
          (width, height) => resolve({ width, height }),
          reject
        );
      });
      setImageSize(size);
      setCropRect(null);
      setIsCropMode(true);
    } catch {
      Alert.alert("Error", "Failed to open crop controls.");
    }
  };

  const adjustCropRect = (
    type: CropHandle,
    dx: number,
    dy: number
  ) => {
    const displayed = getDisplayedImageRect();
    const start = dragStartRectRef.current;
    if (!start || !displayed) return;
    const minSize = 60;
    let next = { ...start };

    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    if (type === "left" || type === "topLeft" || type === "bottomLeft") {
      const nextX = clamp(start.x + dx, displayed.x, start.x + start.width - minSize);
      next.width = start.width - (nextX - start.x);
      next.x = nextX;
    }
    if (type === "right" || type === "topRight" || type === "bottomRight") {
      const right = clamp(
        start.x + start.width + dx,
        start.x + minSize,
        displayed.x + displayed.width
      );
      next.width = right - start.x;
    }
    if (type === "top" || type === "topLeft" || type === "topRight") {
      const nextY = clamp(start.y + dy, displayed.y, start.y + start.height - minSize);
      next.height = start.height - (nextY - start.y);
      next.y = nextY;
    }
    if (type === "bottom" || type === "bottomLeft" || type === "bottomRight") {
      const bottom = clamp(
        start.y + start.height + dy,
        start.y + minSize,
        displayed.y + displayed.height
      );
      next.height = bottom - start.y;
    }

    setCropRect(next);
  };

  const createCropHandleProps = (type: CropHandle) => ({
    onTouchStart: (e: GestureResponderEvent) => {
      const { pageX, pageY } = e.nativeEvent;
      touchStartRef.current = { x: pageX, y: pageY };
      dragStartRectRef.current = cropRectRef.current;
    },
    onTouchMove: (e: GestureResponderEvent) => {
      const start = touchStartRef.current;
      if (!start) return;
      const { pageX, pageY } = e.nativeEvent;
      const dx = pageX - start.x;
      const dy = pageY - start.y;
      adjustCropRect(type, dx, dy);
    },
    onTouchEnd: () => {
      touchStartRef.current = null;
    },
    onTouchCancel: () => {
      touchStartRef.current = null;
    },
  });

  const handleApplyCrop = async () => {
    if (!imageUri || !cropRect || !imageSize) return;
    const displayed = getDisplayedImageRect();
    if (!displayed) return;

    setIsManipulating(true);
    try {
      const scaleX = imageSize.width / displayed.width;
      const scaleY = imageSize.height / displayed.height;

      const originX = Math.max(0, Math.round((cropRect.x - displayed.x) * scaleX));
      const originY = Math.max(0, Math.round((cropRect.y - displayed.y) * scaleY));
      const width = Math.max(1, Math.round(cropRect.width * scaleX));
      const height = Math.max(1, Math.round(cropRect.height * scaleY));

      const clampedWidth = Math.min(width, imageSize.width - originX);
      const clampedHeight = Math.min(height, imageSize.height - originY);

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX,
              originY,
              width: clampedWidth,
              height: clampedHeight,
            },
          },
        ],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      setImageUri(result.uri);
      setIsCropMode(false);
      setCropRect(null);
      setImageSize(null);
    } catch {
      Alert.alert("Error", "Failed to crop image.");
    } finally {
      setIsManipulating(false);
    }
  };

  const handleCancelCrop = () => {
    setIsCropMode(false);
    setCropRect(null);
    setImageSize(null);
    dragStartRectRef.current = null;
  };

  const handleExtractText = async () => {
    if (!imageUri) return;
    setIsExtracting(true);
    try {
      const document = await scanDocumentWithAI(imageUri);
      if (document) {
        setCurrentScan(document);
        router.push("/preview");
      } else {
        Alert.alert("Error", "Could not extract text from the document.");
      }
    } catch (error) {
      Alert.alert("Error", getFriendlyErrorMessage(error));
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Main scan area */}
      <View style={styles.scanSection}>
        <View style={styles.scanFrame}>
          <View style={styles.scanFrameBorder}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            {imageUri ? (
              <View style={styles.previewContainer} onLayout={handlePreviewLayout}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                {isCropMode && cropRect && (
                  <View style={styles.cropOverlay} pointerEvents="box-none">
                    <View
                      style={[
                        styles.cropBox,
                        {
                          left: cropRect.x,
                          top: cropRect.y,
                          width: cropRect.width,
                          height: cropRect.height,
                        },
                      ]}
                      pointerEvents="none"
                    />
                    <View
                      style={[
                        styles.handleTouchArea,
                        { left: cropRect.x - 14, top: cropRect.y - 14 },
                      ]}
                      collapsable={false}
                      {...createCropHandleProps("topLeft")}
                    >
                      <View style={styles.handleCorner} />
                    </View>
                    <View
                      style={[
                        styles.handleTouchArea,
                        { left: cropRect.x + cropRect.width - 14, top: cropRect.y - 14 },
                      ]}
                      collapsable={false}
                      {...createCropHandleProps("topRight")}
                    >
                      <View style={styles.handleCorner} />
                    </View>
                    <View
                      style={[
                        styles.handleTouchArea,
                        { left: cropRect.x - 14, top: cropRect.y + cropRect.height - 14 },
                      ]}
                      collapsable={false}
                      {...createCropHandleProps("bottomLeft")}
                    >
                      <View style={styles.handleCorner} />
                    </View>
                    <View
                      style={[
                        styles.handleTouchArea,
                        {
                          left: cropRect.x + cropRect.width - 14,
                          top: cropRect.y + cropRect.height - 14,
                        },
                      ]}
                      collapsable={false}
                      {...createCropHandleProps("bottomRight")}
                    >
                      <View style={styles.handleCorner} />
                    </View>
                    <View
                      style={[
                        styles.handleTouchArea,
                        { left: cropRect.x + cropRect.width / 2 - 24, top: cropRect.y - 8 },
                      ]}
                      collapsable={false}
                      {...createCropHandleProps("top")}
                    >
                      <View style={styles.handleEdgeHorizontal} />
                    </View>
                    <View
                      style={[
                        styles.handleTouchArea,
                        {
                          left: cropRect.x + cropRect.width / 2 - 24,
                          top: cropRect.y + cropRect.height - 8,
                        },
                      ]}
                      collapsable={false}
                      {...createCropHandleProps("bottom")}
                    >
                      <View style={styles.handleEdgeHorizontal} />
                    </View>
                    <View
                      style={[
                        styles.handleTouchArea,
                        { left: cropRect.x - 8, top: cropRect.y + cropRect.height / 2 - 24 },
                      ]}
                      collapsable={false}
                      {...createCropHandleProps("left")}
                    >
                      <View style={styles.handleEdgeVertical} />
                    </View>
                    <View
                      style={[
                        styles.handleTouchArea,
                        {
                          left: cropRect.x + cropRect.width - 8,
                          top: cropRect.y + cropRect.height / 2 - 24,
                        },
                      ]}
                      collapsable={false}
                      {...createCropHandleProps("right")}
                    >
                      <View style={styles.handleEdgeVertical} />
                    </View>
                  </View>
                )}
                <View style={styles.imageEditOverlay}>
                  <Pressable
                    style={[styles.editButton, isManipulating && styles.buttonDisabled]}
                    onPress={handleRotateLeft}
                    disabled={isManipulating || isExtracting || isCropMode}
                  >
                    <MaterialCommunityIcons name="rotate-left" size={24} color="#f8fafc" />
                  </Pressable>
                  <Pressable
                    style={[styles.editButton, isManipulating && styles.buttonDisabled]}
                    onPress={handleRotateRight}
                    disabled={isManipulating || isExtracting || isCropMode}
                  >
                    <MaterialCommunityIcons name="rotate-right" size={24} color="#f8fafc" />
                  </Pressable>
                  <Pressable
                    style={[styles.editButton, isManipulating && styles.buttonDisabled]}
                    onPress={handleCrop}
                    disabled={isManipulating || isExtracting}
                  >
                    <MaterialCommunityIcons name="crop" size={22} color="#f8fafc" />
                  </Pressable>
                </View>
                {isCropMode && (
                  <View style={styles.cropActionBar}>
                    <Pressable style={styles.cropActionButton} onPress={handleCancelCrop}>
                      <Text style={styles.cropActionText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.cropActionButton, styles.cropActionApply]}
                      onPress={handleApplyCrop}
                      disabled={isManipulating}
                    >
                      <Text style={[styles.cropActionText, styles.cropActionApplyText]}>Apply</Text>
                    </Pressable>
                  </View>
                )}
                <Pressable
                  style={styles.clearButton}
                  onPress={handleClearImage}
                  hitSlop={12}
                >
                  <Ionicons name="close-circle" size={36} color="#38bdf8" />
                </Pressable>
              </View>
            ) : (
              <Ionicons
                name="scan-outline"
                size={80}
                color="rgba(56, 189, 248, 0.4)"
                style={styles.scanIcon}
              />
            )}
          </View>
        </View>

        {imageUri && (
          <Pressable
            style={[
              styles.extractButton,
              (isLoading || isExtracting || isManipulating) && styles.buttonDisabled,
            ]}
            onPress={handleExtractText}
            disabled={isLoading || isExtracting || isManipulating || isCropMode}
          >
            {isExtracting ? (
              <>
                <ActivityIndicator size="small" color="#0f172a" />
                <Text style={styles.extractButtonText}>
                  Analyzing with AI...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="text-outline" size={24} color="#0f172a" />
                <Text style={styles.extractButtonText}>Extract Text with AI</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionCard}
            onPress={handleTakePhoto}
            disabled={isLoading || isExtracting}
          >
            <View style={styles.actionIconWrapper}>
              <Ionicons name="document-text-outline" size={24} color="#38bdf8" />
            </View>
            <Text style={styles.actionLabel}>Single Page</Text>
          </Pressable>
          <Pressable
            style={styles.actionCard}
            onPress={handleUploadImage}
            disabled={isLoading || isExtracting}
          >
            <View style={styles.actionIconWrapper}>
              <Ionicons name="documents-outline" size={24} color="#38bdf8" />
            </View>
            <Text style={styles.actionLabel}>From Gallery</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scanSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 16,
  },
  scanFrame: {
    width: "92%",
    aspectRatio: 3 / 4,
    borderRadius: 24,
    backgroundColor: "#1e293b",
    borderWidth: 2,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
    overflow: "hidden",
  },
  scanFrameBorder: {
    flex: 1,
    width: "100%",
    position: "relative",
  },
  cornerTL: {
    position: "absolute",
    top: 24,
    left: 24,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#38bdf8",
    borderRadius: 4,
  },
  cornerTR: {
    position: "absolute",
    top: 24,
    right: 24,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#38bdf8",
    borderRadius: 4,
  },
  cornerBL: {
    position: "absolute",
    bottom: 24,
    left: 24,
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#38bdf8",
    borderRadius: 4,
  },
  cornerBR: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#38bdf8",
    borderRadius: 4,
  },
  previewContainer: {
    flex: 1,
    width: "100%",
  },
  previewImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  cropOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
  },
  cropBox: {
    position: "absolute",
    borderColor: "#38bdf8",
    borderWidth: 2,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  handleTouchArea: {
    position: "absolute",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  handleCorner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#38bdf8",
  },
  handleEdgeHorizontal: {
    width: 48,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#38bdf8",
  },
  handleEdgeVertical: {
    width: 16,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#38bdf8",
  },
  clearButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
  },
  imageEditOverlay: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  cropActionBar: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 40,
    elevation: 40,
  },
  cropActionButton: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderColor: "#475569",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cropActionApply: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  cropActionText: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 13,
  },
  cropActionApplyText: {
    color: "#0f172a",
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanIcon: {
    alignSelf: "center",
    marginTop: "50%",
    transform: [{ translateY: -40 }],
  },
  extractButton: {
    position: "relative",
    zIndex: 20,
    elevation: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#22c55e",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginBottom: 16,
  },
  extractButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  quickActions: {
    position: "relative",
    zIndex: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  actionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f8fafc",
  },
});
