import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { createEvent } from '../../../services/eventService';
import { setUserCity } from '../../../services/userService';
import { citySlug, isValidCity } from '../../../utils/citySlug';
import { track } from '../../../services/analytics';
import { colors, spacing, radii } from '../../../constants/theme';
import type { EventType, AppEvent } from '../types';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'intercambio', label: '🔄 Intercambio' },
  { value: 'meetup', label: '🤝 Meetup' },
  { value: 'tienda', label: '🏪 Tienda' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (event: AppEvent) => void;
  uid: string;
  userName: string;
  currentCity?: string;
};

async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!results || results.length === 0) return null;
    const r = results[0];
    return r.city ?? r.subregion ?? r.region ?? null;
  } catch {
    return null;
  }
}

export function CreateEventModal({
  visible,
  onClose,
  onCreated,
  uid,
  userName,
  currentCity,
}: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('intercambio');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [city, setCity] = useState(currentCity ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setCity(currentCity ?? '');
  }, [visible, currentCity]);

  const reset = () => {
    setTitle('');
    setType('intercambio');
    setDescription('');
    setDate('');
    setCity(currentCity ?? '');
    setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!title.trim()) { setError('El título es obligatorio.'); return; }
    const parsed = new Date(date);
    if (!date || isNaN(parsed.getTime())) {
      setError('Fecha inválida. Usá el formato YYYY-MM-DD HH:MM');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Se necesita ubicación para crear el evento.');
        setSaving(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      let resolvedCity = city.trim();
      let citySource: 'manual' | 'reverse_geocode' | 'gps_default' = 'manual';
      if (!resolvedCity) {
        const auto = await reverseGeocodeCity(pos.coords.latitude, pos.coords.longitude);
        if (auto) {
          resolvedCity = auto;
          citySource = 'reverse_geocode';
        }
      }
      if (!isValidCity(resolvedCity)) {
        setError('Ingresá tu ciudad (ej: Buenos Aires).');
        setSaving(false);
        return;
      }
      const slug = citySlug(resolvedCity);

      const event = await createEvent({
        title: title.trim(),
        type,
        description: description.trim(),
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        date: parsed.toISOString(),
        createdBy: uid,
        creatorName: userName,
        cityName: resolvedCity,
        citySlug: slug,
      });
      track({ name: 'event_created', params: { type } });
      track({ name: 'event_city_set', params: { source: citySource } });

      // Persistir city del user si no la tenía o cambió
      if (!currentCity || currentCity.trim() !== resolvedCity) {
        setUserCity(uid, resolvedCity).catch(() => {});
      }

      onCreated(event);
      reset();
      onClose();
    } catch {
      setError('Error al crear el evento. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.handle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Nuevo evento</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form}>
          <Field label="Título *">
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: Intercambio en la plaza"
              placeholderTextColor={colors.textMuted}
              maxLength={80}
            />
          </Field>

          <Field label="Tipo">
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, type === t.value && styles.typeChipActive]}
                  onPress={() => setType(t.value)}
                >
                  <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Fecha y hora *">
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="2026-06-01 15:00"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </Field>

          <Field label="Tu ciudad *">
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Buenos Aires"
              placeholderTextColor={colors.textMuted}
              maxLength={80}
              autoCorrect={false}
            />
          </Field>

          <Field label="Descripción (opcional)">
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Detalles del evento..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
          </Field>

          <Text style={styles.locationNote}>
            📍 La ubicación exacta se tomará de tu GPS al guardar.
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>Crear evento</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  form: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '22',
  },
  typeChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: colors.primary,
  },
  locationNote: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
});
