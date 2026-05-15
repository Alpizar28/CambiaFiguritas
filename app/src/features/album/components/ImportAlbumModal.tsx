import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAlbumStore } from '../../../store/albumStore';
import { useWishlistStore } from '../../../store/wishlistStore';
import { track } from '../../../services/analytics';
import { colors, radii, spacing } from '../../../constants/theme';
import { parseAlbumImport, type ImportResult } from '../utils/importParser';

type ImportAlbumModalProps = {
  visible: boolean;
  onClose: () => void;
  source: 'album' | 'profile';
};

const PLACEHOLDER = `Pegá tu lista. Soportamos formato simple o de figuritas.app:

Repetidas
ARG: 1, 3, 5x3, 7-10
BRA: 1, 4, 12
FWC: 00, 3, 7

Busco
ESP: 5, 8
CC: 1, 4`;

export function ImportAlbumModal({ visible, onClose, source }: ImportAlbumModalProps) {
  const insets = useSafeAreaInsets();
  const applyImport = useAlbumStore((s) => s.applyImport);
  const statuses = useAlbumStore((s) => s.statuses);
  const wishlistAdd = useWishlistStore((s) => s.add);

  const [text, setText] = useState('');
  const [replaceMode, setReplaceMode] = useState(false);
  const [addToWishlist, setAddToWishlist] = useState(true);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [showUnknown, setShowUnknown] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const stats = useMemo(() => {
    if (!preview) return null;
    let haveOwned = 0;
    let haveRepeated = 0;
    let alreadyMarked = 0;
    let wantCount = 0;
    for (const item of preview.ok) {
      if (item.section === 'want') {
        wantCount += 1;
      } else if (item.copies >= 2) {
        haveRepeated += 1;
        if (statuses[item.stickerId] !== 'missing') alreadyMarked += 1;
      } else {
        haveOwned += 1;
        if (statuses[item.stickerId] !== 'missing') alreadyMarked += 1;
      }
    }
    return { haveOwned, haveRepeated, alreadyMarked, wantCount };
  }, [preview, statuses]);

  const handlePreview = () => {
    const result = parseAlbumImport(text);
    setPreview(result);
    setShowUnknown(false);
  };

  const handleReset = () => {
    setText('');
    setPreview(null);
    setShowUnknown(false);
  };

  const doApply = () => {
    if (!preview) return;
    applyImport(preview.ok, replaceMode ? 'replace' : 'merge');
    let wishlistAdded = false;
    if (addToWishlist) {
      const wants = preview.ok.filter((i) => i.section === 'want');
      for (const item of wants) wishlistAdd(item.stickerId);
      wishlistAdded = wants.length > 0;
    }
    track({
      name: 'album_import_applied',
      params: {
        mode: replaceMode ? 'replace' : 'merge',
        haveCount: preview.ok.filter((i) => i.section === 'have').length,
        wantCount: preview.ok.filter((i) => i.section === 'want').length,
        unknownCount: preview.unknown.length,
        addedToWishlist: wishlistAdded,
      },
    });
    Alert.alert('Listo', `Se importaron ${preview.ok.length} figus.`);
    handleReset();
    onClose();
  };

  const handleApply = () => {
    if (!preview || preview.ok.length === 0) return;
    if (replaceMode) {
      setConfirmReplace(true);
    } else {
      doApply();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Importar lista</Text>
            <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [pressed && styles.pressed]}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <Text style={styles.helper}>
              Pegá tu lista de otra app (figuritas.app, notas, Excel). Aceptamos varios formatos.
            </Text>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={PLACEHOLDER}
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.textarea}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.toggleRow}>
              <View style={styles.toggleLabelWrap}>
                <Text style={styles.toggleLabel}>Reemplazar todo lo que tengo</Text>
                <Text style={styles.toggleHint}>Borra tu album antes de aplicar.</Text>
              </View>
              <Switch
                value={replaceMode}
                onValueChange={setReplaceMode}
                trackColor={{ false: colors.border, true: '#E8001C' }}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleLabelWrap}>
                <Text style={styles.toggleLabel}>Agregar "Busco" a wishlist</Text>
                <Text style={styles.toggleHint}>Las figus de la sección "Busco" se suman a tu wishlist.</Text>
              </View>
              <Switch
                value={addToWishlist}
                onValueChange={setAddToWishlist}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <Pressable
              onPress={handlePreview}
              disabled={!text.trim()}
              style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed, !text.trim() && styles.btnDisabled]}
            >
              <Text style={styles.btnSecondaryText}>Previsualizar</Text>
            </Pressable>

            {confirmReplace ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>¿Reemplazar todo?</Text>
                <Text style={styles.confirmText}>
                  Esto borra todo lo que tenés marcado y aplica solo la lista nueva.
                </Text>
                <View style={styles.confirmRow}>
                  <Pressable
                    onPress={() => setConfirmReplace(false)}
                    style={({ pressed }) => [styles.btn, styles.btnSecondary, styles.btnFlex, pressed && styles.pressed]}
                  >
                    <Text style={styles.btnSecondaryText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { setConfirmReplace(false); doApply(); }}
                    style={({ pressed }) => [styles.btn, styles.btnDanger, styles.btnFlex, pressed && styles.pressed]}
                  >
                    <Text style={styles.btnDangerText}>Reemplazar</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {preview && stats ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>Previsualización</Text>
                <Text style={styles.previewLine}>Tenidas: <Text style={styles.previewStrong}>{stats.haveOwned}</Text></Text>
                <Text style={styles.previewLine}>Repetidas: <Text style={styles.previewStrong}>{stats.haveRepeated}</Text></Text>
                <Text style={styles.previewLine}>Faltantes (busco): <Text style={styles.previewStrong}>{stats.wantCount}</Text></Text>
                {stats.alreadyMarked > 0 && !replaceMode ? (
                  <Text style={styles.previewHint}>{stats.alreadyMarked} ya las tenías marcadas.</Text>
                ) : null}
                {preview.unknown.length > 0 ? (
                  <View>
                    <Pressable onPress={() => setShowUnknown((v) => !v)}>
                      <Text style={styles.previewWarn}>
                        Códigos no reconocidos: {preview.unknown.length} {showUnknown ? '▾' : '▸'}
                      </Text>
                    </Pressable>
                    {showUnknown ? (
                      <Text style={styles.previewUnknownList}>{preview.unknown.join(', ')}</Text>
                    ) : null}
                  </View>
                ) : null}
                {preview.errors.length > 0 ? (
                  <Text style={styles.previewWarn}>Líneas con error: {preview.errors.length}</Text>
                ) : null}

                <Pressable
                  onPress={handleApply}
                  disabled={preview.ok.length === 0}
                  style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed, preview.ok.length === 0 && styles.btnDisabled]}
                >
                  <Text style={styles.btnPrimaryText}>
                    Aplicar {preview.ok.length} figus
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  closeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.text,
    padding: spacing.md,
    fontSize: 14,
    minHeight: 200,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  toggleLabelWrap: {
    flex: 1,
  },
  toggleLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  toggleHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  btn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  btnPrimaryText: {
    color: '#001A0A',
    fontWeight: '900',
    fontSize: 15,
  },
  btnSecondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  btnSecondaryText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  previewBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  previewTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  previewLine: {
    color: colors.text,
    fontSize: 14,
  },
  previewStrong: {
    fontWeight: '900',
    color: colors.primary,
  },
  previewHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  previewWarn: {
    color: '#FFB85C',
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  previewUnknownList: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  pressed: {
    opacity: 0.85,
  },
  confirmBox: {
    backgroundColor: colors.surface,
    borderColor: '#E8001C',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  confirmTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  confirmText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btnFlex: {
    flex: 1,
  },
  btnDanger: {
    backgroundColor: '#E8001C',
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
});
