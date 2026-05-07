import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../../../constants/theme';

type Props = {
  visible: boolean;
  durationMs: number;
  onComplete: () => void;
  onDismiss: () => void;
};

/**
 * Web rewarded ad fallback. Modal con countdown bloqueante.
 * No es un anuncio real (AdSense no está aprobado sin dominio propio); cumple
 * la función de gate de tiempo + intención del usuario.
 */
export function RewardedAdModal({ visible, durationMs, onComplete, onDismiss }: Props) {
  const [remaining, setRemaining] = useState(durationMs);
  const [completed, setCompleted] = useState(false);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (!visible) {
      setRemaining(durationMs);
      setCompleted(false);
      return;
    }
    startedAt.current = Date.now();
    setRemaining(durationMs);
    setCompleted(false);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const left = Math.max(0, durationMs - elapsed);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
        setCompleted(true);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [visible, durationMs]);

  const seconds = Math.ceil(remaining / 1000);
  const totalSec = Math.ceil(durationMs / 1000);
  const progress = 1 - remaining / durationMs;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Anuncio</Text>
          <Text style={styles.title}>
            {completed ? '✓ Listo' : 'Mantené el modal abierto'}
          </Text>
          <Text style={styles.subtitle}>
            {completed
              ? 'Desbloqueando tu match...'
              : `Esperá ${seconds}s para desbloquear +1 match`}
          </Text>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, Math.max(0, progress * 100))}%` as `${number}%` },
              ]}
            />
          </View>

          <Text style={styles.timer}>{seconds}s / {totalSec}s</Text>

          <View style={styles.actions}>
            {completed ? (
              <TouchableOpacity style={styles.completeBtn} onPress={onComplete}>
                <Text style={styles.completeBtnText}>Reclamar match</Text>
              </TouchableOpacity>
            ) : (
              <Pressable onPress={onDismiss} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    maxWidth: 360,
    width: '100%' as `${number}%`,
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  progressBar: {
    width: '100%' as `${number}%`,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: '100%' as `${number}%`,
    backgroundColor: colors.primary,
  },
  timer: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  actions: {
    width: '100%' as `${number}%`,
    marginTop: spacing.md,
  },
  completeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  completeBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
  },
  cancelBtn: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
