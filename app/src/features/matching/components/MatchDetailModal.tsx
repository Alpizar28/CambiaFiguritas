import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Match } from '../../../services/matchingService';
import { MatchCard } from './MatchCard';
import { colors, radii, spacing } from '../../../constants/theme';

type Props = {
  match: Match | null;
  onClose: () => void;
};

export function MatchDetailModal({ match, onClose }: Props) {
  if (!match) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerBar}>
            <Text style={styles.headerTitle}>Detalle del match</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>Cerrar</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <MatchCard match={match} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '90%' as `${number}%`,
    paddingBottom: spacing.xl,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  close: {
    color: colors.textMuted,
    fontSize: 14,
  },
  body: {
    padding: spacing.md,
  },
});
