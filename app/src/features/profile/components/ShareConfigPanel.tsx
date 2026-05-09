import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radii } from '../../../constants/theme';

export type ShareCardOptions = {
  showName: boolean;
  showProgress: boolean;
  showRepeated: boolean;
  showMissing: boolean;
  showPhoto: boolean;
};

type Props = {
  options: ShareCardOptions;
  onChange: (options: ShareCardOptions) => void;
  onChangePhoto: () => void;
  hasCustomPhoto: boolean;
  onResetPhoto: () => void;
};

export function ShareConfigPanel({ options, onChange, onChangePhoto, hasCustomPhoto, onResetPhoto }: Props) {
  const set = (key: keyof ShareCardOptions, value: boolean) =>
    onChange({ ...options, [key]: value });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Personalizar tarjeta</Text>

      <Row label="Mostrar foto" value={options.showPhoto} onChange={(v) => set('showPhoto', v)} />
      <Row label="Mostrar nombre" value={options.showName} onChange={(v) => set('showName', v)} />
      <Row label="Mostrar progreso" value={options.showProgress} onChange={(v) => set('showProgress', v)} />
      <Row label="Mostrar repetidas" value={options.showRepeated} onChange={(v) => set('showRepeated', v)} />
      <Row label="Mostrar faltantes" value={options.showMissing} onChange={(v) => set('showMissing', v)} />

      <View style={styles.photoRow}>
        <TouchableOpacity style={styles.photoBtn} onPress={onChangePhoto}>
          <Text style={styles.photoBtnText}>Cambiar foto</Text>
        </TouchableOpacity>
        {hasCustomPhoto && (
          <TouchableOpacity style={styles.resetBtn} onPress={onResetPhoto}>
            <Text style={styles.resetBtnText}>Usar original</Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accent + '66' }}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  title: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '66',
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  resetBtn: {
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
});
