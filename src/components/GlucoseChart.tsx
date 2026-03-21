import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import type { GlucoseChartProps } from './types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_PADDING = 32; // 16px padding each side to match card interior

export function GlucoseChart({ response, height = 120 }: GlucoseChartProps) {
  const chartWidth = SCREEN_WIDTH - CHART_PADDING - 64; // 64 for y-axis label area

  // Convert readings to gifted-charts data format
  // readings are every 5 minutes; keep value only (no x-axis labels — too crowded)
  const data = response.readings.map(r => ({ value: r.mmol }));

  if (data.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.noData}>Not enough data</Text>
      </View>
    );
  }

  // Y-axis: max is at least 14.0 for consistent scale
  const maxVal = Math.max(...data.map(d => d.value));
  const yMax = Math.max(14.0, Math.ceil((maxVal + 0.5) * 2) / 2);

  return (
    <View style={styles.container}>
      <LineChart
        data={data}
        height={height}
        width={chartWidth}
        color="#30D158"
        thickness={2}
        curved
        hideDataPoints
        maxValue={yMax}
        noOfSections={4}
        yAxisColor="#2C2C2E"
        xAxisColor="#2C2C2E"
        yAxisTextStyle={styles.axisText}
        showReferenceLine1
        referenceLine1Position={3.9}
        referenceLine1Config={{
          color: '#FF3B30',
          thickness: 1,
          dashWidth: 4,
          dashGap: 4,
        }}
        showReferenceLine2
        referenceLine2Position={10.0}
        referenceLine2Config={{
          color: '#FF9500',
          thickness: 1,
          dashWidth: 4,
          dashGap: 4,
        }}
        backgroundColor="#1C1C1E"
        initialSpacing={4}
        endSpacing={4}
        isAnimated={false}
      />
      {response.isPartial && (
        <Text style={styles.partialNote}>Curve still building</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
  },
  axisText: {
    color: '#636366',
    fontSize: 9,
  },
  noData: {
    color: '#636366',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
  },
  partialNote: {
    fontSize: 11,
    color: '#FF9500',
    textAlign: 'center',
    paddingVertical: 4,
  },
});
