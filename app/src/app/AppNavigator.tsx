import { useRef } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '../constants/theme';
import { track } from '../services/analytics';
import { AlbumScreen } from '../features/album/AlbumScreen';
import { EventsScreen } from '../features/events/EventsScreen';
import { MatchesScreen } from '../features/matching/MatchesScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { RankingsScreen } from '../features/rankings/RankingsScreen';
import {
  AlbumIcon,
  EventsIcon,
  MatchesIcon,
  ProfileIcon,
  RankingsIcon,
} from '../components/icons/TabIcons';
import type { RootTabParamList } from '../types/navigation';

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

export function AppNavigator() {
  const navRef = useRef<NavigationContainerRef<RootTabParamList>>(null);
  const previousRoute = useRef<string | undefined>(undefined);

  const onStateChange = () => {
    const current = navRef.current?.getCurrentRoute()?.name;
    if (current && current !== previousRoute.current) {
      track({ name: 'screen_view', params: { screen: current } });
      previousRoute.current = current;
    }
  };

  return (
    <NavigationContainer
      ref={navRef}
      theme={navigationTheme}
      onReady={onStateChange}
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
          component={MatchesScreen}
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
  );
}
