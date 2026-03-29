import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme/colors';
import type { WeatherResponse } from '@shared/weather/types';

function formatHour(value: string) {
  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, '0')}:00`;
}

export function HourlyForecastStrip({ weather }: { weather: WeatherResponse }) {
  const hours = weather.forecast.forecastday[0]?.hour ?? [];
  const astro = weather.forecast.forecastday[0]?.astro;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>未来24小时</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {hours.slice(0, 24).map((hour) => (
          <View key={hour.time_epoch} style={styles.item}>
            <Text style={styles.time}>{formatHour(hour.time)}</Text>
            <Text style={styles.temp}>{Math.round(hour.temp_c)}°</Text>
            <Text style={styles.meta}>{hour.chance_of_rain}% 降水</Text>
          </View>
        ))}
        {astro ? (
          <View style={styles.astro}>
            <Text style={styles.astroTitle}>日出</Text>
            <Text style={styles.astroValue}>{astro.sunrise}</Text>
            <Text style={styles.astroTitle}>日落</Text>
            <Text style={styles.astroValue}>{astro.sunset}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    width: 90,
  },
  time: { color: colors.textSecondary, fontSize: 12 },
  temp: { color: colors.textPrimary, fontWeight: '700', fontSize: 22, marginTop: 6 },
  meta: { color: colors.textSecondary, marginTop: 6, fontSize: 12 },
  astro: {
    backgroundColor: colors.cardSecondary,
    borderRadius: 12,
    padding: 12,
    width: 120,
  },
  astroTitle: { color: colors.textSecondary, fontSize: 12 },
  astroValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 8 },
});
