// ── Polyfill debe ser lo primero pero declarado como import ───
import { applyCryptoPolyfill } from '@/services/crypto/crypto-polyfill';

// ── Imports de React ──────────────────────────────────────────
import { useEffect, useState, useRef, useCallback } from 'react';

// ── Imports de React Native ───────────────────────────────────
import {
  View, Text, ActivityIndicator, StyleSheet,
  Platform, AppState, AppStateStatus, TouchableOpacity,
  DevSettings,
} from 'react-native';

// ── Imports de Expo ───────────────────────────────────────────
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { Session } from '@supabase/supabase-js';

//Imports Notifications
import { setupNotificationChannels } from '@/services/local-notifications';


// ── Imports locales ───────────────────────────────────────────
import '@/i18n';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { supabase } from '@/lib/supabase';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { AssistantProvider } from '@/context/AssistantContext';
import { FloatingAssistantBubble } from '@/components/FloatingAssistantBubble';
import { LegalDisclaimerModal } from '@/components/LegalDisclaimerModal';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useSosSound } from '@/hooks/useSosSound';
import { useAdminAlerts } from '@/hooks/useAdminAlerts';
import { useNetworkReconnect } from '@/hooks/useNetworkReconnect';
import Mapbox from '@rnmapbox/maps';

// ── Activar polyfill solo en nativo ───────────────────────────
if (Platform.OS !== 'web') {
  try {
    applyCryptoPolyfill();
  } catch (e) {
    console.warn('[Layout] Error en polyfill:', e);
  }
}

Mapbox.setAccessToken('pk.eyJ1IjoiZGVmZW5zb3JqcmciLCJhIjoiY210Znh3NHRmMWFsajJ6cTVjYmw1bmVvZiJ9.bMQzUqmaNHWxV-goOq9d1A');

// ─────────────────────────────────────────────────────────────
export default function RootLayout() {
  useFrameworkReady();

  // ── Estados principales ──────────────────────────────────
  const [session,        setSession]        = useState<Session | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [userRole,       setUserRole]       = useState<'free' | 'pro' | 'admin' | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // ── Hooks que dependen de sesión / rol ───────────────────
  /*useNotifications(session?.user?.id);
  const { unreadCount } = useUnreadMessages();
  useSosSound();
  useAdminAlerts(session?.user?.id);*/

  useNotifications(session?.user?.id);
  const { unreadCount } = useUnreadMessages();
  useSosSound();
  useAdminAlerts(session?.user?.id);
  useNetworkReconnect({
  onReconnect: () => {
    if (session?.user?.id) {
      fetchUserRole(session.user.id);
    }
  },
 });


  // ── Router / refs ────────────────────────────────────────
  const router           = useRouter();
  const segments         = useSegments();
  const appStateRef      = useRef<AppStateStatus>(AppState.currentState);
  const reconnectingRef  = useRef(false);

  // ── Obtener rol del usuario ──────────────────────────────
  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Security] Error obteniendo rol:', error);
        setUserRole(null);
        return;
      }

      const role = (data?.role as 'free' | 'pro' | 'admin' | undefined) ?? null;
      console.log('[Security] Rol detectado:', role);
      setUserRole(role);
    } catch (error) {
      console.error('[Security] Excepción obteniendo rol:', error);
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
  setupNotificationChannels();
}, []);

    // ── Recuperar sesión manualmente ─────────────────────────
  const recoverSession = useCallback(async () => {
    console.log('[Layout] Recuperando sesión...');
    setLoadingTimeout(false);

    const safetyTimer = setTimeout(() => {
      console.warn('[Layout] Safety timeout — forzando salida');
      setLoading(false);
      setLoadingTimeout(false);
    }, 20000);

    try {
      // Esperar red disponible
      let networkOk = false;
      for (let i = 0; i < 8; i++) {
        try {
          const res = await fetch('https://www.google.com/generate_204', {
            method: 'HEAD',
            cache: 'no-cache',
          });
          if (res.status === 204 || res.ok) {
            networkOk = true;
            break;
          }
        } catch {}
        console.log(`[Layout] Esperando red... intento ${i + 1}/8`);
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!networkOk) {
        console.warn('[Layout] Sin red — no se puede recuperar sesión');
        setLoading(false);
        clearTimeout(safetyTimer);
        return;
      }

      // Reconectar Realtime
      try {
        await supabase.realtime.disconnect();
        await new Promise((r) => setTimeout(r, 500));
        supabase.realtime.connect();
        console.log('[Layout] Realtime reconectado ✅');
      } catch (e) {
        console.warn('[Layout] Error reconectando Realtime:', e);
      }

      // Usar getSession directo
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.warn('[Layout] Error en getSession:', error.message);
        setSession(null);
        setUserRole(null);
        return;
      }

      if (session?.user?.id) {
        console.log('[Layout] Sesión recuperada ✅', session.user.email);
        setSession(session);
        await fetchUserRole(session.user.id);
      } else {
        console.log('[Layout] Sin sesión válida → login');
        setSession(null);
        setUserRole(null);
      }
    } catch (e) {
      console.warn('[Layout] Error en recoverSession:', e);
      setSession(null);
      setUserRole(null);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
      setLoadingTimeout(false);
      console.log('[Layout] recoverSession finalizado');
    }
  }, [fetchUserRole]);

  // ── Reinicio completo de la app ─────────────────────────
  const hardReloadApp = useCallback(async () => {
    console.log('[Layout] Reinicio completo solicitado');

    try {
      if (__DEV__) {
        DevSettings.reload();
        return;
      }

      await Updates.reloadAsync();
    } catch (e) {
      console.warn('[Layout] Error reiniciando app:', e);
      setSession(null);
      setUserRole(null);
      setLoading(false);
      setLoadingTimeout(false);
    }
  }, []);

  // ── AppState — detectar vuelta de background ──────────────
  useEffect(() => {
  const subscription = AppState.addEventListener(
    'change',
    async (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active' &&
        !reconnectingRef.current
      ) {
        reconnectingRef.current = true;
        console.log('[AppState] App volvió al frente — reconexión completa');

        try {
          // Reconectar Realtime primero
          try {
            await supabase.realtime.disconnect();
            await new Promise(r => setTimeout(r, 600));
            supabase.realtime.connect();
            console.log('[AppState] Realtime reconectado ✅');
          } catch (realtimeErr) {
            console.warn('[AppState] Error reconectando Realtime:', realtimeErr);
          }

          // getSession directo (sin refreshSession que tarda mucho)
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user?.id) {
            setSession(session);
            await fetchUserRole(session.user.id);
            console.log('[AppState] Sesión refrescada ✅');
          } else {
            setSession(null);
            setUserRole(null);
          }

        } catch (e) {
          console.warn('[AppState] Error en reconexión:', e);
        } finally {
          reconnectingRef.current = false;
        }
      }
      appStateRef.current = nextState;
    }
  );

  return () => subscription.remove();
}, [fetchUserRole]);

  // ── Timeout de carga (5  a 15 segundos) ────────────────────────
  useEffect(() => {
  if (!loading) return;

  // Dar más tiempo cuando viene de background largo
  const timeout = setTimeout(() => {
    if (loading) {
      console.warn('[Layout] Timeout — mostrando botón de recuperación');
      setLoadingTimeout(true);
    }
  }, 15000); // ← de 5s a 15s

  return () => clearTimeout(timeout);
}, [loading]);

  // ── Sesión inicial ────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        await fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user?.id) {
          await fetchUserRole(session.user.id);
        } else {
          setUserRole(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  // ── Inactividad admin ─────────────────────────────────────
  useInactivityLogout({
    enabled:   !!session && userRole === 'admin' && !loading,
    timeoutMs: 15 * 60 * 1000,
    onLogout:  () => {
      console.log('[Security] Sesión admin cerrada por inactividad');
    },
  });

  // ── Navegación según sesión ───────────────────────────────
  useEffect(() => {
    if (loading) return;

    const inAuthScreen = segments[0] === 'auth';

    if (!session && !inAuthScreen) {
      router.replace('/auth');
    } else if (session && inAuthScreen) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  // ── Disclaimer legal ──────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    const checkDisclaimer = async () => {
      try {
        if (Platform.OS === 'web') {
          const accepted = localStorage.getItem('legal_disclaimer_accepted');
          if (!accepted) setShowDisclaimer(true);
        } else {
          const SecureStore = require('expo-secure-store');
          const accepted = await SecureStore.getItemAsync('legal_disclaimer_accepted');
          if (!accepted) setShowDisclaimer(true);
        }
      } catch {
        setShowDisclaimer(true);
      }
    };

    checkDisclaimer();
  }, [loading]);

  const handleAcceptDisclaimer = async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('legal_disclaimer_accepted', 'true');
      } else {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync('legal_disclaimer_accepted', 'true');
      }
    } catch (e) {
      console.warn('[Legal] Error guardando aceptación:', e);
    }
    setShowDisclaimer(false);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <AssistantProvider>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#5ce1e6" />
          <StatusBar style="light" />

          {loadingTimeout && (
           <TouchableOpacity
  style={styles.recoverBtn}
  onPress={hardReloadApp}
>
  <Text style={styles.recoverText}>
    Reiniciar aplicación
  </Text>
</TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <Stack screenOptions={{
            headerShown: false,
            animation:   'slide_from_right',
          }}>
            <Stack.Screen name="auth" />
            <Stack.Screen name="index" />
            <Stack.Screen name="search" />
            <Stack.Screen name="weather" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="history" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="call" />
            <Stack.Screen name="chat/index" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="+not-found" />
          </Stack>

          <StatusBar style="light" />
          <FloatingAssistantBubble />

          <LegalDisclaimerModal
            visible={showDisclaimer}
            onAccept={handleAcceptDisclaimer}
            dismissOnBackdrop={false}
          />
        </>
      )}
    </AssistantProvider>
  );
}

// ── Estilos ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  loading: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: '#1f214c',
    gap:             20,
  },
  recoverBtn: {
    marginTop:        20,
    paddingHorizontal: 28,
    paddingVertical:   14,
    backgroundColor:  'rgba(92,225,230,0.15)',
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      '#5ce1e6',
  },
  recoverText: {
    color:      '#5ce1e6',
    fontSize:   16,
    fontWeight: '600',
  },
});