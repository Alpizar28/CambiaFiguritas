import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, View, StyleSheet } from 'react-native';
import {
  NavigationContainer,
  NavigationIndependentTree,
  DarkTheme,
} from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { navigationRef } from './navigationRef';

import { colors } from '../constants/theme';
import { track } from '../services/analytics';
import { AlbumScreen } from '../features/album/AlbumScreen';
import { EventsScreen } from '../features/events/EventsScreen';
import { MatchesNavigator } from '../features/matching/MatchesNavigator';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { RankingsScreen } from '../features/rankings/RankingsScreen';
import { PublicAlbumScreen } from '../features/share/PublicAlbumScreen';
import { TradeNavigator } from '../features/trade/TradeNavigator';
import { useTradeStore } from '../store/tradeStore';
import {
  AlbumIcon,
  EventsIcon,
  MatchesIcon,
  ProfileIcon,
  RankingsIcon,
} from '../components/icons/TabIcons';
import type { RootTabParamList, TradeStackParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<RootTabParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    border: colors.border,
    card: colors.surface,
    primary: colors.primary,
    text: colors.text,
  },
};

const TAB_ICONS = {
  Album: AlbumIcon,
  Matches: MatchesIcon,
  Events: EventsIcon,
  Rankings: RankingsIcon,
  Profile: ProfileIcon,
} as const;

const linking: LinkingOptions<RootTabParamList> = {
  prefixes: ['cambiafiguritas://', 'https://cambiafiguritas.online'],
  config: {
    screens: {
      Album: 'album',
      Matches: 'matches',
      Events: 'eventos',
      Rankings: 'ranking',
      Profile: 'perfil',
    },
  },
  getInitialURL: async () => {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get('u');
      if (uid) return `cambiafiguritas://u/${uid}`;
      const pathMatch = window.location.pathname.match(/^\/u\/([^/]+)$/);
      if (pathMatch) return `cambiafiguritas://u/${pathMatch[1]}`;
      const tradeMatch = window.location.pathname.match(/^\/trade\/([A-Z0-9]{6})$/i);
      if (tradeMatch) return `cambiafiguritas://trade/${tradeMatch[1]}`;
      return null;
    }
    return (await Linking.getInitialURL()) ?? null;
  },
};

export function AppNavigator() {
  const previousRoute = useRef<string | undefined>(undefined);
  const [publicAlbumUid, setPublicAlbumUid] = useState<string | null>(null);
  const tradeIntent = useTradeStore((s) => s.modalIntent);
  const openTradeModal = useTradeStore((s) => s.openModal);
  const closeTradeModal = useTradeStore((s) => s.closeModal);

  const handleDeepLink = (url: string | null) => {
    if (!url) return;
    const tradeMatch = url.match(/\/trade\/([A-Z0-9]{6})/i);
    if (tradeMatch?.[1]) {
      openTradeModal({ kind: 'join', prefilledCode: tradeMatch[1].toUpperCase() });
      return;
    }
    const match = url.match(/\/u\/([a-zA-Z0-9_-]+)/);
    if (match?.[1]) {
      setPublicAlbumUid(match[1]);
    }
  };

  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
    return () => sub.remove();
  }, []);

  const onStateChange = () => {
    const current = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
    if (current && current !== previousRoute.current) {
      track({ name: 'screen_view', params: { screen: current } });
      previousRoute.current = current;
    }
  };

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        linking={linking}
        onReady={() => {
          onStateChange();
          const initial = linking.getInitialURL?.();
          if (initial) {
            Promise.resolve(initial).then((url) => handleDeepLink(url ?? null));
          }
        }}
        onStateChange={onStateChange}
      >
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#FFD600',
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '700',
              marginTop: -2,
            },
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingTop: 6,
              paddingBottom: 8,
              height: 62,
            },
            tabBarIcon: ({ focused }) => {
              const Icon = TAB_ICONS[route.name];
              return <Icon size={28} active={focused} />;
            },
          })}
        >
          <Tab.Screen
            name="Album"
            component={AlbumScreen}
            options={{ title: 'Album' }}
          />
          <Tab.Screen
            name="Matches"
            component={MatchesNavigator}
            options={{ title: 'Matches' }}
          />
          <Tab.Screen
            name="Events"
            component={EventsScreen}
            options={{ title: 'Eventos' }}
          />
          <Tab.Screen
            name="Rankings"
            component={RankingsScreen}
            options={{ title: 'Ranking' }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: 'Perfil' }}
          />
        </Tab.Navigator>
      </NavigationContainer>

      {publicAlbumUid ? (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setPublicAlbumUid(null)}
        >
          <View style={styles.modalFull}>
            <PublicAlbumScreen
              uid={publicAlbumUid}
              onExitToApp={() => setPublicAlbumUid(null)}
            />
          </View>
        </Modal>
      ) : null}

      {tradeIntent ? (
        <Modal visible animationType="slide" onRequestClose={closeTradeModal}>
          <View style={styles.modalFull}>
            <NavigationIndependentTree>
              <NavigationContainer theme={navigationTheme}>
                <TradeNavigator
                  initialRoute={tradeIntent.kind === 'join' ? 'TradeJoin' : 'TradeHome'}
                  initialParams={
                    tradeIntent.kind === 'join'
                      ? ({ prefilledCode: tradeIntent.prefilledCode } as TradeStackParamList['TradeJoin'])
                      : undefined
                  }
                />
              </NavigationContainer>
            </NavigationIndependentTree>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  modalFull: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
