import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { colors, radii, spacing } from '../../constants/theme';
import type { ScannedCandidate } from './types';

type Props = {
  visible: boolean;
  candidates: ScannedCandidate[];
  selected: Set<string>;
  onToggle: (stickerId: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onAddManual: (rawCode: string) => boolean;
};

function describeAction(candidate: ScannedCandidate): string {
  if (candidate.currentStatus === 'missing') {
    return 'Marcar como tenida';
  }
  if (candidate.currentStatus === 'special') {
    const next = candidate.currentRepeatedCount + 1;
    return `+1 especial (×${next})`;
  }
  const next = candidate.currentRepeatedCount + 1;
  return `+1 repetida (×${next})`;
}

function describeStatus(candidate: ScannedCandidate): string {
  switch (candidate.currentStatus) {
    case 'missing':
      return 'faltante';
    case 'owned':
      return 'ya la tenés';
    case 'repeated':
      return `repetida ×${candidate.currentRepeatedCount || 1}`;
    case 'special':
      return 'especial';
  }
}

export function ScanResultSheet({
  visible,
  candidates,
  selected,
  onToggle,
  onConfirm,
  onDismiss,
  onAddManual,
}: Props) {
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const selectedCount = candidates.filter((c) => selected.has(c.stickerId)).length;

  const submitManual = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) {
      setManualError('Escribí un código.');
      return;
    }
    const ok = onAddManual(trimmed);
    if (!ok) {
      setManualError(`Código "${trimmed}" no válido.`);
      return;
    }
    setManualCode('');
    setManualError(null);
    setManualMode(false);
  };

  return (
    <BottomSheet visible={visible} onClose={onDismiss}>
      <Text style={styles.title}>Figuritas detectadas</Text>
      <Text style={styles.subtitle}>
        Revisá y tocá para incluir o excluir antes de guardar. Nada se agrega
        automáticamente.
      </Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {candidates.map((candidate) => {
          const isSelected = selected.has(candidate.stickerId);
          return (
            <Pressable
              key={candidate.stickerId}
              style={[styles.item, isSelected && styles.itemSelected]}
              onPress={() => onToggle(candidate.stickerId)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <View
                style={[
                  styles.checkbox,
                  isSelected && styles.checkboxChecked,
                ]}
              >
                {isSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {candidate.sticker.displayCode}
                  {candidate.sticker.countryName
                    ? ` · ${candidate.sticker.countryName}`
                    : ''}
                </Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {describeStatus(candidate)}  ·  {describeAction(candidate)}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {manualMode ? (
          <View style={styles.manualBlock}>
            <Text style={styles.manualLabel}>Código manual</Text>
            <TextInput
              value={manualCode}
              onChangeText={(v) => {
                setManualCode(v);
                setManualError(null);
              }}
              placeholder="Ej: ARG17, BRA 2, FWC1"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.manualInput}
              onSubmitEditing={submitManual}
              returnKeyType="done"
            />
            {manualError ? (
              <Text style={styles.manualError}>{manualError}</Text>
            ) : null}
            <View style={styles.manualButtons}>
              <Pressable style={styles.secondaryBtn} onPress={() => setManualMode(false)}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.secondaryPrimaryBtn} onPress={submitManual}>
                <Text style={styles.secondaryPrimaryBtnText}>Agregar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.manualToggle}
            onPress={() => setManualMode(true)}
            accessibilityRole="button"
          >
            <Text style={styles.manualToggleText}>+ Agregar código manual</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.discardBtn}
          onPress={onDismiss}
          accessibilityRole="button"
        >
          <Text style={styles.discardBtnText}>Descartar</Text>
        </Pressable>
        <Pressable
          style={[
            styles.confirmBtn,
            selectedCount === 0 && styles.confirmBtnDisabled,
          ]}
          onPress={onConfirm}
          disabled={selectedCount === 0}
          accessibilityRole="button"
        >
          <Text style={styles.confirmBtnText}>
            {selectedCount === 0
              ? 'Seleccioná al menos una'
              : `Agregar ${selectedCount} al álbum`}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemSelected: {
    borderColor: colors.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  manualToggle: {
    paddingVertical: spacing.sm,
  },
  manualToggleText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  manualBlock: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  manualLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  manualInput: {
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
  },
  manualError: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  manualButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryBtnText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  secondaryPrimaryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
  },
  secondaryPrimaryBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  discardBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  discardBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: colors.border,
  },
  confirmBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
