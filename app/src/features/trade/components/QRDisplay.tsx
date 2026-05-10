import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../../constants/theme';

type QRDisplayProps = {
  value: string;
  size?: number;
};

export function QRDisplay({ value, size = 220 }: QRDisplayProps) {
  return (
    <View style={[styles.container, { padding: 12 }]}>
      <QRCode value={value} size={size} backgroundColor="#FFFFFF" color="#000000" />
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
