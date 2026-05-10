import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../../../constants/theme';

type QRScannerProps = {
  onResult: (raw: string) => void;
  onClose: () => void;
};

export function QRScanner({ onClose }: QRScannerProps) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Escaneo no disponible en web</Text>
          <Text style={styles.body}>
            Para escanear el QR usá la app móvil. En la web podés tipear el código manualmente.
          </Text>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
            <Text style={styles.btnText}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 420,
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  btnText: {
    color: '#001A0A',
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.85,
  },
});
