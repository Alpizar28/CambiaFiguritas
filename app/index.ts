import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

if (Platform.OS === 'web') {
  document.documentElement.style.backgroundColor = '#0A0A0A';
  document.body.style.backgroundColor = '#0A0A0A';

  // Safari iOS: habilitar scroll suave en elementos con overflow scroll
  const safariScrollStyle = document.createElement('style');
  safariScrollStyle.textContent = `
    * { -webkit-overflow-scrolling: touch; box-sizing: border-box; }
    input, textarea { font-size: 16px !important; }
  `;
  document.head.appendChild(safariScrollStyle);
}

registerRootComponent(App);
