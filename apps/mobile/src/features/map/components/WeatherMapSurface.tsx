import { useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import { Canvas, Circle, Group, Line, Rect } from '@shopify/react-native-skia';

import type { WeatherResponse } from '@shared/weather/types';
import { colors } from '@/shared/theme/colors';

const { width } = Dimensions.get('window');
const mapHeight = 320;

type LayerState = {
  temp: boolean;
  wind: boolean;
  cloud: boolean;
  precip: boolean;
};

const initialRegion: Region = {
  latitude: 30.2741,
  longitude: 120.1551,
  latitudeDelta: 2.4,
  longitudeDelta: 2.4,
};

export function WeatherMapSurface({ weather }: { weather: WeatherResponse | undefined }) {
  const [timeline, setTimeline] = useState(0);
  const [layers] = useState<LayerState>({ temp: true, wind: true, cloud: true, precip: true });

  const overlay = useMemo(() => {
    const rows = 7;
    const cols = 5;
    const cellW = width / cols;
    const cellH = mapHeight / rows;
    const intensity = (timeline % 24) / 24;

    return { rows, cols, cellW, cellH, intensity };
  }, [timeline]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>天气地图（Skia 图层）</Text>
      <View style={styles.mapBox}>
        <MapView style={styles.map} provider={PROVIDER_DEFAULT} initialRegion={initialRegion}>
          {weather ? (
            <Marker
              coordinate={{
                latitude: weather.location.lat,
                longitude: weather.location.lon,
              }}
              title={weather.location.name}
              description={`${Math.round(weather.current.temp_c)}°`}
            />
          ) : null}
        </MapView>
        <Canvas style={styles.overlay}>
          {layers.temp ? (
            <Group>
              {Array.from({ length: overlay.rows * overlay.cols }).map((_, index) => {
                const row = Math.floor(index / overlay.cols);
                const col = index % overlay.cols;
                const alpha = 0.15 + ((row + col + timeline) % 8) * 0.04;
                return (
                  <Rect
                    key={`temp-${index}`}
                    x={col * overlay.cellW}
                    y={row * overlay.cellH}
                    width={overlay.cellW - 1}
                    height={overlay.cellH - 1}
                    color={`rgba(255,120,80,${Math.min(alpha, 0.4)})`}
                  />
                );
              })}
            </Group>
          ) : null}

          {layers.wind ? (
            <Group>
              {Array.from({ length: 36 }).map((_, idx) => {
                const x = (idx % 6) * (width / 6) + 16;
                const y = Math.floor(idx / 6) * (mapHeight / 6) + 16;
                const offset = 10 + overlay.intensity * 22;
                return (
                  <Line
                    key={`wind-${idx}`}
                    p1={{ x, y }}
                    p2={{ x: x + offset, y: y - 4 }}
                    color="rgba(120,190,255,0.55)"
                    strokeWidth={1.2}
                  />
                );
              })}
            </Group>
          ) : null}

          {layers.cloud ? (
            <Group>
              {Array.from({ length: 20 }).map((_, idx) => (
                <Circle
                  key={`cloud-${idx}`}
                  cx={(idx * 47 + timeline * 8) % width}
                  cy={40 + (idx % 5) * 52}
                  r={12 + (idx % 4) * 4}
                  color="rgba(210,225,245,0.18)"
                />
              ))}
            </Group>
          ) : null}

          {layers.precip ? (
            <Group>
              {Array.from({ length: 42 }).map((_, idx) => (
                <Circle
                  key={`precip-${idx}`}
                  cx={(idx * 28 + timeline * 12) % width}
                  cy={(idx * 31 + timeline * 9) % mapHeight}
                  r={1.2 + (idx % 2)}
                  color="rgba(95,160,255,0.52)"
                />
              ))}
            </Group>
          ) : null}
        </Canvas>
      </View>

      <View style={styles.timelineRow}>
        <Text style={styles.timelineLabel}>时间轴 {timeline}:00</Text>
        <Slider
          style={{ flex: 1 }}
          minimumValue={0}
          maximumValue={23}
          step={1}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor="#41536f"
          thumbTintColor={colors.accent}
          value={timeline}
          onValueChange={(value) => setTimeline(value)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  mapBox: { borderRadius: 14, overflow: 'hidden' },
  map: { width: '100%', height: mapHeight },
  overlay: {
    position: 'absolute',
    width,
    height: mapHeight,
  },
  timelineRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  timelineLabel: { color: colors.textSecondary, fontSize: 12, width: 84 },
});
