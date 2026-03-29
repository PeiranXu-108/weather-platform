import { ScrollView, StyleSheet, Text } from 'react-native';

import { useWeatherHome } from '@/hooks/useWeatherHome';
import { WeatherMapSurface } from '@/features/map/components/WeatherMapSurface';
import { colors } from '@/shared/theme/colors';

export default function MapScreen() {
  const { weather } = useWeatherHome();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 12 }}>
      <Text style={styles.heading}>地图与图层</Text>
      <Text style={styles.subheading}>温度网格、风场、云层、降水图层（Skia 版）</Text>
      <WeatherMapSurface weather={weather} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  subheading: { color: colors.textSecondary, marginTop: 6, marginBottom: 10 },
});
