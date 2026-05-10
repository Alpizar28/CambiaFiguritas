import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'qrcode';
import { colors } from '../../../constants/theme';

type QRDisplayProps = {
  value: string;
  size?: number;
};

export function QRDisplay({ value, size = 220 }: QRDisplayProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    }).catch((e) => console.error('[trade] qr render error', e));
  }, [value, size]);

  return (
    <View style={[styles.container, { padding: 12 }]}>
      {/* eslint-disable-next-line react/forbid-elements */}
      <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
  },
});
