import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

if (Platform.OS === 'web') {
  document.documentElement.style.backgroundColor = '#0A0A0A';
  document.body.style.backgroundColor = '#0A0A0A';
}

registerRootComponent(App);
