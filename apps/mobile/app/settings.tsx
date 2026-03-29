import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { colors } from '@/shared/theme/colors';

export default function SettingsScreen() {
  const [highFidelity, setHighFidelity] = useState(true);
  const [dynamicBackground, setDynamicBackground] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>设置</Text>
      <Text style={styles.sub}>保持与 Web 端一致的交互和渲染策略</Text>

      <View style={styles.item}>
        <Text style={styles.label}>高保真图层</Text>
        <Switch value={highFidelity} onValueChange={setHighFidelity} />
      </View>
      <View style={styles.item}>
        <Text style={styles.label}>动态天气背景</Text>
        <Switch value={dynamicBackground} onValueChange={setDynamicBackground} />
      </View>

      <Link href="/auth" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>账号与登录</Text>
        </Pressable>
      </Link>
      <Link href="/profile" asChild>
        <Pressable style={styles.btnSecondary}>
          <Text style={styles.btnText}>查看使用统计</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  sub: { color: colors.textSecondary, marginTop: 6, marginBottom: 14 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: { color: colors.textPrimary, fontSize: 15 },
  btn: { backgroundColor: colors.accent, borderRadius: 10, marginTop: 8, padding: 12, alignItems: 'center' },
  btnSecondary: {
    backgroundColor: colors.cardSecondary,
    borderRadius: 10,
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
