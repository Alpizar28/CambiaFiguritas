import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
};

export function LegalModal({ visible, title, body, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={styles.close}>‹ Volver</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          {parseBody(body).map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string };

function parseBody(body: string): Block[] {
  const lines = body.split('\n');
  const out: Block[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (line.startsWith('# ')) out.push({ kind: 'h1', text: line.slice(2) });
    else if (line.startsWith('## ')) out.push({ kind: 'h2', text: line.slice(3) });
    else if (line.startsWith('• ') || line.startsWith('- ')) out.push({ kind: 'li', text: line.slice(2) });
    else out.push({ kind: 'p', text: line });
  }
  return out;
}

function Block({ block }: { block: Block }) {
  if (block.kind === 'h1') return <Text style={styles.h1}>{block.text}</Text>;
  if (block.kind === 'h2') return <Text style={styles.h2}>{block.text}</Text>;
  if (block.kind === 'li') {
    return (
      <View style={styles.liRow}>
        <Text style={styles.liBullet}>•</Text>
        <Text style={[styles.p, { flex: 1 }]}>{block.text}</Text>
      </View>
    );
  }
  return <Text style={styles.p}>{block.text}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 60,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  h1: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  h2: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  p: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  liRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
  },
  liBullet: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 22,
  },
});
