import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../lib/theme';
import { objectsApi, parseApiError } from '../../lib/api';

type ScanState = 'idle' | 'scanning' | 'processing' | 'success' | 'error' | 'no_permission';

export default function ScanScreen() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [foundObject, setFoundObject] = useState<{ title: string; id: string; unique_code: string } | null>(null);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setHasPermission(true);
        setScanState('scanning');
      } else {
        setHasPermission(false);
        setScanState('no_permission');
      }
    });
  }, []);

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanState('processing');

    try {
      // Extract code from URL or use raw value
      const code = data.includes('/scan/') ? data.split('/scan/')[1].split('/')[0] : data;
      const { data: obj } = await objectsApi.scan(code);
      setFoundObject({ title: obj.title, id: obj.id, unique_code: obj.unique_code });
      setScanState('success');
    } catch (err) {
      setScanState('error');
      Alert.alert(
        'Objeto não encontrado',
        'Este QR Code não corresponde a nenhum objeto no Backfindr.',
        [{ text: 'Tentar novamente', onPress: reset }]
      );
    }
  };

  const reset = () => {
    setScanned(false);
    setFoundObject(null);
    setScanState('scanning');
  };

  const notifyOwner = async () => {
    if (!foundObject) return;
    try {
      await objectsApi.notify(foundObject.unique_code);
      Alert.alert(
        '✅ Dono notificado!',
        'O dono foi notificado que você encontrou o objeto. Em breve entrarão em contato.',
        [{ text: 'OK', onPress: () => { reset(); router.push('/(tabs)'); } }]
      );
    } catch (err) {
      Alert.alert('Erro', parseApiError(err));
    }
  };

  // ── No permission ──────────────────────────────────────────────────────────
  if (scanState === 'no_permission') {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-outline" size={48} color={Colors.text.muted} />
        <Text style={styles.permTitle}>Câmera bloqueada</Text>
        <Text style={styles.permText}>
          Permita o acesso à câmera nas configurações do dispositivo para escanear QR Codes.
        </Text>
      </View>
    );
  }

  // ── Success — object found ─────────────────────────────────────────────────
  if (scanState === 'success' && foundObject) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.brand[500]} />
          </View>
          <Text style={styles.successTitle}>Objeto encontrado!</Text>
          <Text style={styles.successName}>{foundObject.title}</Text>
          <Text style={styles.successDesc}>
            Este objeto está registrado no Backfindr. Deseja notificar o dono que você o encontrou?
          </Text>

          <TouchableOpacity style={styles.notifyBtn} onPress={notifyOwner} activeOpacity={0.85}>
            <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            <Text style={styles.notifyBtnText}>Notificar o dono</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
            <Text style={styles.cancelBtnText}>Escanear outro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Scanning ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.scanContainer}>
      {hasPermission && (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top */}
        <View style={styles.overlaySection}>
          <Text style={styles.scanTitle}>Escanear QR Code</Text>
          <Text style={styles.scanSubtitle}>
            Aponte a câmera para o QR Code do Backfindr
          </Text>
        </View>

        {/* Viewfinder */}
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          {scanState === 'processing' && (
            <ActivityIndicator size="large" color={Colors.brand[500]} />
          )}
        </View>

        {/* Bottom */}
        <View style={styles.overlaySection}>
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => router.push('/scan/manual')}
          >
            <Ionicons name="keyboard-outline" size={16} color={Colors.text.secondary} />
            <Text style={styles.manualBtnText}>Inserir código manualmente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: Colors.surface.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  permTitle: { ...Typography.display.md, color: Colors.text.primary, textAlign: 'center' },
  permText:  { ...Typography.body.md, color: Colors.text.secondary, textAlign: 'center' },

  scanContainer: { flex: 1, backgroundColor: '#000' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: Spacing.xl,
  },
  overlaySection: { alignItems: 'center', gap: Spacing.sm },
  scanTitle:    { ...Typography.display.md, color: '#fff' },
  scanSubtitle: { ...Typography.body.md, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  viewfinder: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: Colors.brand[500],
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 4 },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  manualBtnText: { ...Typography.body.md, color: 'rgba(255,255,255,0.8)' },

  // Success
  successContainer: {
    flex: 1,
    backgroundColor: Colors.surface.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  successCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
  },
  successIcon:  { marginBottom: Spacing.xs },
  successTitle: { ...Typography.display.md, color: Colors.text.primary },
  successName:  { ...Typography.display.sm, color: Colors.brand[400], textAlign: 'center' },
  successDesc:  { ...Typography.body.md, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.brand[500],
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    marginTop: Spacing.xs,
  },
  notifyBtnText: { ...Typography.body.lg, color: '#fff', fontWeight: '600' },
  cancelBtn:     { paddingVertical: Spacing.sm },
  cancelBtnText: { ...Typography.body.md, color: Colors.text.muted },
});
