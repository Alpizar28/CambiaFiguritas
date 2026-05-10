import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTradeSession } from '../../hooks/useTradeSession';
import { useTradeStore } from '../../store/tradeStore';
import { allStickers } from '../album/data/albumCatalog';
import { CheckCircleIcon } from './components/TradeIcons';
import { colors, radii, spacing } from '../../constants/theme';
import type { TradeStackParamList } from '../../types/navigation';

const stickerById = new Map(allStickers.map((s) => [s.id, s]));

export function TradeCompleteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<TradeStackParamList>>();
  const route = useRoute<RouteProp<TradeStackParamList, 'TradeComplete'>>();
  const { sessionId } = route.params;
  const session = useTradeSession(sessionId);
  const clearTrade = useTradeStore((s) => s.clear);

  useEffect(() => {
    return () => {
      clearTrade();
    };
  }, [clearTrade]);

  const givesFromMe = session?.hostStickers ?? [];
  const givesFromPeer = session?.guestStickers ?? [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <View style={styles.successCard}>
        <CheckCircleIcon size={72} color={colors.primary} />
        <Text style={styles.title}>¡Intercambio cerrado!</Text>
        <Text style={styles.description}>
          Las figuritas se actualizaron en los dos álbumes. Verificá tu progreso cuando quieras.
        </Text>
      </View>

      {session ? (
        <View style={styles.summaryCard}>
          <Text style={styles.sumTitle}>Resumen</Text>
          <Text style={styles.sumLine}>
            {session.hostName} → {session.guestName}: {givesFromMe.length} figus
          </Text>
          <Text style={styles.sumLine}>
            {session.guestName} → {session.hostName}: {givesFromPeer.length} figus
          </Text>
          {(() => {
            const combined = [...givesFromMe, ...givesFromPeer];
            const visible = combined.slice(0, 30);
            const hidden = combined.length - visible.length;
            return (
              <>
                {visible.map((id) => {
                  const s = stickerById.get(id);
                  return (
                    <Text key={id} style={styles.code}>
                      <Text style={styles.codeStrong}>{s?.displayCode ?? id}</Text> {s?.label || s?.countryName || ''}
                    </Text>
                  );
                })}
                {hidden > 0 ? (
                  <Text style={styles.code}>
                    <Text style={styles.codeStrong}>+{hidden} más</Text>
                  </Text>
                ) : null}
              </>
            );
          })()}
        </View>
      ) : null}

      <Pressable
        onPress={() => navigation.replace('TradeHome')}
        style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}
      >
        <Text style={[styles.btnText, styles.btnTextSecondary]}>Otro intercambio</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  successCard: {
    backgroundColor: '#0F2A1A',
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sumTitle: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  sumLine: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 22,
  },
  code: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  codeStrong: {
    color: colors.accent,
    fontWeight: '900',
  },
  btn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  btnText: {
    fontWeight: '900',
    fontSize: 15,
  },
  btnTextSecondary: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.85,
  },
});
