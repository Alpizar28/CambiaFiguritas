import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootTabParamList } from '../types/navigation';

export const navigationRef = createNavigationContainerRef<RootTabParamList>();

export function navigateToTab(tabName: keyof RootTabParamList): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate(tabName as never);
  }
}
