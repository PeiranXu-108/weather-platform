import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/shared/theme/colors';
import { streamChat, type ChatMessage } from '@/data/chatRepository';

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好，我是天气助手。你可以问我天气趋势、穿衣建议、出行建议。' },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);

  const send = async () => {
    if (!input.trim() || pending) return;
    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setPending(true);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      await streamChat(nextMessages, (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            last.content += chunk;
          }
          return updated;
        });
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `请求失败：${error instanceof Error ? error.message : '未知错误'}` },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.messages}>
        {messages.map((msg, idx) => (
          <View key={`${msg.role}-${idx}`} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.botBubble]}>
            <Text style={styles.bubbleText}>{msg.content}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          style={styles.input}
          placeholder="请输入天气问题"
          placeholderTextColor="#7e92b4"
        />
        <Pressable style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendText}>{pending ? '...' : '发送'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  messages: { padding: 12, gap: 8 },
  bubble: { borderRadius: 10, padding: 10, maxWidth: '88%' },
  userBubble: { backgroundColor: '#215698', alignSelf: 'flex-end' },
  botBubble: { backgroundColor: colors.card, alignSelf: 'flex-start' },
  bubbleText: { color: colors.textPrimary, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f3149',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendBtn: { backgroundColor: colors.accent, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 14 },
  sendText: { color: '#fff', fontWeight: '700' },
});
