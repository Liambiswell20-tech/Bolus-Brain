import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// IMPORTANT: Disclaimer text is a module-level constant — NEVER accept as a prop.
// Per CONTEXT.md Decision 4: hardcoded to prevent accidental override.
const DISCLAIMER_TEXT =
  'BolusBrain shows your personal historical glucose patterns. ' +
  'It does not provide medical advice. Always use your own clinical judgment ' +
  'and consult your diabetes team for dosing decisions.';

export function SafetyDisclaimer() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{DISCLAIMER_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  text: {
    fontSize: 11,
    color: '#636366',
    lineHeight: 15,
    textAlign: 'center',
  },
});
