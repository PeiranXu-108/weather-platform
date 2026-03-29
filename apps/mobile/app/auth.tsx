import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/shared/theme/colors';
import { mobileLogin, mobileRegister } from '@/data/authRepository';
import { useAuthStore } from '@/state/authStore';

export default function AuthScreen() {
  const token = useAuthStore((s) => s.token);
  const emailInStore = useAuthStore((s) => s.email);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setPending(true);
    setError('');
    try {
      const payload = isRegister ? await mobileRegister(email, password) : await mobileLogin(email, password);
      await setSession(payload.token, payload.user.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>账号中心</Text>
      {token ? (
        <View style={styles.loggedBox}>
          <Text style={styles.loggedText}>已登录：{emailInStore}</Text>
          <Pressable style={styles.btnSecondary} onPress={clearSession}>
            <Text style={styles.btnText}>退出登录</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            placeholder="邮箱"
            placeholderTextColor="#7e8fae"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            placeholder="密码"
            placeholderTextColor="#7e8fae"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <View style={styles.row}>
            <Pressable style={styles.toggle} onPress={() => setIsRegister(false)}>
              <Text style={[styles.toggleText, !isRegister && styles.toggleActive]}>登录</Text>
            </Pressable>
            <Pressable style={styles.toggle} onPress={() => setIsRegister(true)}>
              <Text style={[styles.toggleText, isRegister && styles.toggleActive]}>注册</Text>
            </Pressable>
          </View>

          <Pressable style={styles.btn} onPress={submit}>
            {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{isRegister ? '注册' : '登录'}</Text>}
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 12 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    color: colors.textPrimary,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  toggle: { flex: 1, backgroundColor: colors.cardSecondary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  toggleText: { color: colors.textSecondary, fontWeight: '600' },
  toggleActive: { color: '#fff' },
  btn: { backgroundColor: colors.accent, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnSecondary: { backgroundColor: colors.cardSecondary, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  error: { color: colors.danger, marginTop: 8 },
  loggedBox: { backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  loggedText: { color: colors.textPrimary, fontSize: 16 },
});
