import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radii, spacing } from '../../../constants/theme';
import type { StickerStatus } from '../types';

type ContextMenuProps = {
  status: StickerStatus;
  repeatedCount: number;
  position: { x: number; y: number };
  onSelectStatus: (status: StickerStatus) => void;
  onClose: () => void;
};

const statusLabels: Record<StickerStatus, { label: string; color: string }> = {
  missing: { label: 'Falta', color: '#4A4A4A' },
  owned: { label: 'Tengo', color: '#00C853' },
  repeated: { label: 'Repetida', color: '#2962FF' },
  special: { label: 'Especial', color: '#FF1744' },
};

export function ContextMenu({
  status,
  repeatedCount,
  position,
  onSelectStatus,
  onClose,
}: ContextMenuProps) {
  const canHaveRepeated = status === 'owned' || status === 'repeated' || status === 'special';
  const options: StickerStatus[] = canHaveRepeated 
    ? ['missing', 'owned', 'repeated']
    : ['missing', 'owned'];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View
        style={[
          styles.menu,
          {
            left: position.x - 60,
            top: position.y - 120,
          },
        ]}
      >
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => {
              onSelectStatus(option);
              onClose();
            }}
            style={[
              styles.menuItem,
              option === status && styles.menuItemActive,
              { backgroundColor: option === status ? '#333333' : 'transparent' },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: statusLabels[option].color },
              ]}
            />
            <Text
              style={[
                styles.menuItemText,
                option === status && styles.menuItemTextActive,
              ]}
            >
              {statusLabels[option].label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menu: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333333',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.xs,
    position: 'absolute',
    width: 120,
  },
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  menuItemActive: {
    borderRadius: radii.sm,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  menuItemTextActive: {
    fontWeight: '800',
  },
  statusDot: {
    borderRadius: 999,
    height: 10,
    marginRight: spacing.sm,
    width: 10,
  },
});