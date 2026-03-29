import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { colors } from '@/shared/theme/colors';
import { addFavorite, fetchFavorites, removeFavorite, syncFavorites } from '@/data/favoritesRepository';
import { FAVORITES_KEY, getCachedJson, setCachedJson } from '@/data/cache';
import type { FavoriteCity } from '@shared/weather/types';
import { useAuthStore } from '@/state/authStore';

export default function FavoritesScreen() {
  const [localFavorites, setLocalFavorites] = useState<FavoriteCity[]>([]);
  const [city, setCity] = useState('');
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    getCachedJson<FavoriteCity[]>(FAVORITES_KEY).then((value) => setLocalFavorites(value ?? []));
  }, []);

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: fetchFavorites,
    enabled: Boolean(token),
  });

  const syncMutation = useMutation({
    mutationFn: (payload: FavoriteCity[]) => syncFavorites(payload),
    onSuccess: async (serverFavorites) => {
      await setCachedJson(FAVORITES_KEY, serverFavorites);
      setLocalFavorites(serverFavorites);
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const addMutation = useMutation({
    mutationFn: (payload: FavoriteCity) => addFavorite(payload),
    onSuccess: async (favorites) => {
      await setCachedJson(FAVORITES_KEY, favorites);
      setLocalFavorites(favorites);
      setCity('');
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (query: string) => removeFavorite(query),
    onSuccess: async (favorites) => {
      await setCachedJson(FAVORITES_KEY, favorites);
      setLocalFavorites(favorites);
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const favorites = token ? favoritesQuery.data ?? [] : localFavorites;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>收藏城市</Text>
      <Text style={styles.sub}>
        {token ? '已登录：服务端收藏同步可用' : '未登录：使用本地收藏，登录后可一键同步'}
      </Text>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="如：hangzhou / 杭州"
          placeholderTextColor="#7f93b3"
          value={city}
          onChangeText={setCity}
        />
        <Pressable
          style={styles.addBtn}
          onPress={async () => {
            if (!city.trim()) return;
            if (token) {
              addMutation.mutate({ query: city.trim() });
            } else {
              const updated = [{ query: city.trim() }, ...favorites].slice(0, 50);
              setLocalFavorites(updated);
              await setCachedJson(FAVORITES_KEY, updated);
              setCity('');
            }
          }}
        >
          <Text style={styles.btnText}>添加</Text>
        </Pressable>
      </View>

      {!token ? (
        <Pressable style={styles.syncBtn} onPress={() => syncMutation.mutate(localFavorites)}>
          <Text style={styles.btnText}>登录后手动同步到服务端</Text>
        </Pressable>
      ) : null}

      {favoritesQuery.isLoading || addMutation.isPending || removeMutation.isPending ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
      ) : null}

      <View style={{ marginTop: 12, gap: 8 }}>
        {favorites.map((fav) => (
          <View key={fav.query} style={styles.item}>
            <Text style={styles.itemText}>{fav.label ?? fav.query}</Text>
            <Pressable
              onPress={async () => {
                if (token) {
                  removeMutation.mutate(fav.query);
                } else {
                  const updated = favorites.filter((f) => f.query !== fav.query);
                  setLocalFavorites(updated);
                  await setCachedJson(FAVORITES_KEY, updated);
                }
              }}
            >
              <Text style={styles.deleteText}>删除</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  sub: { color: colors.textSecondary, marginTop: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  syncBtn: { backgroundColor: colors.cardSecondary, marginTop: 8, borderRadius: 10, padding: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
  item: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemText: { color: colors.textPrimary },
  deleteText: { color: colors.warning, fontWeight: '600' },
});
