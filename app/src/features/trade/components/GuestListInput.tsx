import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { parseAlbumImport, type ImportSection } from '../../album/utils/importParser';
import { colors, radii, spacing } from '../../../constants/theme';

type ParsedShape = {
  repeated: string[];
  missing: string[];
  unknown: string[];
};

type GuestListInputProps = {
  repeatedText: string;
  missingText: string;
  onChangeRepeated: (next: string) => void;
  onChangeMissing: (next: string) => void;
  onParsed: (parsed: ParsedShape) => void;
};

function parseField(value: string, section: ImportSection): { ids: string[]; unknown: string[] } {
  if (!value.trim()) return { ids: [], unknown: [] };
  const r = parseAlbumImport(value, { forceSection: section });
  return {
    ids: r.ok.map((i) => i.stickerId),
    unknown: r.unknown,
  };
}

export function GuestListInput({
  repeatedText,
  missingText,
  onChangeRepeated,
  onChangeMissing,
  onParsed,
}: GuestListInputProps) {
  const [touchedRepeated, setTouchedRepeated] = useState(false);
  const [touchedMissing, setTouchedMissing] = useState(false);

  const repeatedParsed = useMemo(() => parseField(repeatedText, 'have'), [repeatedText]);
  const missingParsed = useMemo(() => parseField(missingText, 'want'), [missingText]);

  const propagate = (next?: Partial<ParsedShape>) => {
    const combined: ParsedShape = {
      repeated: next?.repeated ?? repeatedParsed.ids,
      missing: next?.missing ?? missingParsed.ids,
      unknown: [
        ...(next?.unknown ?? repeatedParsed.unknown),
        ...missingParsed.unknown,
      ],
    };
    onParsed(combined);
  };

  const handleBlurRepeated = () => {
    setTouchedRepeated(true);
    propagate();
  };
  const handleBlurMissing = () => {
    setTouchedMissing(true);
    propagate();
  };

  return (
    <View style={styles.container}>
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Tus repetidas (lo que ofrecés)</Text>
        <Text style={styles.help}>
          Pegá las figuritas que te sobran. Formato libre:{' '}
          <Text style={styles.code}>MEX: 1, 5, 19</Text>,{' '}
          <Text style={styles.code}>BRA1 (x3)</Text>,{' '}
          <Text style={styles.code}>FWC9</Text>.
        </Text>
        <TextInput
          value={repeatedText}
          onChangeText={onChangeRepeated}
          onBlur={handleBlurRepeated}
          placeholder={'MEX: 1, 5\nBRA: 12 (x2)\nFWC9'}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={styles.input}
        />
        {touchedRepeated && repeatedText.trim().length > 0 ? (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              Detecté <Text style={styles.bold}>{repeatedParsed.ids.length}</Text> repetidas.
            </Text>
            {repeatedParsed.unknown.length > 0 ? (
              <Text style={styles.warn}>
                ⚠ {repeatedParsed.unknown.length} no las reconocí:{' '}
                {repeatedParsed.unknown.slice(0, 8).join(', ')}
                {repeatedParsed.unknown.length > 8 ? '…' : ''}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Tus faltantes (lo que buscás) — opcional</Text>
        <Text style={styles.help}>
          Pegá las figuritas que te faltan. Si lo dejás vacío, sólo verás qué le pasás al
          host. Llenalo para que el host también te dé.
        </Text>
        <TextInput
          value={missingText}
          onChangeText={onChangeMissing}
          onBlur={handleBlurMissing}
          placeholder={'ARG: 10, 13\nGER5'}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={styles.input}
        />
        {touchedMissing && missingText.trim().length > 0 ? (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              Detecté <Text style={styles.bold}>{missingParsed.ids.length}</Text> que buscás.
            </Text>
            {missingParsed.unknown.length > 0 ? (
              <Text style={styles.warn}>
                ⚠ {missingParsed.unknown.length} no las reconocí:{' '}
                {missingParsed.unknown.slice(0, 8).join(', ')}
                {missingParsed.unknown.length > 8 ? '…' : ''}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  fieldBlock: { gap: spacing.xs },
  label: { color: colors.text, fontSize: 15, fontWeight: '800' },
  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  code: {
    fontFamily: 'monospace',
    backgroundColor: colors.surface,
    color: colors.accent,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 160,
    padding: spacing.md,
    fontFamily: 'monospace',
  },
  summary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  summaryText: { color: colors.text, fontSize: 13 },
  bold: { fontWeight: '800', color: colors.accent },
  warn: { color: '#E89E2A', fontSize: 12 },
});
