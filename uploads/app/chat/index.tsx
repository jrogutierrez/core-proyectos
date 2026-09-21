import { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Phone, Shield } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { decryptMessage } from '@/services/crypto/triple-cipher';
import i18n from '@/i18n';
import { getChatTime } from '@/utils/timeAgo';

interface Conversation {
  oderId:   string;
  name:     string;
  role:     string;
  lastMsg:  string;
  lastTime: string;
  unread:   number;
}

function getMessagePreview(content: string): string {
  if (content.startsWith('AUD:')) return i18n.t('chat.audioMsg');
  if (content.startsWith('TXT:')) return i18n.t('chat.encrypted');
  if (content.length > 40)        return content.slice(0, 40) + '...';
  return content;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

export default function ChatListScreen() {
  const router    = useRouter();
    const { user, profile }  = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading]             = useState(true);

      // ── Llamada a contacto de emergencia ──────────────────────
  const handleEmergencyCall = async () => {
    const phone = profile?.emergency_contact_phone?.trim();

    if (!phone) {
      if (Platform.OS === 'web') {
        window.alert('Contacto no configurado\n\nTodavía no cargaste un contacto de emergencia. Configuralo en Ajustes.');
      } else {
        Alert.alert(
          'Contacto no configurado',
          'Todavía no cargaste un contacto de emergencia. Configuralo en Ajustes.'
        );
      }
      return;
    }

    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    const telUrl = `tel:${cleanedPhone}`;

    if (Platform.OS === 'web') {
      window.alert(`Tu contacto de emergencia es: ${phone}\n\nEn la versión móvil se abrirá el marcador automáticamente.`);
      return;
    }

    try {
      // Intentamos abrir la llamada directamente (Evita problemas de canOpenURL en Android 11+)
      await Linking.openURL(telUrl);
    } catch {
      Alert.alert('Error', `No se pudo iniciar la llamada. Intentá llamar manualmente a: ${phone}`);
    }
  };

  // ── Cargar conversaciones ──────────────────────────────────
  const loadConversations = async () => {
    if (!user?.id) return;

    try {
      const { data: messages } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, created_at, is_read')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) {
        await addAdminAsDefault();
        setLoading(false);
        return;
      }

      const convMap: Record<string, {
        oderId:   string;
        lastMsg:  string;
        lastTime: string;
        unread:   number;
      }> = {};

      for (const msg of messages) {
        const oderId = msg.sender_id === user.id
          ? msg.receiver_id
          : msg.sender_id;

        if (!convMap[oderId]) {
          let preview = msg.content || '';
          try {
            if (preview.startsWith('AUD:')) {
              preview = i18n.t('chat.audioMsg');
            } else if (preview.startsWith('TXT:')) {
              const { content } = await decryptMessage(preview);
              preview = content.length > 40
                ? content.slice(0, 40) + '...'
                : content;
            }
          } catch {
            preview = getMessagePreview(preview);
          }

          convMap[oderId] = {
            oderId,
            lastMsg:  preview,
            lastTime: msg.created_at,
            unread:   0,
          };
        }

        if (msg.sender_id !== user.id && !msg.is_read) {
          convMap[oderId].unread++;
        }
      }

      const oderIds = Object.keys(convMap);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', oderIds);

      const profileMap: Record<string, { name: string; role: string }> = {};
      for (const p of (profiles || [])) {
        profileMap[p.id] = { name: p.full_name, role: p.role };
      }

      const convList: Conversation[] = Object.values(convMap)
        .map((c) => ({
          ...c,
          name: profileMap[c.oderId]?.name || 'Usuario',
          role: profileMap[c.oderId]?.role || 'free',
        }))
        .sort((a, b) =>
          new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
        );

      setConversations(convList);

      const hasAdmin = convList.some((c) => c.role === 'admin');
      if (!hasAdmin) await addAdminAsDefault();

    } catch (err) {
      console.error('[Chat] Error cargando conversaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Admin como contacto default ────────────────────────────
  const addAdminAsDefault = async () => {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'admin')
      .limit(1);

    if (admins && admins.length > 0) {
      const admin = admins[0];
      setConversations((prev) => {
        const exists = prev.some((c) => c.oderId === admin.id);
        if (exists) return prev;
        return [
          {
            oderId:   admin.id,
            name:     admin.full_name,
            role:     'admin',
            lastMsg:  i18n.t('chat.defaultMsg'),
            lastTime: new Date().toISOString(),
            unread:   0,
          },
          ...prev,
        ];
      });
    }
  };

  useEffect(() => { loadConversations(); }, [user?.id]);

  // ── Realtime ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-chat-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id || msg.receiver_id === user.id) {
            loadConversations();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <SafeAreaView style={styles.container}>

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
          <ChevronLeft size={28} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {i18n.t('chat.title')}
        </Text>
                <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleEmergencyCall}
        >
          <Phone size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Contenido */}
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={Colors.teal} size="large" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyText}>
            {i18n.t('chat.empty.noConversations')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.oderId}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const isAdmin = item.role === 'admin';

            return (
              <TouchableOpacity
                style={styles.contactRow}
                activeOpacity={0.75}
                onPress={() => router.push({
                  pathname: '/chat/[id]',
                  params: { id: item.oderId, name: item.name },
                })}
              >
                {/* Avatar */}
                <View style={[
                  styles.avatar,
                  isAdmin && styles.avatarAdmin,
                ]}>
                  {isAdmin ? (
                    <Shield size={24} color="#e74c3c" />
                  ) : (
                    <Text style={styles.avatarInitials}>
                      {getInitials(item.name)}
                    </Text>
                  )}
                </View>

                {/* Info */}
                <View style={styles.textArea}>
                  <View style={styles.nameRow}>
                    <View style={styles.nameWithBadge}>
                      <Text style={styles.contactName}>
                        {isAdmin
                          ? i18n.t('chat.support.name')
                          : item.name}
                      </Text>
                      {isAdmin && (
                        <View style={styles.adminTag}>
                          <Text style={styles.adminTagText}>
                            {i18n.t('chat.support.tag')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.timeText}>
                      {getChatTime(item.lastTime)}
                    </Text>
                  </View>

                  <View style={styles.msgRow}>
                    <Text style={styles.lastMsg} numberOfLines={2}>
                      {getMessagePreview(item.lastMsg)}
                    </Text>
                    {item.unread > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.bg },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCenter:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText:     { color: '#666', fontSize: 15 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 1.5 },
  iconBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  list:        { paddingVertical: 8 },
  separator:   { height: 1, backgroundColor: Colors.borderColor, marginLeft: 88 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 16,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2a2a4e',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarAdmin: {
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderWidth: 2, borderColor: 'rgba(231,76,60,0.4)',
  },
  avatarInitials: { color: Colors.teal, fontSize: 18, fontWeight: 'bold' },
  textArea:       { flex: 1 },
  nameRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  nameWithBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  contactName:   { color: Colors.white, fontSize: 16, fontWeight: '600' },
  adminTag: {
    backgroundColor: 'rgba(231,76,60,0.2)',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  adminTagText: { color: '#e74c3c', fontSize: 10, fontWeight: 'bold' },
  timeText:     { color: Colors.greyDark, fontSize: 12 },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lastMsg:      { color: Colors.whiteAlpha70, fontSize: 14, lineHeight: 20, flex: 1 },
  badge: {
    backgroundColor: Colors.teal, borderRadius: 10,
    minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: Colors.bg, fontSize: 11, fontWeight: '700' },
});