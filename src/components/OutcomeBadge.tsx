import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { OutcomeBadge as OutcomeBadgeType } from '../utils/outcomeClassifier';
import type { OutcomeBadgeProps } from './types';

type BadgeConfig = { bg: string; text: string; label: string };

const CONFIG: Record<Exclude<OutcomeBadgeType, 'NONE'>, BadgeConfig> = {
  GREEN:      { bg: '#0A2A0A', text: '#30D158', label: 'In range' },
  ORANGE:     { bg: '#2A1A00', text: '#FF9500', label: 'Went high' },
  DARK_AMBER: { bg: '#2A1200', text: '#CC7A00', label: 'Still high' },
  RED:        { bg: '#2A0A0A', text: '#FF3B30', label: 'Out of range' },
  PENDING:    { bg: '#1A1A2A', text: '#636366', label: 'Pending' },
};

export function OutcomeBadge({ badge, size = 'default' }: OutcomeBadgeProps) {
  if (badge === 'NONE') return null;
  const cfg = CONFIG[badge];
  const isSmall = size === 'small';
  return (
    <View style={[
      styles.badge,
      { backgroundColor: cfg.bg },
      isSmall ? styles.badgeSmall : styles.badgeDefault,
    ]}>
      <Text style={[
        styles.label,
        { color: cfg.text },
        isSmall ? styles.labelSmall : styles.labelDefault,
      ]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 20 },
  badgeDefault: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeSmall:   { paddingHorizontal: 7,  paddingVertical: 2, borderRadius: 14 },
  label: { fontWeight: '600' },
  labelDefault: { fontSize: 12 },
  labelSmall:   { fontSize: 10 },
});
