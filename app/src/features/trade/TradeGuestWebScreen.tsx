import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';

import {
  fetchGuestSession,
  submitGuestOffer,
  type GuestMatchedExchange,
  type GuestSessionView,
} from '../../services/guestTradeService';
import { GuestListInput } from './components/GuestListInput';
import { MatchResultPanel } from './components/MatchResultPanel';
import { colors, radii, spacing } from '../../constants/theme';
import type { TradeStackParamList } from '../../types/navigation';

export function TradeGuestWebScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<TradeStackParamList, 'TradeGuestWeb'>>();
  const token = route.params?.token ?? '';

  const [session, setSession] = useState<GuestSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [repeatedText, setRepeatedText] = useState('');
  const [missingText, setMissingText] = useState('');
  const [parsed, setParsed] = useState<{ repeated: string[]; missing: string[]; unknown: string[] }>({
    repeated: [],
    missing: [],
    unknown: [],
  });
  const [contact, setContact] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [matched, setMatched] = useState<GuestMatchedExchange | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGuestSession(token)
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setLoadError(null);
        if (s.matchedExchange) setMatched(s.matchedExchange);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'No se pudo cargar el intercambio.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSubmit = parsed.repeated.length > 0 && !submitting;
  const partialMatch = parsed.repeated.length > 0 && parsed.missing.length === 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const combinedRaw = `# Repetidas\n${repeatedText}\n\n# Faltantes\n${missingText}`.slice(0, 20000);
      const r = await submitGuestOffer({
        token,
        rawText: combinedRaw,
        repeated: parsed.repeated,
        missing: parsed.missing,
        contact: contact.trim() || undefined,
      });
      setMatched(r.matched);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'No se pudo enviar la propuesta.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, token, repeatedText, missingText, parsed, contact]);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (loadError || !session) {
    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>Link inválido o expirado</Text>
        <Text style={styles.subtitle}>{loadError ?? 'No encontramos el intercambio.'}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl + insets.bottom },
      ]}
    >
      <Text style={styles.eyebrow}>Intercambio con {session.host.name}</Text>
      <Text style={styles.title}>¿Qué tenés vos?</Text>
      <Text style={styles.subtitle}>
        {session.host.name} ofrece <Text style={styles.bold}>{session.hostStickers.length}</Text>{' '}
        repetidas y busca <Text style={styles.bold}>{session.hostNeeds.length}</Text> que le
        faltan. Pegá abajo tu lista y te muestro qué pueden intercambiar.
      </Text>

      {matched ? (
        <MatchResultPanel hostName={session.host.name} matched={matched} />
      ) : (
        <>
          <GuestListInput
            repeatedText={repeatedText}
            missingText={missingText}
            onChangeRepeated={setRepeatedText}
            onChangeMissing={setMissingText}
            onParsed={setParsed}
          />

          {partialMatch ? (
            <Text style={styles.partialHint}>
              Sin faltantes vas a ver solo lo que vos le pasás al host. Para un match completo
              llená también el segundo campo.
            </Text>
          ) : null}

          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Tu nombre o WhatsApp (opcional)</Text>
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder="Ej: Pablo / +54 9 11 …"
              placeholderTextColor={colors.textMuted}
              style={styles.contactInput}
              maxLength={120}
            />
            <Text style={styles.contactHint}>
              Solo se usa para que {session.host.name} sepa con quién hablar.
            </Text>
          </View>

          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.cta,
              styles.ctaPrimary,
              pressed && styles.pressed,
              !canSubmit && styles.disabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#001A0A" />
            ) : (
              <Text style={styles.ctaTitle}>Ver intercambio sugerido</Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  bold: { color: colors.accent, fontWeight: '800' },
  contactRow: { gap: spacing.xs, marginTop: spacing.sm },
  contactLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  contactInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  contactHint: { color: colors.textMuted, fontSize: 11 },
  cta: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  ctaTitle: { color: '#001A0A', fontSize: 17, fontWeight: '900' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  errorText: {
    color: '#E54848',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  partialHint: {
    color: '#E89E2A',
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
});
