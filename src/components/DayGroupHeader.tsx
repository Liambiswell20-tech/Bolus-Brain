import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import type { DayGroupHeaderProps } from './types';

export function DayGroupHeader({ label, count, expanded, onToggle }: DayGroupHeaderProps) {
  const rotation = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [expanded, rotation]);

  const chevronStyle = {
    transform: [{
      rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }),
    }],
  };

  return (
    <Pressable style={styles.header} onPress={onToggle}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.count}>{count} {count === 1 ? 'entry' : 'entries'}</Text>
      <Animated.Text style={[styles.chevron, chevronStyle]}>&#x203A;</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  label: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  count: { fontSize: 13, color: '#636366', marginRight: 10 },
  chevron: { fontSize: 20, color: '#636366', lineHeight: 22 },
});
