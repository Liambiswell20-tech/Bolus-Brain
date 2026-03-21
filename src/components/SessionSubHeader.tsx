import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SessionSubHeaderProps } from './types';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function SessionSubHeader({ mealCount, startedAt }: SessionSubHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Session — {mealCount} meals, {formatTime(startedAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  text: {
    fontSize: 12,
    color: '#636366',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
