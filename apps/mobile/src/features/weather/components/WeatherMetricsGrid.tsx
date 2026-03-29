import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme/colors';
import type { WeatherResponse } from '@shared/weather/types';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function WeatherMetricsGrid({ weather }: { weather: WeatherResponse }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>关键指标</Text>
      <View style={styles.grid}>
        <Metric label="湿度" value={`${weather.current.humidity}%`} />
        <Metric label="风速" value={`${Math.round(weather.current.wind_kph)} km/h`} />
        <Metric label="气压" value={`${Math.round(weather.current.pressure_mb)} hPa`} />
        <Metric label="能见度" value={`${weather.current.vis_km} km`} />
        <Metric label="云量" value={`${weather.current.cloud}%`} />
        <Metric label="UV" value={`${weather.current.uv}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
  },
  metricLabel: { color: colors.textSecondary, fontSize: 12 },
  metricValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 6 },
});
