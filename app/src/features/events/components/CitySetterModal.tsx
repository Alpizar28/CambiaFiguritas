import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { setUserCity } from '../../../services/userService';
import { isValidCity } from '../../../utils/citySlug';
import { track } from '../../../services/analytics';
import { colors, radii, spacing } from '../../../constants/theme';

type Props = {
  visible: boolean;
  initialValue?: string;
  onClose: () => void;
  onSaved: (city: string) => void;
  uid: string;
};

export function CitySetterModal({ visible, initialValue, onClose, onSaved, uid }: Props) {
  const [value, setValue] = useState(initialValue ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue(initialValue ?? '');
      setError(null);
    }
  }, [visible, initialValue]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!isValidCity(trimmed)) {
      setError('Ingresá una ciudad válida (ej: Buenos Aires).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setUserCity(uid, trimmed);
      track({ name: 'event_city_set', params: { source: 'manual' } });
      onSaved(trimmed);
      onClose();
    } catch {
      setError('No se pudo guardar tu ciudad. Probá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Tu ciudad</Text>
          <Text style={styles.subtitle}>
            Vamos a usar este dato para mostrarte solo eventos cerca tuyo.
          </Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder="Buenos Aires"
            placeholderTextColor={colors.textMuted}
            maxLength={80}
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.cancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles.confirm} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.confirmText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 400,
    width: '100%' as `${number}%`,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancel: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  confirm: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  confirmText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
});
