import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Badge } from '~/components/ui/badge';
import type { OutcomeBadge as OutcomeBadgeType } from '../utils/outcomeClassifier';
import type { OutcomeBadgeProps } from './types';

type BadgeConfig = { bg: string; text: string; label: string };

const CONFIG: Record<Exclude<OutcomeBadgeType, 'NONE'>, BadgeConfig> = {
  GREEN:      { bg: '#0A2A0A', text: '#30D158', label: 'In range' },
  ORANGE:     { bg: '#2A1A00', text: '#FF9500', label: 'Went high' },
  DARK_AMBER: { bg: '#2A1200', text: '#CC7A00', label: 'Still high' },
  RED:        { bg: '#2A0A0A', text: '#FF3B30', label: 'Out of range' },
  HYPO:       { bg: '#1A0A2A', text: '#BF5AF2', label: 'Went low' },
  PENDING:    { bg: '#1A1A2A', text: '#636366', label: 'Pending' },
};

export function OutcomeBadge({ badge, size = 'default' }: OutcomeBadgeProps) {
  if (badge === 'NONE') return null;
  const cfg = CONFIG[badge];
  const isSmall = size === 'small';
  return (
    <Badge
      className="border-0 self-start"
      style={[
        { backgroundColor: cfg.bg },
        isSmall ? styles.badgeSmall : styles.badgeDefault,
      ]}
    >
      <Text style={[
        styles.label,
        { color: cfg.text },
        isSmall ? styles.labelSmall : styles.labelDefault,
      ]}>
        {cfg.label}
      </Text>
    </Badge>
  );
}

const styles = StyleSheet.create({
  badgeDefault: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeSmall:   { paddingHorizontal: 7,  paddingVertical: 2, borderRadius: 14 },
  label: { fontWeight: '600' },
  labelDefault: { fontSize: 12 },
  labelSmall:   { fontSize: 10 },
});
