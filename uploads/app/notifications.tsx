import { useState, useEffect, useCallback } from 'react';
import {
   ScrollView, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
  Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Phone, AlertTriangle, Info,
  Wind, Zap, CloudRain, Flame, Mountain,
  Waves, Bell, BellOff,
} from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import i18n from '@/i18n';
import { getLocalizedDateTime } from '@/utils/dateLocale';
import { getTimeAgo } from '@/utils/timeAgo';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface AlertData {
  id:          string;
  title:       string;
  description: string;
  type:        string;
  severity:    string;
  latitude:    number;
  longitude:   number;
  radius_km:   number;
  is_active:   boolean;
  source:      string;
  created_at:  string;
  expires_at:  string | null;
  created_by:  string | null;
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function AlertIcon({ type }: { type: string }) {
  if (type === 'storm')                        return <Zap          size={22} color="#fff" />;
  if (type === 'fire')                         return <Flame        size={22} color="#fff" />;
  if (type === 'earthquake')                   return <AlertTriangle size={22} color="#fff" />;
  if (type === 'volcano')                      return <Mountain     size={22} color="#fff" />;
  if (type === 'flood' || type === 'tsunami')  return <Waves        size={22} color="#fff" />;
  if (type === 'wind')                         return <Wind         size={22} color="#fff" />;
  if (type === 'rain')                         return <CloudRain    size={22} color="#fff" />;
  return <Info size={22} color="#fff" />;
}

function severityColor(severity: string): string {
  if (severity === 'critical') return '#c0392b';
  if (severity === 'high')     return '#e74c3c';
  if (severity === 'medium')   return '#e67e22';
  return Colors.teal;
}

function severityLabel(severity: string): string {
  return i18n.t(`common.severity.${severity}`) || 'INFO';
}

function typeLabel(type: string): string {
  return i18n.t(`common.alertTypes.${type}`) || '⚠️ Alerta';
}

// ─────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();
  const { profile } = useAuth();

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

  const [alerts,     setAlerts]     = useState<AlertData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  // ── Cargar alertas ────────────────────────────────────────
  const fetchAlerts = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');

    try {
      const { data, error: dbError } = await supabase
        .from('alerts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (dbError) {
        console.error('[Notifications] Error:', dbError);
        setError(i18n.t('notifications.error'));
        return;
      }

      const now = new Date();
      const activeAlerts = (data ?? []).filter((a) => {
        if (!a.expires_at) return true;
        return new Date(a.expires_at) > now;
      });

      console.log('[Notifications] Alertas activas:', activeAlerts.length);
      setAlerts(activeAlerts);
    } catch (err: any) {
      console.error('[Notifications] Excepción:', err.message);
      setError(i18n.t('notifications.errorNetwork'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // ── Realtime ──────────────────────────────────────────────
 // ── Realtime ──────────────────────────────────────────────
useEffect(() => {
  // 🔧 Fix: remover canal zombie antes de crear uno nuevo
  const existing = supabase
    .getChannels()
    .find((ch) => ch.topic === 'realtime:alerts-realtime');
  if (existing) {
    supabase.removeChannel(existing);
  }

  const channel = supabase
    .channel('alerts-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'alerts' },
      (payload) => {
        console.log('[Notifications] Cambio detectado:', payload.eventType);
        fetchAlerts(false);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []); // ← ✅ sin fetchAlerts como dependencia

  // ── Pull to refresh ───────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAlerts(false);
  }, [fetchAlerts]);

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
          {i18n.t('notifications.title')}
        </Text>
                <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleEmergencyCall}
        >
          <Phone size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.teal}
            colors={[Colors.teal]}
          />
        }
      >
        {/* Cargando */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.teal} />
            <Text style={styles.centerText}>
              {i18n.t('notifications.loading')}
            </Text>
          </View>
        )}

        {/* Error */}
        {error && !loading && (
          <View style={styles.errorBox}>
            <AlertTriangle size={20} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchAlerts()}
            >
              <Text style={styles.retryText}>
                {i18n.t('notifications.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sin alertas */}
        {!loading && !error && alerts.length === 0 && (
          <View style={styles.emptyBox}>
            <BellOff size={48} color={Colors.whiteAlpha70} />
            <Text style={styles.emptyTitle}>
              {i18n.t('notifications.empty.title')}
            </Text>
            <Text style={styles.emptySubtext}>
              {i18n.t('notifications.empty.subtitle')}
            </Text>
          </View>
        )}

        {/* Alertas activas */}
        {!loading && alerts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Bell size={16} color={Colors.teal} />
              <Text style={styles.sectionTitle}>
                {i18n.t('notifications.section', { n: alerts.length })}
              </Text>
            </View>

            {alerts.map((alert) => (
              <View
                key={alert.id}
                style={[
                  styles.alertCard,
                  alert.severity === 'critical' && styles.alertCardCritical,
                  alert.severity === 'high'     && styles.alertCardHigh,
                ]}
              >
                <View style={[
                  styles.alertBadge,
                  { backgroundColor: severityColor(alert.severity) },
                ]}>
                  <AlertIcon type={alert.type} />
                </View>

                <View style={styles.alertBody}>
                  {/* Header */}
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertTitle}>
                      {typeLabel(alert.type)}
                    </Text>
                    <View style={[
                      styles.levelTag,
                      { backgroundColor: severityColor(alert.severity) + '33' },
                    ]}>
                      <Text style={[
                        styles.levelText,
                        { color: severityColor(alert.severity) },
                      ]}>
                        {severityLabel(alert.severity)}
                      </Text>
                    </View>
                  </View>

                  {/* Título real */}
                  <Text style={styles.alertRealTitle}>{alert.title}</Text>

                  {/* Descripción */}
                  <Text style={styles.alertDesc}>{alert.description}</Text>

                  {/* Tiempos */}
                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>
                      {i18n.t('notifications.created')}
                    </Text>
                    <Text style={styles.timeVal}>
                      {getLocalizedDateTime(alert.created_at)}
                    </Text>
                  </View>

                  {alert.expires_at && (
                    <View style={styles.timeRow}>
                      <Text style={styles.timeLabel}>
                        {i18n.t('notifications.expires')}
                      </Text>
                      <Text style={styles.timeVal}>
                        {getLocalizedDateTime(alert.expires_at)}
                      </Text>
                    </View>
                  )}

                  {/* Radio y fuente */}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {i18n.t('notifications.radius', { n: alert.radius_km })}
                    </Text>
                    {alert.source && (
                      <Text style={styles.metaText}>
                        {i18n.t('notifications.source', { name: alert.source })}
                      </Text>
                    )}
                  </View>

                  {/* Hace cuánto */}
                  <Text style={styles.alertAgo}>
                    {getTimeAgo(alert.created_at)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Info box */}
        <View style={styles.infoBox}>
          <Info size={16} color={Colors.teal} />
          <Text style={styles.infoText}>
            {i18n.t('notifications.realtime')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// estilos sin cambios
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 1.5 },
  iconBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content:     { padding: 16, gap: 12, paddingBottom: 32 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 4,
  },
  sectionTitle: {
    color: Colors.whiteAlpha70, fontSize: 13,
    fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  centerBox: {
    alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 12,
  },
  centerText: { color: Colors.whiteAlpha70, fontSize: 14 },
  errorBox: {
    backgroundColor: 'rgba(255,49,49,0.08)', borderRadius: 12,
    padding: 16, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,49,49,0.25)',
  },
  errorText: { color: Colors.red, fontSize: 13 },
  retryBtn: {
    backgroundColor: 'rgba(255,49,49,0.15)', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 4,
  },
  retryText: { color: Colors.red, fontSize: 13, fontWeight: '600' },
  emptyBox: {
    alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 12,
  },
  emptyTitle:   { color: Colors.white, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: Colors.whiteAlpha70, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  alertCard: {
    backgroundColor: Colors.bgCard, borderRadius: 16,
    padding: 16, flexDirection: 'row', gap: 14,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  alertCardCritical: { borderColor: '#c0392b', borderWidth: 2, backgroundColor: 'rgba(192,57,43,0.06)' },
  alertCardHigh:     { borderColor: '#e74c3c', borderWidth: 2, backgroundColor: 'rgba(231,76,60,0.04)' },
  alertBadge: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  alertBody:   { flex: 1, gap: 6 },
  alertHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
  },
  alertTitle:     { color: Colors.white, fontSize: 15, fontWeight: '600', flex: 1 },
  alertRealTitle: { color: Colors.teal, fontSize: 14, fontWeight: '500' },
  levelTag:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  levelText:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  alertDesc:      { color: Colors.whiteAlpha70, fontSize: 13, lineHeight: 18 },
  timeRow:        { flexDirection: 'row', alignItems: 'center' },
  timeLabel:      { color: Colors.whiteAlpha70, fontSize: 12 },
  timeVal:        { color: Colors.teal, fontSize: 12, fontWeight: '600' },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  metaText:       { color: Colors.whiteAlpha70, fontSize: 11 },
  alertAgo:       { color: Colors.greyDark, fontSize: 11, marginTop: 2 },
  infoBox: {
    backgroundColor: 'rgba(92,225,230,0.08)', borderRadius: 12,
    padding: 14, flexDirection: 'row', gap: 10,
    borderWidth: 1, borderColor: 'rgba(92,225,230,0.25)',
  },
  infoText: { color: Colors.whiteAlpha70, fontSize: 13, lineHeight: 18, flex: 1 },
});