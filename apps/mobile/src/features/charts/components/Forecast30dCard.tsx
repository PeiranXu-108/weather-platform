import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { QWeather30DayResponse } from '@shared/weather/types';
import { colors } from '@/shared/theme/colors';

const screenWidth = Dimensions.get('window').width;

export function Forecast30dCard({ data }: { data: QWeather30DayResponse | undefined }) {
  const daily = data?.daily ?? [];

  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['最高温', '最低温'],
        top: 0,
        textStyle: { color: '#9db0cf' },
      },
      grid: { left: 10, right: 10, top: 35, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: daily.map((d) => d.fxDate.slice(5)),
        axisLabel: { color: '#9db0cf', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#9db0cf', fontSize: 10 },
      },
      series: [
        {
          name: '最高温',
          type: 'line',
          smooth: true,
          data: daily.map((d) => Number(d.tempMax)),
          lineStyle: { color: '#ff8f6b', width: 2 },
        },
        {
          name: '最低温',
          type: 'line',
          smooth: true,
          data: daily.map((d) => Number(d.tempMin)),
          lineStyle: { color: '#61a7ff', width: 2 },
        },
      ],
    }),
    [daily]
  );

  const html = useMemo(
    () => `
<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:transparent;">
    <div id="chart" style="width:100%;height:260px;"></div>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
    <script>
      const chart = echarts.init(document.getElementById('chart'));
      chart.setOption(${JSON.stringify(option)});
      window.addEventListener('resize', () => chart.resize());
    </script>
  </body>
</html>
`,
    [option]
  );

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>30天趋势</Text>
      <View style={styles.chartContainer}>
        <WebView originWhitelist={['*']} source={{ html }} style={styles.chart} scrollEnabled={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  chartContainer: { backgroundColor: colors.card, borderRadius: 12, paddingTop: 8 },
  chart: { width: screenWidth - 24, height: 260 },
});
