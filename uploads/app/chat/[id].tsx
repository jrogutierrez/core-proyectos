// app/chat/[id].tsx
// Chat individual usuario ↔ admin
// Con audio + encriptación triple
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Platform, ActivityIndicator, 
  Alert, Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
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
// Helpers
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

const ADMIN_ID = 'admin';

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export default function ChatScreen() {
  const { id: receiverId, name: receiverName } = useLocalSearchParams<{
    id: string; name: string;
  }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [messages,  setMessages]  = useState<Message[]>([]);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [text,      setText]      = useState('');
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // ── Altura dinámica del teclado ────────────────────────────
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Escuchar cuando el teclado sube y baja
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Pequeño delay para asegurar que el scroll baje al final con el teclado abierto
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // ── Cargar mensajes ────────────────────────────────────────
  const loadMessages = async () => {
    if (!user?.id || !receiverId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),` +
        `and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CHAT] Error cargando mensajes:', error);
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
      .eq('sender_id', receiverId)
      .eq('is_read', false);
  };

  // ── Realtime ───────────────────────────────────────────────
  useEffect(() => {
    loadMessages();

    const existingChannel = supabase
      .getChannels()
      .find((ch: any) => ch.topic === `realtime:chat-${user?.id}-${receiverId}`);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase
      .channel(`chat-${user?.id}-${receiverId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as Message;
          const isRelevant =
            (msg.sender_id === user?.id && msg.receiver_id === receiverId) ||
            (msg.sender_id === receiverId && msg.receiver_id === user?.id);

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
            console.error('[CHAT] Error desencriptando mensaje nuevo');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, receiverId]);

  useEffect(() => {
    if (!loading && listItems.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  }, [loading]);

  // ── Enviar texto ───────────────────────────────────────────
  const sendText = async () => {
    if (!text.trim() || !user?.id || !receiverId || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);

    try {
      const encrypted = await encryptMessage(content, 'text');
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id, receiver_id: receiverId,
        content: encrypted, type: 'text', is_read: false,
      });

      if (error) {
        console.error('[CHAT] Error enviando texto:', error);
        if (Platform.OS === 'web') {
          window.alert(i18n.t('adminChat.errors.send'));
        } else {
          Alert.alert(i18n.t('common.error'), i18n.t('adminChat.errors.send'));
        }
      } else if (profile?.role === 'admin') {
        await saveAdminInstruction(receiverId, content, 'text');
      }
    } catch (error) {
      console.error('[CHAT] Error encriptando:', error);
    } finally {
      setSending(false);
    }
  };

  // ── Enviar audio ───────────────────────────────────────────
  const sendAudio = async (url: string, duration: number) => {
    if (!user?.id || !receiverId) return;
    setSending(true);

    try {
      const encrypted = await encryptMessage(url, 'audio');
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id, receiver_id: receiverId,
        content: encrypted, type: 'audio', duration, is_read: false,
      });

      if (error) {
        console.error('[CHAT] Error enviando audio:', error);
        if (Platform.OS === 'web') {
          window.alert(i18n.t('adminChat.errors.audio'));
        } else {
          Alert.alert(i18n.t('common.error'), i18n.t('adminChat.errors.audio'));
        }
      } else if (profile?.role === 'admin') {
        await saveAdminInstruction(receiverId, url, 'audio');
      }
    } catch (error) {
      console.error('[CHAT] Error encriptando audio:', error);
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

    const msg      = item as Message;
    const isOwn    = msg.sender_id === user?.id;
    const isAdminMsg = msg.sender_id === ADMIN_ID || profile?.role === 'admin';

    return (
      <View style={[
        styles.messageRow,
        isOwn ? styles.messageRowRight : styles.messageRowLeft,
      ]}>
        {!isOwn && (
          <View style={[styles.avatar, isAdminMsg && styles.avatarAdmin]}>
            <Text style={styles.avatarText}>
              {isAdminMsg ? '🛡️' : (receiverName?.[0] ?? '?')}
            </Text>
          </View>
        )}

        <View style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          isAdminMsg && !isOwn && styles.bubbleAdmin,
        ]}>
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
              isAdmin={isAdminMsg && !isOwn}
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
          {i18n.t('chatDetail.loading')}
        </Text>
      </View>
    );
  }

  // ── Render principal ───────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Area de Chat (Ocupa todo el alto dinámico) ── */}
      <View style={styles.chatMainArea}>
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
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>
              {receiverName ?? 'Chat'}
            </Text>
            <Text style={styles.headerSub}>
              {i18n.t('chatDetail.encrypted')}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Lista de mensajes */}
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
                {i18n.t('chatDetail.empty.title')}
              </Text>
              <Text style={styles.emptySubtext}>
                {i18n.t('chatDetail.empty.subtitle')}
              </Text>
            </View>
          }
        />

        {/* Input area */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={i18n.t('chatDetail.placeholder')}
            placeholderTextColor="#475569"
            multiline
            maxLength={500}
            onSubmitEditing={sendText}
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
      </View>

      {/* ── Espaciador Dinámico (Sube con el Teclado) ── */}
      <View 
        style={[
          styles.systemNavigationSafeArea,
          { 
                        height: keyboardHeight > 0 
              ? keyboardHeight + 45
              : (Platform.OS === 'android' ? 36 : 20) 
          }
        ]} 
      />
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Fondo azul oscuro absoluto en toda la pantalla
  },
  chatMainArea: {
    flex: 1, // Se redimensiona automáticamente cuando el espaciador de abajo crece
    backgroundColor: '#0f172a',
  },
  systemNavigationSafeArea: {
    backgroundColor: '#1e293b', // Mismo color del inputArea para una fusión visual perfecta
    width: '100%',
  },
  loadingContainer: { 
    flex: 1, 
    backgroundColor: '#0f172a', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12 
  },
  loadingText: { 
    color: '#64748b', 
    fontSize: 14 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 44 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 12,
  },
  backText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '300',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: { 
    flex: 1 
  },
  headerName: { 
    color: '#f1f5f9', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  headerSub: { 
    color: '#64748b', 
    fontSize: 11, 
    marginTop: 1 
  },
  listContent: {
    padding: 16,
    gap: 8,
    flexGrow: 1,
    paddingBottom: 16,
  },
  separatorContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 8, 
    marginVertical: 12,
  },
  separatorLine: { 
    flex: 1, 
    height: 1, 
    backgroundColor: '#1e293b' 
  },
  separatorText: { 
    color: '#475569', 
    fontSize: 11, 
    fontWeight: '600' 
  },
  messageRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    gap: 8, 
    marginBottom: 4 
  },
  messageRowRight: { 
    justifyContent: 'flex-end' 
  },
  messageRowLeft: { 
    justifyContent: 'flex-start' 
  },
  avatar: {
    width: 30, 
    height: 30, 
    borderRadius: 15,
    backgroundColor: '#334155', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  avatarAdmin: { 
    backgroundColor: '#7f1d1d' 
  },
  avatarText: { 
    color: '#f1f5f9', 
    fontSize: 12, 
    fontWeight: '700' 
  },
  bubble: { 
    maxWidth: '75%', 
    borderRadius: 16, 
    padding: 10, 
    gap: 4 
  },
  bubbleOwn: { 
    backgroundColor: '#1e3a5f', 
    borderBottomRightRadius: 4 
  },
  bubbleOther: { 
    backgroundColor: '#1e293b', 
    borderBottomLeftRadius: 4 
  },
  bubbleAdmin: { 
    backgroundColor: '#7f1d1d', 
    borderBottomLeftRadius: 4 
  },
  messageText: { 
    color: '#f1f5f9', 
    fontSize: 14, 
    lineHeight: 20 
  },
  messageTime: { 
    color: '#475569', 
    fontSize: 10, 
    alignSelf: 'flex-end' 
  },
  readStatus: { 
    color: '#3b82f6', 
    fontSize: 10 
  },
  emptyContainer: {
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 60, 
    gap: 8,
  },
  emptyIcon: { 
    fontSize: 40 
  },
  emptyText: { 
    color: '#f1f5f9', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  emptySubtext: { 
    color: '#475569', 
    fontSize: 12, 
    textAlign: 'center' 
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? 12 : 10,
    paddingBottom: 10,
    color: '#f1f5f9',
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 110,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#334155',
    textAlignVertical: 'top',
  },
  sendButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#ef4444', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  sendButtonDisabled: { 
    backgroundColor: '#334155' 
  },
  sendIcon: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '700' 
  },
});