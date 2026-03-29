import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';

import { colors } from '@/shared/theme/colors';
import { useWeatherHome } from '@/hooks/useWeatherHome';
import { CurrentWeatherCard } from '@/features/weather/components/CurrentWeatherCard';
import { HourlyForecastStrip } from '@/features/weather/components/HourlyForecastStrip';
import { WeatherMetricsGrid } from '@/features/weather/components/WeatherMetricsGrid';
import { HourlyChartCard } from '@/features/charts/components/HourlyChartCard';
import { Forecast30dCard } from '@/features/charts/components/Forecast30dCard';
import { fetchWeather30d } from '@/data/weatherRepository';
import { searchCities } from '@shared/weather/citySearch';

export default function HomeScreen() {
  const [cityInput, setCityInput] = useState('');
  const {
    weather,
    isLoading,
    isRefetching,
    error,
    locateMe,
    setCityByInput,
    locationLabel,
    currentCity,
  } = useWeatherHome();

  const location = useMemo(() => {
    if (!weather?.location) return null;
    return `${weather.location.lon},${weather.location.lat}`;
  }, [weather?.location]);

  const forecast30dQuery = useQuery({
    queryKey: ['weather30d', location],
    queryFn: () => fetchWeather30d(location!),
    enabled: Boolean(location),
    staleTime: 60 * 60 * 1000,
  });

  const citySuggestions = useMemo(() => searchCities(cityInput, 5), [cityInput]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Weather Mobile</Text>
        <Text style={styles.subheading}>{locationLabel}</Text>
      </View>

      <View style={styles.searchCard}>
        <TextInput
          style={styles.input}
          placeholder="输入城市名（中英文）"
          placeholderTextColor="#7890b8"
          value={cityInput}
          onChangeText={setCityInput}
          onSubmitEditing={() => setCityByInput(cityInput)}
        />
        <View style={styles.searchActions}>
          <Pressable style={styles.btn} onPress={() => setCityByInput(cityInput)}>
            <Text style={styles.btnText}>查询</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={locateMe}>
            <Text style={styles.btnText}>定位</Text>
          </Pressable>
        </View>
        {citySuggestions.length > 0 ? (
          <View style={styles.suggestions}>
            {citySuggestions.map((item) => (
              <Pressable
                key={item.englishName}
                onPress={() => {
                  setCityInput(item.chineseName);
                  setCityByInput(item.chineseName);
                }}
              >
                <Text style={styles.suggestionText}>
                  {item.chineseName} ({item.englishName})
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.quickNav}>
        <Link href="/map" asChild>
          <Pressable style={styles.navChip}>
            <Text style={styles.navText}>地图</Text>
          </Pressable>
        </Link>
        <Link href="/favorites" asChild>
          <Pressable style={styles.navChip}>
            <Text style={styles.navText}>收藏</Text>
          </Pressable>
        </Link>
        <Link href="/chat" asChild>
          <Pressable style={styles.navChip}>
            <Text style={styles.navText}>AI助手</Text>
          </Pressable>
        </Link>
        <Link href="/settings" asChild>
          <Pressable style={styles.navChip}>
            <Text style={styles.navText}>设置</Text>
          </Pressable>
        </Link>
      </View>

      {(isLoading || isRefetching) && !weather ? (
        <ActivityIndicator color={colors.accent} />
      ) : null}

      {error ? <Text style={styles.error}>{error.message}</Text> : null}

      {weather ? (
        <>
          <CurrentWeatherCard weather={weather} />
          <HourlyForecastStrip weather={weather} />
          <HourlyChartCard weather={weather} />
          <Forecast30dCard data={forecast30dQuery.data} />
          <WeatherMetricsGrid weather={weather} />
          <Text style={styles.footer}>当前查询: {currentCity.query}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12, paddingBottom: 24 },
  topBar: { marginBottom: 10 },
  heading: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  subheading: { color: colors.textSecondary, marginTop: 4, fontSize: 14 },
  searchCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#344860',
    color: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchActions: { marginTop: 8, flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: colors.cardSecondary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  suggestions: { marginTop: 8, gap: 5 },
  suggestionText: { color: colors.textSecondary, fontSize: 12 },
  quickNav: { flexDirection: 'row', marginTop: 10, marginBottom: 6, gap: 8, flexWrap: 'wrap' },
  navChip: { backgroundColor: colors.cardSecondary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  navText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, marginTop: 12 },
  footer: { color: colors.textSecondary, marginTop: 14, fontSize: 12 },
});
