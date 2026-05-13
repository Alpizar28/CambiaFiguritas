import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TradeHomeScreen } from './TradeHomeScreen';
import { TradeHostScreen } from './TradeHostScreen';
import { TradeJoinScreen } from './TradeJoinScreen';
import { TradeSelectScreen } from './TradeSelectScreen';
import { TradeReviewScreen } from './TradeReviewScreen';
import { TradeCompleteScreen } from './TradeCompleteScreen';
import { TradeShareScreen } from './TradeShareScreen';
import { TradeGuestWebScreen } from './TradeGuestWebScreen';
import { colors } from '../../constants/theme';
import type { TradeStackParamList } from '../../types/navigation';

const Stack = createNativeStackNavigator<TradeStackParamList>();

type TradeNavigatorProps = {
  initialRoute?: keyof TradeStackParamList;
  initialParams?: TradeStackParamList[keyof TradeStackParamList];
};

export function TradeNavigator({ initialRoute = 'TradeHome', initialParams }: TradeNavigatorProps) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="TradeHome" component={TradeHomeScreen} />
      <Stack.Screen name="TradeHost" component={TradeHostScreen} />
      <Stack.Screen
        name="TradeJoin"
        component={TradeJoinScreen}
        initialParams={initialRoute === 'TradeJoin' ? (initialParams as TradeStackParamList['TradeJoin']) : undefined}
      />
      <Stack.Screen name="TradeSelect" component={TradeSelectScreen} />
      <Stack.Screen name="TradeReview" component={TradeReviewScreen} />
      <Stack.Screen name="TradeComplete" component={TradeCompleteScreen} />
      <Stack.Screen name="TradeShare" component={TradeShareScreen} />
      <Stack.Screen
        name="TradeGuestWeb"
        component={TradeGuestWebScreen}
        initialParams={
          initialRoute === 'TradeGuestWeb'
            ? (initialParams as TradeStackParamList['TradeGuestWeb'])
            : undefined
        }
      />
    </Stack.Navigator>
  );
}
