import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radii, spacing } from '../../../constants/theme';

type RepeatCounterMenuProps = {
  repeatedCount: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onClose: () => void;
};

export function RepeatCounterMenu({
  repeatedCount,
  onIncrement,
  onDecrement,
  onClose,
}: RepeatCounterMenuProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.counterMenu}>
        <Text style={styles.counterTitle}>Repetidas</Text>
        <View style={styles.counterRow}>
          <Pressable
            onPress={onDecrement}
            style={[styles.counterBtn, styles.counterBtnMinus]}
          >
            <Text style={styles.counterBtnText}>−</Text>
          </Pressable>
          <Text style={styles.counterValue}>×{repeatedCount}</Text>
          <Pressable
            onPress={onIncrement}
            style={[styles.counterBtn, styles.counterBtnPlus]}
          >
            <Text style={styles.counterBtnText}>+</Text>
          </Pressable>
        </View>
        <Pressable onPress={onClose} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>Listo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  counterMenu: {
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderColor: '#333333',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    position: 'absolute',
    left: '50%',
    marginLeft: -80,
    top: '40%',
    width: 160,
  },
  counterTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  counterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  counterBtn: {
    alignItems: 'center',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  counterBtnMinus: {
    backgroundColor: 'rgba(255,23,68,0.15)',
  },
  counterBtnPlus: {
    backgroundColor: 'rgba(41,98,255,0.15)',
  },
  counterBtnText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  counterValue: {
    color: '#2962FF',
    fontSize: 28,
    fontWeight: '900',
    marginHorizontal: spacing.lg,
    minWidth: 50,
    textAlign: 'center',
  },
  doneBtn: {
    backgroundColor: '#00C853',
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});