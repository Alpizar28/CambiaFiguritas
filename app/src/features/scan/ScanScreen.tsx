import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { colors, radii, spacing } from '../../constants/theme';
import { track } from '../../services/analytics';
import { useStickerScan } from './useStickerScan';
import { ScanResultSheet } from './ScanResultSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ScanScreen({ visible, onClose }: Props) {
  const cameraRef = useRef<CameraView | null>(null);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);

  const {
    state,
    capture,
    reset,
    toggleSelected,
    addManualCode,
    confirmSelected,
    dismiss,
  } = useStickerScan({
    cameraRef,
    onAfterConfirm: () => {
      setTorchOn(false);
      onClose();
    },
  });

  const handleClose = () => {
    setTorchOn(false);
    dismiss();
    onClose();
  };

  useEffect(() => {
    if (visible) {
      track({ name: 'scan_opened' });
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      reset();
      setTorchOn(false);
    }
  }, [visible, reset]);

  const isReviewing = state.kind === 'review';
  const isBusy = state.kind === 'capturing' || state.kind === 'recognizing';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {Platform.OS === 'web' ? (
          <WebUnsupported onClose={handleClose} />
        ) : !permission ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !permission.granted ? (
          <PermissionRequest
            onAllow={() => requestPermission()}
            canAskAgain={permission.canAskAgain ?? true}
            onClose={handleClose}
          />
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchOn}
              autofocus="on"
            />
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
                <Pressable
                  style={styles.iconButton}
                  onPress={handleClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar escáner"
                >
                  <Text style={styles.iconText}>✕</Text>
                </Pressable>
                <Pressable
                  style={[styles.iconButton, torchOn && styles.iconButtonActive]}
                  onPress={() => setTorchOn((v) => !v)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={torchOn ? 'Apagar flash' : 'Encender flash'}
                >
                  <Text style={styles.iconText}>{torchOn ? '⚡' : '💡'}</Text>
                </Pressable>
              </View>

              <View style={styles.frameWrapper}>
                <View style={styles.frame} />
                <Text style={styles.hint}>
                  Apuntá al dorso de la figurita y centrá el código
                </Text>
              </View>

              <View
                style={[
                  styles.bottomBar,
                  { paddingBottom: insets.bottom + spacing.lg },
                ]}
              >
                {state.kind === 'empty' || state.kind === 'error' ? (
                  <View style={styles.errorCard}>
                    <Text style={styles.errorText}>{state.message}</Text>
                  </View>
                ) : null}
                <Pressable
                  style={[
                    styles.captureButton,
                    isBusy && styles.captureButtonDisabled,
                  ]}
                  onPress={capture}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Capturar"
                >
                  {isBusy ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <View style={styles.captureInner} />
                  )}
                </Pressable>
                <Text style={styles.captureLabel}>
                  {state.kind === 'capturing'
                    ? 'Capturando…'
                    : state.kind === 'recognizing'
                      ? 'Procesando…'
                      : 'Tocá para capturar'}
                </Text>
              </View>
            </View>

            {isReviewing && state.kind === 'review' ? (
              <ScanResultSheet
                visible
                candidates={state.candidates}
                selected={state.selected}
                onToggle={toggleSelected}
                onConfirm={confirmSelected}
                onDismiss={dismiss}
                onAddManual={addManualCode}
              />
            ) : null}
          </>
        )}
      </View>
    </Modal>
  );
}

function WebUnsupported({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.webTitle}>Disponible en la app móvil</Text>
      <Text style={styles.webBody}>
        El escaneo de figuritas usa procesamiento local de la cámara y solo
        funciona en la app de iOS y Android.
      </Text>
      <Pressable style={styles.primaryButton} onPress={onClose}>
        <Text style={styles.primaryButtonText}>Entendido</Text>
      </Pressable>
    </View>
  );
}

type PermissionRequestProps = {
  onAllow: () => void;
  canAskAgain: boolean;
  onClose: () => void;
};

function PermissionRequest({ onAllow, canAskAgain, onClose }: PermissionRequestProps) {
  return (
    <View style={styles.centered}>
      <Text style={styles.webTitle}>Necesitamos la cámara</Text>
      <Text style={styles.webBody}>
        Para escanear figuritas usamos la cámara solo en tu dispositivo. No
        guardamos ni subimos las fotos.
      </Text>
      {canAskAgain ? (
        <Pressable style={styles.primaryButton} onPress={onAllow}>
          <Text style={styles.primaryButtonText}>Permitir cámara</Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.primaryButton}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.primaryButtonText}>Abrir ajustes</Text>
        </Pressable>
      )}
      <Pressable style={styles.secondaryButton} onPress={onClose}>
        <Text style={styles.secondaryButtonText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: colors.accent,
  },
  iconText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  frameWrapper: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  frame: {
    width: '85%',
    aspectRatio: 1.4,
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: radii.md,
    backgroundColor: 'transparent',
  },
  hint: {
    color: colors.text,
    fontSize: 14,
    marginTop: spacing.md,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  bottomBar: {
    alignItems: 'center',
    paddingTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  errorCard: {
    backgroundColor: 'rgba(255,23,68,0.85)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
    maxWidth: 320,
  },
  errorText: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
  captureButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
  },
  captureLabel: {
    color: colors.text,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  webTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  webBody: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
