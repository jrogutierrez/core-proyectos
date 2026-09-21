// app/admin/chat.tsx
// Chat en tiempo real entre admin y usuario
// app/admin/chat.tsx
// Chat admin ↔ usuario con audio + encriptación triple

// Chat admin ↔ usuario con audio + encriptación triple
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { sendEmergencyPush } from '@/services/push-alerts';
import { useAuth } from '@/hooks/useAuth';
import AudioRecordButton from '@/components/AudioRecordButton';
import AudioMessage from '@/components/AudioMessage';
import { encryptMessage, decryptMessage } from '@/services/crypto/triple-cipher';
import { saveAdminInstruction } from '@/services/instruction-history';
import i18n from '@/i18n';
import { getLocalizedDateLabel, getLocalizedTime } from '@/utils/dateLocale';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface Message {
  id:          string;
  sender_id:   string;
  receiver_id: string;
  content:     string;
  type:        'text' | 'audio';
  duration?:   number;
  is_read:     boolean;
  created_at:  string;
  decrypted?:  string;
}

interface DateSeparator {
  type:  'separator';
  label: string;
  id:    string;
}

type ListItem = Message | DateSeparator;

// ─────────────────────────────────────────
// Helper separadores
// ─────────────────────────────────────────
function insertDateSeparators(messages: Message[]): ListItem[] {
  const result: ListItem[] = [];
  let lastDate = '';

  for (const msg of messages) {
    const dateLabel = getLocalizedDateLabel(msg.created_at);
    if (dateLabel !== lastDate) {
      result.push({
        type:  'separator',
        label: dateLabel,
        id:    `sep-${msg.created_at}`,
      });
      lastDate = dateLabel;
    }
    result.push(msg);
  }

  return result;
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export default function AdminChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const userId   = Array.isArray(params.userId)   ? params.userId[0]   : params.userId;
  const userName = Array.isArray(params.userName) ? params.userName[0] : params.userName || 'Usuario';

  const [messages,  setMessages]  = useState<Message[]>([]);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [text,      setText]      = useState('');
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // ── Cargar mensajes ────────────────────────────────────────
  const loadMessages = async () => {
    if (!user?.id || !userId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),` +
        `and(sender_id.eq.${userId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ADMIN CHAT] Error cargando:', error);
      setLoading(false);
      return;
    }

    const decrypted = await Promise.all(
      (data || []).map(async (msg) => {
        try {
          const result = await decryptMessage(msg.content);
          return { ...msg, decrypted: result.content, type: result.type };
        } catch {
          return { ...msg, decrypted: msg.content, type: 'text' as const };
        }
      })
    );

    setMessages(decrypted);
    setListItems(insertDateSeparators(decrypted));
    setLoading(false);

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', userId)
      .eq('is_read', false);
  };

  // ── Realtime ───────────────────────────────────────────────
  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`admin-chat-${user?.id}-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as Message;
          const isRelevant =
            (msg.sender_id === user?.id && msg.receiver_id === userId) ||
            (msg.sender_id === userId   && msg.receiver_id === user?.id);

          if (!isRelevant) return;

          try {
            const result = await decryptMessage(msg.content);
            const decryptedMsg = {
              ...msg, decrypted: result.content, type: result.type,
            };
            setMessages((prev) => {
              const updated = [...prev, decryptedMsg];
              setListItems(insertDateSeparators(updated));
              return updated;
            });
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          } catch {
            console.error('[ADMIN CHAT] Error desencriptando nuevo');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, userId]);

  useEffect(() => {
    if (!loading && listItems.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  }, [loading]);

  // ── Enviar texto ───────────────────────────────────────────
  const sendText = async () => {
    if (!text.trim() || !user?.id || !userId || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);

    try {
      const encrypted = await encryptMessage(content, 'text');
      const { error } = await supabase.from('messages').insert({
        sender_id:   user.id,
        receiver_id: userId,
        content:     encrypted,
        type:        'text',
        is_read:     false,
      });

      if (error) {
        console.error('[ADMIN CHAT] Error enviando:', error);
        if (Platform.OS === 'web') {
          window.alert(i18n.t('adminChat.errors.send'));
        } else {
          Alert.alert(i18n.t('common.error'), i18n.t('adminChat.errors.send'));
        }
      } else {
  const saved = await saveAdminInstruction(userId, content, 'text');
  console.log('[INSTRUCTIONS]', saved ? '✅' : '❌', 'Instrucción admin');

  // Enviar push al usuario
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('push_token, language_preference')
      .eq('id', userId)
      .maybeSingle();

    if (userProfile?.push_token) {
      await sendEmergencyPush({
        tokens: [userProfile.push_token],
        title:  '🛡️ DEFENSOR Support',
        body:   content.length > 100 ? content.slice(0, 100) + '...' : content,
        language: userProfile.language_preference || 'es',
        data: { type: 'chat', senderId: user.id },
      });
    }
  } catch (pushErr) {
    console.warn('[AdminChat] Error enviando push:', pushErr);
  }
}
    } catch (error) {
      console.error('[ADMIN CHAT] Error encriptando:', error);
    } finally {
      setSending(false);
    }
  };

  // ── Enviar audio ───────────────────────────────────────────
  const sendAudio = async (url: string, duration: number) => {
    if (!user?.id || !userId) return;
    setSending(true);

    try {
      const encrypted = await encryptMessage(url, 'audio');
      const { error } = await supabase.from('messages').insert({
        sender_id:   user.id,
        receiver_id: userId,
        content:     encrypted,
        type:        'audio',
        duration,
        is_read:     false,
      });

      if (error) {
        console.error('[ADMIN CHAT] Error enviando audio:', error);
        if (Platform.OS === 'web') {
          window.alert(i18n.t('adminChat.errors.audio'));
        } else {
          Alert.alert(i18n.t('common.error'), i18n.t('adminChat.errors.audio'));
        }
      } else {
        const saved = await saveAdminInstruction(userId, url, 'audio');
        console.log('[INSTRUCTIONS]', saved ? '✅' : '❌', 'Audio admin');
      }
    } catch (error) {
      console.error('[ADMIN CHAT] Error encriptando audio:', error);
    } finally {
      setSending(false);
    }
  };

  // ── Render item ────────────────────────────────────────────
  const renderItem = ({ item }: { item: ListItem }) => {
    if ('type' in item && item.type === 'separator') {
      return (
        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>{item.label}</Text>
          <View style={styles.separatorLine} />
        </View>
      );
    }

    const msg   = item as Message;
    const isOwn = msg.sender_id === user?.id;

    return (
      <View style={[
        styles.messageRow,
        isOwn ? styles.messageRowRight : styles.messageRowLeft,
      ]}>
        {/* Avatar usuario */}
        {!isOwn && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userName[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}

        {/* Avatar admin */}
        {isOwn && (
          <View style={[styles.avatar, styles.avatarAdmin]}>
            <Text style={styles.avatarText}>🛡️</Text>
          </View>
        )}

        <View style={[
          styles.bubble,
          isOwn ? styles.bubbleAdmin : styles.bubbleUser,
        ]}>
          {isOwn && (
            <Text style={styles.adminBadge}>
              {i18n.t('adminChat.badge')}
            </Text>
          )}

          {msg.type === 'text' && (
            <Text style={styles.messageText}>
              {msg.decrypted ?? msg.content}
            </Text>
          )}

          {msg.type === 'audio' && msg.decrypted && (
            <AudioMessage
              url={msg.decrypted}
              duration={msg.duration}
              isOwn={isOwn}
              isAdmin={isOwn}
            />
          )}

          <Text style={styles.messageTime}>
            {getLocalizedTime(msg.created_at)}
            {isOwn && (
              <Text style={styles.readStatus}>
                {msg.is_read
                  ? i18n.t('chatDetail.read')
                  : i18n.t('chatDetail.sent')}
              </Text>
            )}
          </Text>
        </View>
      </View>
    );
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>
          {i18n.t('adminChat.loading')}
        </Text>
      </View>
    );
  }

  // ── Render principal ───────────────────────────────────────
  return (
    <KeyboardAvoidingView
  style={styles.container}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
  style={styles.backBtn}
  onPress={() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }}
>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>
            👤 {userName}
          </Text>
          <Text style={styles.headerSub}>
            {i18n.t('adminChat.subtitle')}
          </Text>
        </View>
      </View>

      {/* Mensajes */}
      <FlatList
        ref={flatListRef}
        data={listItems}
        keyExtractor={(item) =>
          'type' in item && item.type === 'separator'
            ? item.id
            : (item as Message).id
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyText}>
              {i18n.t('adminChat.empty.title', { name: userName })}
            </Text>
            <Text style={styles.emptySubtext}>
              {i18n.t('adminChat.empty.subtitle')}
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={i18n.t('adminChat.placeholder')}
          placeholderTextColor="#475569"
          multiline
          maxLength={500}
          onSubmitEditing={sendText}
        />
        <AudioRecordButton
          userId={user?.id ?? ''}
          onAudioReady={sendAudio}
          onError={(msg) => {
            if (Platform.OS === 'web') {
              window.alert(msg);
            } else {
              Alert.alert('Audio', msg);
            }
          }}
          disabled={sending}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!text.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={sendText}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// estilos sin cambios
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:      { color: '#64748b', fontSize: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#334155', gap: 12,
  },
  backButton:  { padding: 4 },
  backText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  headerInfo:  { flex: 1 },
  headerName:  { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  headerSub:   { color: '#64748b', fontSize: 11, marginTop: 1 },
  listContent: { padding: 16, gap: 8, flexGrow: 1 },
  separatorContainer: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginVertical: 12,
  },
  separatorLine:   { flex: 1, height: 1, backgroundColor: '#1e293b' },
  separatorText:   { color: '#475569', fontSize: 11, fontWeight: '600' },
  messageRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  messageRowRight: { justifyContent: 'flex-end' },
  messageRowLeft:  { justifyContent: 'flex-start' },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center',
  },
  avatarAdmin:  { backgroundColor: '#7f1d1d' },
  avatarText:   { color: '#f1f5f9', fontSize: 12, fontWeight: '700' },
  bubble:       { maxWidth: '75%', borderRadius: 16, padding: 10, gap: 4 },
  bubbleAdmin:  { backgroundColor: '#7f1d1d', borderBottomRightRadius: 4 },
  bubbleUser:   { backgroundColor: '#1e293b', borderBottomLeftRadius: 4 },
  adminBadge:   { color: '#ef4444', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  messageText:  { color: '#f1f5f9', fontSize: 14, lineHeight: 20 },
  messageTime:  { color: '#475569', fontSize: 10, alignSelf: 'flex-end' },
  readStatus:   { color: '#3b82f6', fontSize: 10 },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, gap: 8,
  },
  emptyIcon:    { fontSize: 40 },
  emptyText:    { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: '#475569', fontSize: 12 },
  inputArea: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderTopWidth: 1,
    borderTopColor: '#334155', padding: 10, gap: 8,
  },
  input: {
    flex: 1, backgroundColor: '#0f172a', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    color: '#f1f5f9', fontSize: 14, maxHeight: 100,
    borderWidth: 1, borderColor: '#334155',
  },
  sendButton:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#334155' },
  sendIcon:           { color: '#fff', fontSize: 18, fontWeight: '700' },
});