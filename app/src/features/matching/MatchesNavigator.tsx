import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MatchesScreen } from './MatchesScreen';
import { MatchProfileScreen } from './MatchProfileScreen';
import { colors } from '../../constants/theme';
import type { MatchesStackParamList } from '../../types/navigation';

const Stack = createNativeStackNavigator<MatchesStackParamList>();

export function MatchesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="MatchesList" component={MatchesScreen} />
      <Stack.Screen name="MatchProfile" component={MatchProfileScreen} />
    </Stack.Navigator>
  );
}
