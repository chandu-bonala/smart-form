import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';

type TrendPoint = {
  date: string;
  count: number;
};

type BreakdownPoint = {
  label: string;
  value: number;
};

type TrendLineChartProps = {
  rows: TrendPoint[];
  maxValue?: number;
  height?: number;
  title?: string;
  subtitle?: string;
};

type ResponsePieChartProps = {
  title: string;
  rows: BreakdownPoint[];
  height?: number;
  subtitle?: string;
};

type HorizontalBarChartProps = {
  title: string;
  rows: BreakdownPoint[];
  height?: number;
  subtitle?: string;
  emptyLabel?: string;
};

const local = {
  surface: '#FFFFFF',
  card: '#F8F7FF',
  ink: '#171429',
  muted: '#716C87',
  line: '#DED9FB',
  blue: '#7657F7',
  green: '#159A8A',
  amber: '#D88B20',
  violet: '#9A86FF',
  red: '#D9576B',
  white: '#FFFFFF',
};

const palette = [local.blue, local.green, local.amber, local.violet, local.red, '#31226F'];

const chartConfig = {
  backgroundColor: local.surface,
  backgroundGradientFrom: local.surface,
  backgroundGradientTo: local.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(118, 87, 247, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(113, 108, 135, ${opacity})`,
  propsForBackgroundLines: {
    stroke: local.line,
    strokeDasharray: '4 6',
    strokeWidth: 1,
  },
  propsForDots: {
    r: '5',
    strokeWidth: '3',
    stroke: local.blue,
    fill: local.white,
  },
  fillShadowGradientFrom: local.blue,
  fillShadowGradientTo: local.blue,
  fillShadowGradientFromOpacity: 0.24,
  fillShadowGradientToOpacity: 0.02,
};

const formatShortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 5);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

export const TrendLineChart: React.FC<TrendLineChartProps> = ({ rows, maxValue, height = 250, title = 'Trend', subtitle }) => {
  const [width, setWidth] = useState(0);

  const data = useMemo(() => rows.slice(-12), [rows]);
  const lineData = useMemo(() => {
    const labels = data.map((item) => formatShortDate(item.date));
    const values = data.map((item) => item.count);

    if (values.length === 1) {
      return {
        labels: [labels[0], 'Now'],
        values: [values[0], values[0]],
      };
    }

    return { labels, values };
  }, [data]);

  const latestValue = data[data.length - 1]?.count ?? 0;
  const peakValue = Math.max(0, ...lineData.values);
  const averageValue = lineData.values.length
    ? Math.round(lineData.values.reduce((sum, item) => sum + item, 0) / lineData.values.length)
    : 0;
  const valueMax = Math.max(maxValue ?? 1, 1, ...lineData.values);
  const chartWidth = Math.max(width, 320);

  const handleLayout = (event: LayoutChangeEvent) => {
    const layoutWidth = Math.round(event.nativeEvent.layout.width);
    if (layoutWidth !== width) {
      setWidth(layoutWidth);
    }
  };

  if (data.length === 0) {
    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>No chart data yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartShell} onLayout={handleLayout}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.metricStack}>
          <MetricPill label="Latest" value={String(latestValue)} />
          <MetricPill label="Peak" value={String(peakValue)} />
          <MetricPill label="Avg" value={String(averageValue)} />
        </View>
      </View>
      <View style={styles.chartFrame}>
        <LineChart
          data={{
            labels: lineData.labels,
            datasets: [{ data: lineData.values }],
            legend: ['Responses'],
          }}
          width={chartWidth}
          height={height}
          yAxisInterval={1}
          fromZero
          bezier
          segments={Math.min(5, Math.max(2, valueMax))}
          chartConfig={chartConfig}
          style={styles.lineChart}
          withInnerLines
          withOuterLines={false}
          withShadow
          withDots
        />
      </View>
    </View>
  );
};

export const ResponsePieChart: React.FC<ResponsePieChartProps> = ({ title, rows, height = 210, subtitle }) => {
  const [width, setWidth] = useState(0);
  const visibleRows = rows.filter((row) => row.value > 0).slice(0, 6);
  const total = visibleRows.reduce((sum, row) => sum + row.value, 0);
  const chartWidth = Math.max(width, 300);

  const handleLayout = (event: LayoutChangeEvent) => {
    const layoutWidth = Math.round(event.nativeEvent.layout.width);
    if (layoutWidth !== width) {
      setWidth(layoutWidth);
    }
  };

  if (visibleRows.length === 0) {
    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>No chart data yet</Text>
      </View>
    );
  }

  const pieData = visibleRows.map((row, index) => ({
    name: row.label,
    population: row.value,
    color: palette[index % palette.length],
    legendFontColor: local.muted,
    legendFontSize: 12,
  }));

  return (
    <View style={styles.chartShell} onLayout={handleLayout}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <MetricPill label="Total" value={String(total)} />
      </View>
      <View style={styles.pieFrame}>
        <PieChart
          data={pieData}
          width={chartWidth}
          height={height}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="8"
          absolute
          hasLegend={false}
        />
      </View>
      <View style={styles.legendList}>
        {visibleRows.map((row, index) => {
          const percent = total > 0 ? Math.round((row.value / total) * 100) : 0;
          return (
            <View key={`${row.label}-${index}`} style={styles.legendRow}>
              <View style={styles.legendLabelWrap}>
                <View style={[styles.legendSwatch, { backgroundColor: palette[index % palette.length] }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>{row.label}</Text>
              </View>
              <Text style={styles.legendValue}>{row.value} · {percent}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({ title, rows, height, subtitle, emptyLabel = 'No chart data yet' }) => {
  const visibleRows = rows.filter((row) => row.value > 0).slice(0, 8);
  const maxValue = Math.max(1, ...visibleRows.map((item) => item.value));
  const total = visibleRows.reduce((sum, row) => sum + row.value, 0);

  if (visibleRows.length === 0) {
    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.chartShell, height ? { minHeight: height } : null]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <MetricPill label="Total" value={String(total)} />
      </View>
      <View style={styles.barList}>
        {visibleRows.map((row, index) => {
          const percent = Math.max(4, (row.value / maxValue) * 100);
          const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
          return (
            <View key={`${row.label}-${index}`} style={styles.barRow}>
              <View style={styles.barTopRow}>
                <Text style={styles.barLabel} numberOfLines={1}>{row.label}</Text>
                <Text style={styles.barValue}>{row.value} · {share}%</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: palette[index % palette.length] }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const MetricPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.metricPill}>
    <Text style={styles.metricPillLabel}>{label}</Text>
    <Text style={styles.metricPillValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  chartShell: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: local.line,
    backgroundColor: local.surface,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  sectionCopy: {
    flex: 1,
    paddingRight: 10,
  },
  sectionTitle: {
    color: local.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: local.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '700',
  },
  metricStack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  metricPill: {
    minWidth: 72,
    borderRadius: 14,
    backgroundColor: local.card,
    borderWidth: 1,
    borderColor: local.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricPillLabel: {
    color: local.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '900',
  },
  metricPillValue: {
    color: local.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  chartFrame: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: local.surface,
  },
  lineChart: {
    borderRadius: 16,
    marginLeft: -12,
  },
  pieFrame: {
    borderRadius: 16,
    backgroundColor: local.surface,
    overflow: 'hidden',
  },
  legendList: {
    marginTop: 6,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  legendLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 10,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendLabel: {
    flex: 1,
    color: local.ink,
    fontWeight: '800',
  },
  legendValue: {
    color: local.blue,
    fontWeight: '900',
    fontSize: 12,
  },
  barList: {
    gap: 12,
  },
  barRow: {
    gap: 8,
  },
  barTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  barLabel: {
    flex: 1,
    color: local.ink,
    fontWeight: '800',
  },
  barValue: {
    color: local.blue,
    fontSize: 12,
    fontWeight: '900',
  },
  barTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: local.card,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  emptyShell: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: local.line,
    backgroundColor: local.surface,
    padding: 16,
  },
  emptyTitle: {
    color: local.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    color: local.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
});
