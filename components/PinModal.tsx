import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type PinModalMode = "lock" | "unlock" | "confirm";

interface PinModalProps {
  visible: boolean;
  mode: PinModalMode;
  title: string;
  subtitle?: string;
  onConfirm: (pin: string) => void | Promise<void>;
  onCancel: () => void;
  /** For lock mode: require confirmation (enter PIN twice) */
  requireConfirm?: boolean;
  /** Override confirm button text */
  confirmLabel?: string;
}

export function PinModal({
  visible,
  mode,
  title,
  subtitle,
  onConfirm,
  onCancel,
  requireConfirm = mode === "lock",
  confirmLabel,
}: PinModalProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setPin("");
    setConfirmPin("");
    setError("");
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = async () => {
    setError("");
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    if (requireConfirm && pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(pin);
      reset();
    } catch {
      setError("Invalid PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) handleCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={mode === "unlock" ? "lock-open-outline" : "lock-closed-outline"}
                  size={32}
                  color="#38bdf8"
                />
              </View>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Enter PIN (4+ digits)"
              placeholderTextColor="#64748b"
              value={pin}
              onChangeText={(t) => {
                setPin(t.replace(/\D/g, "").slice(0, 8));
                setError("");
              }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              editable={!loading}
              autoFocus
            />

            {requireConfirm && (
              <TextInput
                style={[styles.input, styles.inputSecond]}
                placeholder="Confirm PIN"
                placeholderTextColor="#64748b"
                value={confirmPin}
                onChangeText={(t) => {
                  setConfirmPin(t.replace(/\D/g, "").slice(0, 8));
                  setError("");
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                editable={!loading}
              />
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, loading && styles.buttonDisabled]}
                onPress={handleConfirm}
                disabled={loading || pin.length < 4 || (requireConfirm && confirmPin.length < 4)}
              >
                <Text style={styles.confirmText}>
                  {loading ? "..." : confirmLabel ?? (mode === "unlock" ? "Unlock" : "Lock")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  keyboardView: {
    width: "100%",
    maxWidth: 360,
  },
  content: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: "#f8fafc",
    borderWidth: 1,
    borderColor: "#334155",
  },
  inputSecond: {
    marginTop: 12,
  },
  error: {
    fontSize: 14,
    color: "#ef4444",
    marginTop: 12,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#334155",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#94a3b8",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#38bdf8",
    alignItems: "center",
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
