import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { adUnitIds } from '../services/ads';

type Props = {
  inline?: boolean;
};

// En Expo Go el módulo nativo de AdMob no está enlazado. Renderizar nada para evitar crash.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let initialized = false;

export function AdBanner({ inline = false }: Props) {
  if (isExpoGo) return null;
  return <NativeAd inline={inline} />;
}

function NativeAd({ inline }: Props) {
  const [ready, setReady] = useState(initialized);
  const [components, setComponents] = useState<{ BannerAd: any; BannerAdSize: any } | null>(null);

  useEffect(() => {
    if (isExpoGo) return;
    let cancelled = false;
    (async () => {
      try {
        const mod = require('react-native-google-mobile-ads');
        const init = mod.default;
        if (!initialized) {
          await init().initialize();
          initialized = true;
        }
        if (!cancelled) {
          setComponents({ BannerAd: mod.BannerAd, BannerAdSize: mod.BannerAdSize });
          setReady(true);
        }
      } catch {
        // Si falla, queda en no-op silencioso.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready || !components) return null;
  const { BannerAd, BannerAdSize } = components;

  return (
    <View style={[styles.container, inline && styles.inline]}>
      <BannerAd
        unitId={adUnitIds.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  inline: {
    paddingVertical: 8,
  },
});
