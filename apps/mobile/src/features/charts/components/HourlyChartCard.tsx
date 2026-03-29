import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { WeatherResponse } from '@shared/weather/types';
import { colors } from '@/shared/theme/colors';

const screenWidth = Dimensions.get('window').width;

export function HourlyChartCard({ weather }: { weather: WeatherResponse }) {
  const hours = weather.forecast.forecastday[0]?.hour?.slice(0, 24) ?? [];

  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
      },
      grid: { left: 10, right: 10, top: 10, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: hours.map((item) => item.time.slice(11, 16)),
        axisLabel: { color: '#9db0cf', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#9db0cf', fontSize: 10 },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          data: hours.map((item) => item.temp_c),
          lineStyle: { color: '#61a7ff', width: 2 },
          areaStyle: {
            color: 'rgba(97,167,255,0.25)',
          },
        },
      ],
    }),
    [hours]
  );

  const html = useMemo(
    () => `
<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:transparent;">
    <div id="chart" style="width:100%;height:220px;"></div>
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
      <Text style={styles.title}>24小时温度曲线</Text>
      <View style={styles.chartContainer}>
        <WebView originWhitelist={['*']} source={{ html }} style={styles.chart} scrollEnabled={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  chartContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingTop: 10,
  },
  chart: {
    width: screenWidth - 24,
    height: 220,
  },
});
