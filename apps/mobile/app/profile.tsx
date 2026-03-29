import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';

import { colors } from '@/shared/theme/colors';
import { fetchUsage } from '@/data/favoritesRepository';

const width = Dimensions.get('window').width;

export default function ProfileScreen() {
  const usageQuery = useQuery({
    queryKey: ['usage'],
    queryFn: fetchUsage,
  });

  const data = usageQuery.data;
  const option = {
    backgroundColor: 'transparent',
    grid: { top: 20, left: 14, right: 14, bottom: 20, containLabel: true },
    xAxis: {
      type: 'category',
      data: data?.daily?.map((item) => item.date.slice(5)) ?? [],
      axisLabel: { color: '#9db0cf', fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#9db0cf', fontSize: 9 },
    },
    series: [
      {
        type: 'bar',
        data: data?.daily?.map((item) => item.count) ?? [],
        itemStyle: { color: '#61a7ff' },
      },
    ],
  };

  const html = `
<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:transparent;">
    <div id="chart" style="width:100%;height:240px;"></div>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
    <script>
      const chart = echarts.init(document.getElementById('chart'));
      chart.setOption(${JSON.stringify(option)});
      window.addEventListener('resize', () => chart.resize());
    </script>
  </body>
</html>
`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>个人使用统计</Text>
      <Text style={styles.sub}>最近30天 API 调用：{data?.total ?? 0}</Text>
      <View style={styles.card}>
        <WebView originWhitelist={['*']} source={{ html }} style={{ width: width - 24, height: 240 }} scrollEnabled={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  sub: { color: colors.textSecondary, marginTop: 6, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: 12, paddingTop: 8 },
});
