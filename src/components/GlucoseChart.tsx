import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import type { LineSegment } from 'react-native-gifted-charts';
import type { GlucoseChartProps } from './types';

const CHART_HORIZONTAL_PADDING = 32; // 16px each side, matches card interior

function segmentColor(mmol: number): string {
  if (mmol < 3.9) return '#FF3B30';  // hypo — red
  if (mmol > 10.0) return '#FF9500'; // high — orange
  return '#30D158';                   // in range — green
}

function formatHour(epochMs: number): string {
  const d = new Date(epochMs);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** Build merged lineSegments — consecutive same-color segments are merged. */
function buildLineSegments(values: number[]): LineSegment[] {
  if (values.length < 2) return [];
  const segments: LineSegment[] = [];
  let start = 0;
  let color = segmentColor((values[0] + values[1]) / 2);

  for (let i = 1; i < values.length - 1; i++) {
    const next = segmentColor((values[i] + values[i + 1]) / 2);
    if (next !== color) {
      segments.push({ startIndex: start, endIndex: i, color });
      start = i;
      color = next;
    }
  }
  segments.push({ startIndex: start, endIndex: values.length - 1, color });
  return segments;
}

export function GlucoseChart({ response, height = 120, showTimeLabels = false }: GlucoseChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const readings = response.readings;

  if (readings.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.noData}>Not enough data</Text>
      </View>
    );
  }

  const rawValues = readings.map(r => r.mmol);
  const minVal = Math.min(...rawValues);
  const maxVal = Math.max(...rawValues);

  const yMin = Math.max(2.0, Math.floor(minVal) - 1);
  const yMax = Math.max(14.0, Math.ceil(maxVal) + 1);

  // Data points — gifted-charts uses { value } format
  const data = rawValues.map(v => ({ value: v }));

  // Per-segment coloring based on glucose range
  const lineSegments = buildLineSegments(rawValues);

  // Time labels along x-axis (up to 5 evenly spaced)
  const xAxisLabelTexts: string[] | undefined = showTimeLabels
    ? (() => {
        const labels: string[] = new Array(readings.length).fill('');
        const count = Math.min(5, readings.length);
        for (let i = 0; i < count; i++) {
          const idx = Math.round((i / (count - 1)) * (readings.length - 1));
          labels[idx] = formatHour(readings[idx].date);
        }
        return labels;
      })()
    : undefined;

  const chartWidth = screenWidth - CHART_HORIZONTAL_PADDING - 40; // 40 ≈ y-axis width
  const chartHeight = height - (showTimeLabels ? 30 : 10);

  return (
    <View style={[styles.container, { height }]}>
      <LineChart
        data={data}
        height={chartHeight}
        width={chartWidth}
        adjustToWidth
        disableScroll
        hideDataPoints
        curved
        curvature={0.15}
        color="#30D158"
        thickness={2}
        lineSegments={lineSegments}
        yAxisOffset={yMin}
        maxValue={yMax - yMin}
        noOfSections={4}
        formatYLabel={(val: string) => (parseFloat(val) + yMin).toFixed(1)}
        yAxisTextStyle={styles.yAxisText}
        yAxisColor="transparent"
        yAxisThickness={0}
        xAxisColor="transparent"
        xAxisThickness={0}
        hideRules
        backgroundColor="transparent"
        initialSpacing={0}
        endSpacing={0}
        showReferenceLine1
        referenceLine1Position={3.9 - yMin}
        referenceLine1Config={{
          color: '#FF3B30',
          dashWidth: 4,
          dashGap: 4,
          thickness: 1,
          type: 'dashed',
        }}
        showReferenceLine2
        referenceLine2Position={10.0 - yMin}
        referenceLine2Config={{
          color: '#FF9500',
          dashWidth: 4,
          dashGap: 4,
          thickness: 1,
          type: 'dashed',
        }}
        {...(xAxisLabelTexts ? {
          xAxisLabelTexts,
          xAxisLabelTextStyle: styles.xAxisText,
        } : {})}
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
  yAxisText: {
    color: '#636366',
    fontSize: 9,
  },
  xAxisText: {
    color: '#636366',
    fontSize: 9,
  },
});
