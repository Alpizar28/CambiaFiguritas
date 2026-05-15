import { useCallback, useRef, useState, memo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { shareTradeCard } from '../../utils/shareTradeCard';

import { useAlbumStore } from '../../store/albumStore';
import { parseAlbumImport } from '../album/utils/importParser';
import { buildListCompareResult, buildShareText } from './utils/listCompare';
import { CountryCompareRow } from '../matching/components/CountryCompareRow';
import { track } from '../../services/analytics';
import { colors, radii, spacing } from '../../constants/theme';
import type { TradeStackParamList } from '../../types/navigation';
import type { ListCompareResult } from './utils/listCompare';

type Phase = 'input' | 'results';

export function TradeListCompareScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<TradeStackParamList>>();
  const statuses = useAlbumStore((s) => s.statuses);
  const applyImport = useAlbumStore((s) => s.applyImport);
  const setStatus = useAlbumStore((s) => s.setStatus);

  const [phase, setPhase] = useState<Phase>('input');
  const [rawText, setRawText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ListCompareResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const undoSnapshot = useRef<Array<{ stickerId: string; status: import('../album/types').StickerStatus }> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleCompare = useCallback(() => {
    const parsed = parseAlbumImport(rawText);
    if (parsed.ok.length === 0) {
      setParseError('No reconocimos ninguna figura en ese texto. Revisá el formato (ej: ARG: 1, 3, 5).');
      return;
    }
    setParseError(null);
    const compareResult = buildListCompareResult(parsed.ok, statuses);
    setResult(compareResult);
    setPhase('results');
    track({
      name: 'trade_list_compare_run',
      params: {
        parsedCount: parsed.ok.length,
        iNeedCount: compareResult.iNeed.length,
        unknownCount: parsed.unknown.length,
      },
    });
  }, [rawText, statuses]);

  const handleShare = useCallback(async () => {
    if (!result) return;
    const text = buildShareText(result.iNeed, result.countryRows);
    const shareResult = await shareTradeCard(result.iNeed, text);
    if (shareResult === 'shared' || shareResult === 'text_shared') showToast('¡Compartido!');
    else if (shareResult === 'downloaded') showToast('¡Imagen descargada!');
    track({ name: 'trade_list_compare_copied' });
  }, [result, showToast]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const text = buildShareText(result.iNeed, result.countryRows);
    await Clipboard.setStringAsync(text);
    showToast('¡Copiado!');
    track({ name: 'trade_list_compare_copied' });
  }, [result, showToast]);

  const handleMarkReceived = useCallback(() => {
    if (!result || result.needItems.length === 0) return;
    const missingOnly = result.needItems.filter((item) => {
      const myStatus = statuses[item.stickerId] ?? 'missing';
      return myStatus === 'missing';
    });
    if (missingOnly.length === 0) {
      Alert.alert('Sin cambios', 'Todas esas figuras ya las tenés marcadas.');
      return;
    }
    Alert.alert(
      'Marcar como recibidas',
      `¿Marcás ${missingOnly.length} figura${missingOnly.length !== 1 ? 's' : ''} como recibidas en tu álbum?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            undoSnapshot.current = missingOnly.map((item) => ({
              stickerId: item.stickerId,
              status: statuses[item.stickerId] ?? 'missing',
            }));
            applyImport(missingOnly, 'merge');
            track({ name: 'trade_list_compare_marked_received', params: { count: missingOnly.length } });
            showToast(`${missingOnly.length} figura${missingOnly.length !== 1 ? 's' : ''} marcadas ✓`);
            setPhase('input');
            setRawText('');
            setResult(null);
          },
        },
      ],
    );
  }, [result, statuses, applyImport, showToast]);

  const handleUndo = useCallback(() => {
    const snapshot = undoSnapshot.current;
    if (!snapshot) return;
    for (const { stickerId, status } of snapshot) {
      setStatus(stickerId, status);
    }
    undoSnapshot.current = null;
    showToast('Deshecho');
  }, [setStatus, showToast]);

  const handleReset = useCallback(() => {
    setPhase('input');
    setRawText('');
    setResult(null);
    setParseError(null);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={10}
        >
          <Text style={styles.backBtnText}>‹ Volver</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Comparar lista</Text>
          <Text style={styles.title}>¿Qué te sirve?</Text>
          <Text style={styles.description}>
            Pegá la lista de WhatsApp de otro coleccionista. Te decimos cuáles de sus figus te faltan.
          </Text>
        </View>

        {phase === 'input' && undoSnapshot.current ? (
          <Pressable
            onPress={handleUndo}
            style={({ pressed }) => [styles.undoBtn, pressed && styles.pressed]}
          >
            <Text style={styles.undoBtnText}>↩ Deshacer último marcado</Text>
          </Pressable>
        ) : null}

        {phase === 'input' ? (
          <View style={styles.inputSection}>
            <TextInput
              style={styles.textarea}
              multiline
              numberOfLines={8}
              placeholder={'ARG: 1, 3, 5\nBRA: 2, 7\nFWC: 3, 11...'}
              placeholderTextColor={colors.textMuted}
              value={rawText}
              onChangeText={setRawText}
              autoCapitalize="characters"
              autoCorrect={false}
              textAlignVertical="top"
            />
            <FormatsHint />
            {parseError ? (
              <Text style={styles.errorText}>{parseError}</Text>
            ) : null}
            <Pressable
              onPress={handleCompare}
              disabled={rawText.trim().length === 0}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                pressed && styles.pressed,
                rawText.trim().length === 0 && styles.disabled,
              ]}
            >
              <Text style={styles.btnTextPrimary}>Comparar</Text>
            </Pressable>
          </View>
        ) : result ? (
          <View style={styles.resultsSection}>
            <View style={styles.summaryRow}>
              <View style={[styles.chip, result.iNeed.length > 0 ? styles.chipGreen : styles.chipMuted]}>
                <Text style={[styles.chipText, result.iNeed.length > 0 ? styles.chipTextGreen : styles.chipTextMuted]}>
                  {result.iNeed.length} me sirven
                </Text>
              </View>
              {result.iCanGive.length > 0 ? (
                <View style={[styles.chip, styles.chipOrange]}>
                  <Text style={[styles.chipText, styles.chipTextOrange]}>
                    {result.iCanGive.length} le puedo dar
                  </Text>
                </View>
              ) : null}
            </View>

            {result.iNeed.length > 0 ? (
              <View style={styles.needList}>
                <Text style={styles.sectionLabel}>Me sirven de su lista</Text>
                <View style={styles.chipsWrap}>
                  {result.iNeed.map((code) => (
                    <View key={code} style={styles.stickerChip}>
                      <Text style={styles.stickerChipText}>{code}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>No te sirve ninguna de esa lista. Probá con otra.</Text>
            )}

            {result.iCanGiveByCountry.length > 0 ? (
              <View style={styles.needList}>
                <Text style={[styles.sectionLabel, { color: colors.warning }]}>Le puedo dar (mis repes que busca)</Text>
                {result.iCanGiveByCountry.map((row) => (
                  <View key={row.code} style={styles.giveCountryRow}>
                    <Text style={styles.giveCountryLabel}>{row.flag} {row.code}</Text>
                    <View style={styles.chipsWrap}>
                      {row.codes.map((code) => (
                        <View key={code} style={[styles.stickerChip, styles.stickerChipOrange]}>
                          <Text style={[styles.stickerChipText, styles.stickerChipTextOrange]}>{code}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.actionRow}>
              {result.iNeed.length > 0 ? (
                <>
                  <View style={styles.shareRow}>
                    <Pressable
                      onPress={handleShare}
                      style={({ pressed }) => [styles.btn, styles.btnSecondary, styles.btnFlex, pressed && styles.pressed]}
                    >
                      <Text style={styles.btnTextSecondary}>Compartir</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCopy}
                      style={({ pressed }) => [styles.btn, styles.btnGhost, styles.btnFlex, pressed && styles.pressed]}
                    >
                      <Text style={styles.btnTextGhost}>Copiar texto</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={handleMarkReceived}
                    style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
                  >
                    <Text style={styles.btnTextPrimary}>Marcar como recibidas</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable
                onPress={handleReset}
                style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
              >
                <Text style={styles.btnTextGhost}>Comparar otra lista</Text>
              </Pressable>
            </View>

            {(() => {
              const desgloseRows = result.iCanGive.length > 0
                ? result.countryRows.filter((row) => row.theyNeedFromMe.length > 0)
                : result.countryRows;
              return desgloseRows.length > 0 ? (
                <>
                  <View style={styles.divider}>
                    <Text style={styles.dividerText}>Desglose por país</Text>
                  </View>
                  <View style={styles.countryRows}>
                    {desgloseRows.map((row) => (
                      <CountryCompareRow
                        key={row.countryId}
                        data={row}
                        defaultExpanded={result.iCanGive.length > 0}
                      />
                    ))}
                  </View>
                </>
              ) : null;
            })()}
          </View>
        ) : null}
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const FORMATS = [
  { label: 'Por país', example: 'ARG: 1, 3, 5' },
  { label: 'Especiales', example: 'FWC: 1, 3, 11' },
  { label: 'Coca-Cola', example: 'CC: 2, 5, 8' },
  { label: 'Rango', example: 'BRA: 1-10' },
  { label: 'Con copias', example: 'MEX: 4x2, 7x3' },
  { label: 'Sección Repetidas', example: 'Repetidas:\nARG: 1, 5' },
  { label: 'Sección Busco', example: 'Busco:\nURU: 3, 9' },
  { label: 'Emojis / URLs', example: 'Se ignoran solos' },
];

const FormatsHint = memo(function FormatsHint() {
  const [open, setOpen] = useState(false);
  return (
    <View style={hintStyles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [hintStyles.toggle, pressed && { opacity: 0.7 }]}
      >
        <Text style={hintStyles.toggleText}>{open ? '▾' : '▸'} Formatos aceptados</Text>
      </Pressable>
      {open ? (
        <View style={hintStyles.body}>
          {FORMATS.map((f) => (
            <View key={f.label} style={hintStyles.row}>
              <Text style={hintStyles.label}>{f.label}</Text>
              <Text style={hintStyles.example}>{f.example}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const hintStyles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    width: 110,
    paddingTop: 2,
  },
  example: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  undoBtn: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: `${colors.warning}18`,
    alignItems: 'center',
  },
  undoBtnText: {
    color: colors.warning,
    fontWeight: '700',
    fontSize: 14,
  },
  inputSection: {
    gap: spacing.md,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 160,
    fontFamily: 'monospace',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  btn: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  btnSecondary: {
    backgroundColor: colors.card,
    borderColor: colors.secondary,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  btnTextPrimary: {
    color: '#001A0A',
    fontWeight: '900',
    fontSize: 16,
  },
  btnTextSecondary: {
    color: colors.secondary,
    fontWeight: '800',
    fontSize: 15,
  },
  btnTextGhost: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 14,
  },
  resultsSection: {
    gap: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  chipGreen: {
    backgroundColor: `${colors.primary}22`,
    borderColor: colors.primary,
  },
  chipMuted: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  chipOrange: {
    backgroundColor: `${colors.warning}22`,
    borderColor: colors.warning,
  },
  chipText: {
    fontWeight: '800',
    fontSize: 15,
  },
  chipTextGreen: {
    color: colors.primary,
  },
  chipTextMuted: {
    color: colors.textMuted,
  },
  chipTextOrange: {
    color: colors.warning,
  },
  needList: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stickerChip: {
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  stickerChipText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  stickerChipOrange: {
    borderColor: colors.warning,
  },
  stickerChipTextOrange: {
    color: colors.warning,
  },
  giveCountryRow: {
    gap: spacing.xs,
  },
  giveCountryLabel: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionRow: {
    gap: spacing.sm,
  },
  shareRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btnFlex: {
    flex: 1,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  divider: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  countryRows: {
    gap: spacing.sm,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  toastText: {
    color: '#001A0A',
    fontWeight: '900',
    fontSize: 14,
  },
});
