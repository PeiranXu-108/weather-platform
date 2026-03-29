import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme/colors';
import type { WeatherResponse } from '@shared/weather/types';
import { translateWeatherCondition } from '@shared/weather/weatherTranslations';

export function CurrentWeatherCard({ weather }: { weather: WeatherResponse }) {
  const conditionText = translateWeatherCondition(weather.current.condition);
  const iconUrl = `https:${weather.current.condition.icon}`;

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.city}>{weather.location.name}</Text>
        <Text style={styles.condition}>{conditionText}</Text>
        <Text style={styles.temp}>{Math.round(weather.current.temp_c)}°</Text>
        <Text style={styles.feelsLike}>体感 {Math.round(weather.current.feelslike_c)}°</Text>
      </View>
      <Image source={{ uri: iconUrl }} style={styles.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  city: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  condition: { color: colors.textSecondary, marginTop: 4, fontSize: 14 },
  temp: { color: colors.textPrimary, fontSize: 48, fontWeight: '700', marginTop: 8 },
  feelsLike: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  icon: { width: 88, height: 88 },
});
