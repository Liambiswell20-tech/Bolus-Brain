import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import type { GlucoseChartProps } from './types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_PADDING = 32; // 16px padding each side to match card interior

export function GlucoseChart({ response, height = 120 }: GlucoseChartProps) {
  const chartWidth = SCREEN_WIDTH - CHART_PADDING - 64; // 64 for y-axis label area

  const rawValues = response.readings.map(r => r.mmol);

  if (rawValues.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.noData}>Not enough data</Text>
      </View>
    );
  }

  const minVal = Math.min(...rawValues);
  const maxVal = Math.max(...rawValues);

  // Y-axis floor: 1 below data minimum (floor to nearest 1.0), never below 2.0
  // This makes the curve fill the chart height rather than being a tiny line near the top
  const yMin = Math.max(2.0, Math.floor(minVal) - 1);
  // Y-axis ceiling: at least 14.0 or 1 above actual max
  const yMax = Math.max(14.0, Math.ceil(maxVal) + 1);
  const range = yMax - yMin;

  // gifted-charts has no minValue prop — shift all values down by yMin
  const data = rawValues.map(v => ({ value: v - yMin }));

  // Reference lines adjusted for the same shift (clamp to 0 if below visible range)
  const ref1Pos = Math.max(0, 3.9 - yMin);   // hypo line (red)
  const ref2Pos = Math.max(0, 10.0 - yMin);  // high line (orange)

  // Y-axis labels showing actual glucose values
  const sectionCount = 4;
  const step = range / sectionCount;
  const yAxisLabelTexts = Array.from({ length: sectionCount + 1 }, (_, i) =>
    (yMin + i * step).toFixed(1)
  );

  return (
    <View style={styles.container}>
      <LineChart
        data={data}
        height={height}
        width={chartWidth}
        color="#30D158"
        thickness={2}
        hideDataPoints
        maxValue={range}
        noOfSections={sectionCount}
        yAxisLabelTexts={yAxisLabelTexts}
        yAxisColor="#2C2C2E"
        xAxisColor="#2C2C2E"
        yAxisTextStyle={styles.axisText}
        showReferenceLine1
        referenceLine1Position={ref1Pos}
        referenceLine1Config={{
          color: '#FF3B30',
          thickness: 1,
          dashWidth: 4,
          dashGap: 4,
        }}
        showReferenceLine2
        referenceLine2Position={ref2Pos}
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
