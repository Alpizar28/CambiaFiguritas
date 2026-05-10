import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { colors, radii, spacing } from '../../../constants/theme';
import { CloseIcon, FlashIcon } from './TradeIcons';

type QRScannerProps = {
  onResult: (raw: string) => void;
  onClose: () => void;
};

export function QRScanner({ onResult, onClose }: QRScannerProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const lockedRef = useRef(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => {});
    }
  }, [permission, requestPermission]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !permission.granted ? (
          <View style={[styles.center, { paddingHorizontal: spacing.xl }]}>
            <Text style={styles.permTitle}>Permiso de cámara necesario</Text>
            <Text style={styles.permText}>
              Para escanear el QR del intercambio necesitamos acceso a la cámara.
            </Text>
            <Pressable
              onPress={() => requestPermission()}
              style={({ pressed }) => [styles.permBtn, pressed && styles.pressed]}
            >
              <Text style={styles.permBtnText}>Permitir cámara</Text>
            </Pressable>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeText, pressed && styles.pressed]}>
              <Text style={styles.closeTextLabel}>Cancelar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(event) => {
                if (lockedRef.current) return;
                lockedRef.current = true;
                onResult(event.data);
              }}
            />
            <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
              <Pressable onPress={onClose} hitSlop={12} style={styles.iconBtn}>
                <CloseIcon size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => setTorchOn((v) => !v)}
                hitSlop={12}
                style={[styles.iconBtn, torchOn && styles.iconBtnActive]}
              >
                <FlashIcon size={20} color={torchOn ? '#FFD600' : '#FFFFFF'} />
              </Pressable>
            </View>
            <View style={styles.frameWrap} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.hint}>Apuntá al QR del otro coleccionista</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  permTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  permText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  permBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
  },
  permBtnText: {
    color: '#001A0A',
    fontWeight: '900',
  },
  closeText: {
    paddingVertical: spacing.sm,
  },
  closeTextLabel: {
    color: colors.textMuted,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(255,214,0,0.6)',
  },
  frameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderColor: colors.primary,
    borderWidth: 3,
    borderRadius: radii.lg,
  },
  hint: {
    color: '#FFFFFF',
    marginTop: spacing.lg,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
