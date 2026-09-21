import { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
  Alert, Vibration, ActivityIndicator,
  Platform, TextInput, ScrollView,
  Animated, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Phone, MessageCircle, Search, Bell,
  CloudRain, AlertTriangle, Info,
  Settings, ShieldAlert, ChevronRight,
} from 'lucide-react-native';
import { useEmergencyData } from '@/hooks/useEmergencyData';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { activateSOS, deactivateSOS, checkSOSStatus } from '@/services/sos';
import { useRealtimeSOS } from '@/hooks/useRealtimeSOS';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

import { getWeatherForContext } from '@/services/weather-context';
import { useLocation } from '@/hooks/useLocation';
import {
  speakAssistantText, stopAssistantVoice, shouldUseVoice,
} from '@/services/voice';
import { useAssistant as useHomeAssistant } from '@/hooks/useAssistant';
import { useAssistant as useAssistantContext } from '@/context/AssistantContext';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useHasActiveAlerts } from '@/hooks/useHasActiveAlerts';

import i18n from '../i18n';
import {
  checkSOSSecurity, registerSOSActivation,
  registerSOSDeactivation, isSOSSuspicious,
} from '@/services/sos-security';

// ── Puntos orbitales ───────────────────────────────────────
const MAIN_DOT_COUNT    = 16;
const MAIN_DOT_SIZE     = 5;
const MAIN_ORBIT_RADIUS = 105;
const MAIN_RING_SIZE    = 210;

function MainOrbitalDots({ status }: { status: string }) {
  const isSpeaking = status === 'speaking';
  const isThinking = status === 'thinking';

  const dots = [];
  for (let i = 0; i < MAIN_DOT_COUNT; i++) {
    const angle = (i / MAIN_DOT_COUNT) * 2 * Math.PI;
    const x = MAIN_RING_SIZE / 2 + Math.cos(angle) * MAIN_ORBIT_RADIUS - MAIN_DOT_SIZE / 2;
    const y = MAIN_RING_SIZE / 2 + Math.sin(angle) * MAIN_ORBIT_RADIUS - MAIN_DOT_SIZE / 2;

    const isLarge = i % 4 === 0;
    const size = isSpeaking
      ? (isLarge ? MAIN_DOT_SIZE + 3 : MAIN_DOT_SIZE + 1)
      : isThinking
        ? (isLarge ? MAIN_DOT_SIZE + 2 : MAIN_DOT_SIZE)
        : (isLarge ? MAIN_DOT_SIZE + 1 : MAIN_DOT_SIZE - 1);

    const color   = isSpeaking ? '#00ffb4' : isThinking ? '#00d4ff' : '#9a9dab';
    const opacity = isSpeaking ? 0.9 : isThinking ? 0.8 : 0.45;

    dots.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: x, top: y,
          width: size, height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
        }}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', width: MAIN_RING_SIZE, height: MAIN_RING_SIZE }}
    >
      {dots}
    </View>
  );
}

// ── Componente principal ───────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const { unreadCount } = useUnreadMessages();
    // ── Escalón 2: Conteo de amenazas reales para el inicio ──
  const { markers: homeMarkers } = useEmergencyData();
  const { alerts: homeAlerts } = useProximityAlerts(homeMarkers);
  const activeAlertsCount = homeAlerts.length;

  const chatPulse = useRef(new Animated.Value(1)).current;
  const hasActiveAlerts = useHasActiveAlerts();
const climaPulse = useRef(new Animated.Value(1)).current;
const assistantScrollRef = useRef<ScrollView>(null);

  const [isEmergency,      setIsEmergency]      = useState(false);
  const [sosLoading,       setSOSLoading]        = useState(false);
  const [currentWeather,   setCurrentWeather]    = useState<string | undefined>(undefined);
  const [assistantInput,   setAssistantInput]    = useState('');
  const lastSpokenRef    = useRef<string>('');
  const [locationRequested, setLocationRequested] = useState(false);
  const { emergencyUsers } = useRealtimeSOS();

  const {
    location:          gpsLocation,
    cityName:          gpsCityName,
    permissionGranted: gpsPermission,
    requestLocation,
  } = useLocation(user?.id);

  const safeCity = gpsCityName ||
    (profile?.city && profile.city.trim().length >= 3
      ? profile.city
      : 'Ubicación no verificada');

  const safeCountry = profile?.country && profile.country.trim().length >= 2
    ? profile.country
    : 'País no verificado';

  const userContext = profile
    ? {
        userId:              user?.id,
        userRole:            profile?.role,
        name:                profile.full_name,
        country:             safeCountry,
        city:                safeCity,
        timezone:            profile.timezone ?? 'UTC',
        disability:          profile.disability,
        currentWeather,
        language_preference: i18n.language || profile.language_preference || 'es',
        isInEmergency:       isEmergency,
        emergencyId:         undefined,
      }
    : undefined;

  const {
    status:          assistantStatus,
    isActive:        assistantActive,
    lastResponse,
    sosRecommended,
    suggestedManuals,
    activate:        activateAssistant,
    deactivate:      deactivateAssistant,
    sendMessage:     sendToAssistant,
    openManual,
    pendingGoodbyeRef,
  } = useHomeAssistant(userContext);

    // ── Aviso táctico de ingreso de zona al abrir la app (Pegado acá de forma segura) ──
  const hasSpokenRef = useRef(false);

  useEffect(() => {
    if (
      activeAlertsCount > 0 &&
      !hasSpokenRef.current &&
      !assistantActive
    ) {
      hasSpokenRef.current = true;

      // Vibración de bienvenida táctica
      try {
        Vibration.vibrate([0, 300, 100, 300]);
      } catch (vibErr) {
        console.warn('[Voz Inicio] Vibración no disponible:', vibErr);
      }

      // Obtener el foco más cercano de la lista
      const topAlert = homeAlerts[0];
      const dist = topAlert ? Math.round(topAlert.distance) : 0;

      // Construir el reporte de situación según la distancia del peligro
      const welcomeMsg = dist <= 5
        ? `¡Atención! Emergencia activa a solo ${dist} kilómetros de su ubicación. Revise el mapa de inmediato.`
        : dist <= 20
          ? `Aviso de prevención. Se detectaron ${activeAlertsCount} amenazas dentro de su rango de protección. La más cercana a ${dist} kilómetros.`
          : `Vigilancia activa. ${activeAlertsCount} eventos meteorológicos y focos bajo monitoreo en su zona. El más cercano a ${dist} kilómetros.`;

      console.log('[Voz Inicio] 📢 Despachador dando reporte inicial:', welcomeMsg);

      // Delay de 800ms para dejar que cargue la interfaz antes de hablar
      setTimeout(() => {
        speakAssistantText(welcomeMsg);
      }, 800);
    }
  }, [activeAlertsCount, homeAlerts, assistantActive]);

  // ── Speech to Text ─────────────────────────────────────
  const {
    isListening,
    isSupported:  sttSupported,
    errorMessage: sttError,
    startListening,
    stopListening,
    status:       sttStatus,
  } = useSpeechToText({
    onTranscript: (text) => {
      setAssistantInput(text);
      sendToAssistant(text);
    },
    language: i18n.language || profile?.language_preference || 'es',
  });

  // ── Manos libres ────────────────────────────────────────
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const handsFreeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleHandsFreeMode = () => {
    if (!sttSupported) return;
    if (handsFreeMode) {
      setHandsFreeMode(false);
      stopListening();
    } else {
      setHandsFreeMode(true);
    }
  };

  const {
    isSpeaking:      assistantContextSpeaking,
    activate:        activateAssistantUI,
    deactivate:      deactivateAssistantUI,
    setLastResponse: setAssistantContextLastResponse,
    setIsSpeaking:   setAssistantContextSpeaking,
  } = useAssistantContext();

  // ── Effects ─────────────────────────────────────────────

  // Animación badge chat
  useEffect(() => {
    if (unreadCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(chatPulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(chatPulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      chatPulse.stopAnimation();
      chatPulse.setValue(1);
    }
  }, [unreadCount]);

  //useEffect de animación de clima
  useEffect(() => {
  if (hasActiveAlerts) {
    Animated.loop(
      Animated.sequence([
        Animated.timing(climaPulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(climaPulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  } else {
    climaPulse.stopAnimation();
    climaPulse.setValue(1);
  }
}, [hasActiveAlerts]);

  useEffect(() => {
    if (user?.id) checkSOSStatus(user.id).then(setIsEmergency);
  }, [user?.id]);

  useEffect(() => {
    if (profile?.is_in_emergency !== undefined) {
      setIsEmergency(profile.is_in_emergency);
    }
  }, [profile?.is_in_emergency]);

  useEffect(() => {
    if (user?.id && !locationRequested) {
      setLocationRequested(true);
      requestLocation();
    }
  }, [user?.id, locationRequested, requestLocation]);

  useEffect(() => {
    if (assistantActive) activateAssistantUI();
    else                 deactivateAssistantUI();
  }, [assistantActive, activateAssistantUI, deactivateAssistantUI]);

  useEffect(() => {
    setAssistantContextLastResponse(lastResponse ?? '');
  }, [lastResponse, setAssistantContextLastResponse]);

  useEffect(() => {
    if (!profile) return;
    const profileWithGPS = gpsLocation
      ? { ...profile, latitude: gpsLocation.latitude, longitude: gpsLocation.longitude, city: gpsCityName || profile.city }
      : profile;
    getWeatherForContext(profileWithGPS).then(setCurrentWeather);
  }, [profile, gpsLocation, gpsCityName]);

  useEffect(() => {
    if (!assistantActive || !lastResponse.trim()) return;
    if (lastResponse === lastSpokenRef.current) return;
    lastSpokenRef.current = lastResponse;
    if (!shouldUseVoice(profile?.disability)) return;

    setAssistantContextSpeaking(true);
    speakAssistantText(
      lastResponse,
      () => {
        setAssistantContextSpeaking(false);
        if (pendingGoodbyeRef.current) {
          pendingGoodbyeRef.current();
          pendingGoodbyeRef.current = null;
        }
      },
      profile?.country,
      i18n.language || profile?.language_preference || 'es'
    );
  }, [
    lastResponse, assistantActive,
    profile?.disability, profile?.country,
    profile?.language_preference, i18n.language,
    pendingGoodbyeRef, setAssistantContextSpeaking,
  ]);

  useEffect(() => {
    if (!assistantActive) {
      stopAssistantVoice();
      setAssistantContextSpeaking(false);
      lastSpokenRef.current = '';
    }
  }, [assistantActive, setAssistantContextSpeaking]);

  // ── Animación orbital ───────────────────────────────────
  const mainRotateAnim    = useRef(new Animated.Value(0)).current;
  const mainRotateLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (mainRotateLoopRef.current) {
      mainRotateLoopRef.current.stop();
      mainRotateLoopRef.current = null;
    }
    mainRotateAnim.setValue(0);

    const duration = assistantActive
      ? (assistantStatus === 'speaking' ? 2200
        : assistantStatus === 'thinking' ? 3000 : 10000)
      : 18000;

    mainRotateLoopRef.current = Animated.loop(
      Animated.timing(mainRotateAnim, {
        toValue: 1, duration,
        easing: (t) => t,
        useNativeDriver: true,
      })
    );
    mainRotateLoopRef.current.start();

    return () => { mainRotateLoopRef.current?.stop(); };
  }, [assistantActive, assistantStatus, mainRotateAnim]);

  const mainRotate = mainRotateAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    if (!assistantActive && handsFreeMode) {
      setHandsFreeMode(false);
      stopListening();
    }
  }, [assistantActive, handsFreeMode, stopListening]);

  useEffect(() => {
    if (handsFreeTimerRef.current) {
      clearTimeout(handsFreeTimerRef.current);
      handsFreeTimerRef.current = null;
    }
    if (!handsFreeMode || !assistantActive || !sttSupported || isListening) return;
    if (assistantStatus === 'thinking' || assistantContextSpeaking) return;
    if (sttStatus === 'error' || sttStatus === 'unsupported') return;

    const delay = sttStatus === 'done' ? 1200 : 700;
    handsFreeTimerRef.current = setTimeout(() => { startListening(); }, delay);

    return () => {
      if (handsFreeTimerRef.current) clearTimeout(handsFreeTimerRef.current);
    };
  }, [
    handsFreeMode, assistantActive, sttSupported,
    isListening, sttStatus, assistantStatus,
    assistantContextSpeaking, startListening,
  ]);

  useEffect(() => {
    return () => {
      if (handsFreeTimerRef.current) clearTimeout(handsFreeTimerRef.current);
    };
  }, []);


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

  // ── Confirmación genérica ───────────────────────────────
  const confirmAction = (
    title: string, message: string, onConfirm: () => void
  ) => {
    if (Platform.OS === 'web') {
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok) onConfirm();
      return;
    }
    Alert.alert(title, message, [
      { text: i18n.t('common.cancel'),  style: 'cancel' },
      { text: i18n.t('common.confirm'), style: 'destructive', onPress: onConfirm },
    ]);
  };

  // ── SOS ─────────────────────────────────────────────────
  const handleSOS = () => {
    if (isEmergency) {
      confirmAction(
        i18n.t('home.sos.deactivateTitle'),
        i18n.t('home.sos.deactivateMsg'),
        handleDeactivateSOS
      );
    } else {
      confirmAction(
        i18n.t('home.sos.activateTitle'),
        i18n.t('home.sos.activateMsg'),
        handleActivateSOS
      );
    }
  };

  const handleActivateSOS = async () => {
    if (!user?.id) return;

    const sosCheck = checkSOSSecurity(user.id);
    if (!sosCheck.allowed) {
      const msg = sosCheck.message || i18n.t('home.sos.cannotActivate');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('SOS', msg);
      return;
    }

    if (isSOSSuspicious(user.id)) {
      console.warn('[SOS Security] 🚨 Usuario sospechoso:', user.id);
    }

    setSOSLoading(true);
    try {
      try { Vibration.vibrate([0, 200, 100, 200, 100, 400]); }
      catch { console.warn('[SOS] Vibración no disponible'); }

      const result = await activateSOS(
        user.id,
        gpsLocation?.latitude,
        gpsLocation?.longitude
      );

      if (result.success) {
        registerSOSActivation(user.id);
        setIsEmergency(true);
        const msg = `${i18n.t('home.sos.activatedTitle')}\n\n${i18n.t('home.sos.activatedMsg')}`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert(i18n.t('home.sos.activatedTitle'), i18n.t('home.sos.activatedMsg'));
      } else {
        const msg = result.error || i18n.t('home.sos.errorActivate');
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert(i18n.t('common.error'), msg);
      }
    } catch {
      const msg = i18n.t('home.sos.unexpectedError');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(i18n.t('common.error'), msg);
    } finally {
      setSOSLoading(false);
    }
  };

  const handleDeactivateSOS = async () => {
    if (!user?.id) return;
    setSOSLoading(true);
    try {
      const result = await deactivateSOS(user.id);
      if (result.success) {
        registerSOSDeactivation(user.id);
        setIsEmergency(false);
        const msg = `${i18n.t('home.sos.deactivatedTitle')}\n\n${i18n.t('home.sos.deactivatedMsg')}`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert(i18n.t('home.sos.deactivatedTitle'), i18n.t('home.sos.deactivatedMsg'));
      } else {
        const msg = result.error || i18n.t('home.sos.errorDeactivate');
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert(i18n.t('common.error'), msg);
      }
    } catch {
      const msg = i18n.t('home.sos.unexpectedError');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(i18n.t('common.error'), msg);
    } finally {
      setSOSLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, isEmergency && styles.containerEmergency]}>

      {/* Panel admin */}
      {profile?.role === 'admin' && emergencyUsers.length > 0 && (
        <View style={styles.adminPanel}>
          <Text style={styles.adminPanelTitle}>
            🔴 {emergencyUsers.length}{' '}
            {emergencyUsers.length > 1
              ? i18n.t('home.emergency.usersTitlePlural')
              : i18n.t('home.emergency.usersTitle')}
          </Text>
          {emergencyUsers.map((u) => (
            <View key={u.id} style={styles.adminPanelUser}>
              <Text style={styles.adminPanelUserName}>⚠️ {u.full_name}</Text>
              <Text style={styles.adminPanelUserEmail}>{u.email}</Text>
              {u.latitude && u.longitude && (
                <Text style={styles.adminPanelUserLocation}>
                  📍 {u.latitude.toFixed(4)}, {u.longitude.toFixed(4)}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Banner emergencia */}
      {isEmergency && (
        <View style={styles.emergencyBanner}>
          <ShieldAlert size={18} color="#fff" />
          <Text style={styles.emergencyBannerText}>
            {i18n.t('home.emergency.banner')}
          </Text>
        </View>
      )}

      {/* Escalón 2: Banner de Alerta Temprana en el Inicio (Sin pánico) */}
      {!assistantActive && activeAlertsCount > 0 && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push('/weather')}
          style={styles.tacticalBannerHome}
        >
          <View style={styles.tacticalBannerInner}>
            <AlertTriangle size={20} color="#ff9100" />
            <Text style={styles.tacticalBannerText}>
              Se detectaron {activeAlertsCount} {activeAlertsCount === 1 ? 'amenaza' : 'amenazas'} dentro de tu radio de protección. Abrí el mapa para ver los detalles.
            </Text>
          </View>
          <ChevronRight size={18} color="#00e5cc" />
        </TouchableOpacity>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.sosBtn, isEmergency && styles.sosBtnActive]}
          onPress={handleSOS}
          disabled={sosLoading}
          activeOpacity={0.7}
        >
          {sosLoading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : isEmergency ? (
            <ShieldAlert size={24} color="#fff" />
          ) : (
            <Bell size={20} color={Colors.white} fill={Colors.redBell} strokeWidth={0} />
          )}
          <View style={[styles.sosBadge, isEmergency && styles.sosBadgeActive]}>
            <Text style={styles.sosText}>
              {isEmergency ? i18n.t('home.sos.active') : i18n.t('home.sos.label')}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.topRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleEmergencyCall}>
  <Phone size={22} color={Colors.white} />
</TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/chat')}>
            <Animated.View style={{ opacity: chatPulse }}>
              <MessageCircle size={22} color={unreadCount > 0 ? '#ff9100' : Colors.white} />
            </Animated.View>
            {unreadCount > 0 && (
              <Animated.View style={[styles.chatBadge, { opacity: chatPulse }]}>
                <Text style={styles.chatBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </Animated.View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/search')}>
            <Search size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Área central */}
            <View style={styles.centerArea}>
        <ScrollView
          ref={assistantScrollRef}
          contentContainerStyle={styles.centerScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Botón asistente */}
          <View style={styles.mainBtnWrapper}>
            <Animated.View
              pointerEvents="none"
              style={{ position: 'absolute', width: 210, height: 210, transform: [{ rotate: mainRotate }] }}
            >
              <MainOrbitalDots status={assistantActive ? assistantStatus : 'idle'} />
            </Animated.View>

            <TouchableOpacity
              style={[
                styles.asistenteBtnOuter,
                assistantActive && styles.asistenteBtnOuterActive,
                assistantStatus === 'thinking' && styles.asistenteBtnThinking,
                assistantStatus === 'speaking' && styles.asistenteBtnSpeaking,
              ]}
              activeOpacity={0.85}
              onPress={() => { if (!assistantActive) activateAssistant(); }}
            >
              <View style={[styles.asistenteBtnInner, assistantActive && styles.asistenteBtnInnerActive]}>
                {assistantStatus === 'thinking' ? (
                  <ActivityIndicator color="#00d4ff" size="small" />
                ) : (
                  <Text style={[styles.asistenteText, assistantActive && styles.asistenteTextActive]}>
                    {assistantActive ? '🛡️' : i18n.t('home.assistant.label')}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Burbuja respuesta */}
          {assistantActive && lastResponse && (
            <View style={styles.assistantBubble}>
              <Text style={styles.assistantBubbleText}>{lastResponse}</Text>
            </View>
          )}

          {/* Tag manuales */}
          {assistantActive && suggestedManuals.length > 0 && (
            <View style={styles.manualsSourceTag}>
              <Text style={styles.manualsSourceText}>
                {suggestedManuals.length === 1
                  ? i18n.t('home.assistant.basedOn',       { n: suggestedManuals.length })
                  : i18n.t('home.assistant.basedOnPlural', { n: suggestedManuals.length })}
              </Text>
            </View>
          )}

          {/* Panel manuales */}
          {assistantActive && suggestedManuals.length > 0 && (
            <View style={styles.manualsPanel}>
              <Text style={styles.manualsPanelTitle}>{i18n.t('home.assistant.manualsTitle')}</Text>
              {suggestedManuals.map((manual, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.manualItem}
                  onPress={() => openManual(manual.filePath)}
                  activeOpacity={0.75}
                >
                  <View style={styles.manualItemLeft}>
                    <Text style={styles.manualItemTitle}>{manual.title}</Text>
                    {manual.description && (
                      <Text style={styles.manualItemDesc} numberOfLines={2}>{manual.description}</Text>
                    )}
                  </View>
                  <Text style={styles.manualItemArrow}>↗</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Banner SOS recomendado */}
          {sosRecommended && (
            <TouchableOpacity style={styles.sosRecommendBanner} onPress={handleSOS}>
              <Text style={styles.sosRecommendText}>{i18n.t('home.assistant.sosBanner')}</Text>
            </TouchableOpacity>
          )}

          {/* Input asistente */}
          {assistantActive && (
            <View style={styles.assistantInputWrapper}>
              {sttError && (
                <View style={styles.sttErrorBanner}>
                  <Text style={styles.sttErrorText}>⚠️ {sttError}</Text>
                </View>
              )}
              {isListening && !handsFreeMode && (
                <View style={styles.sttListeningBanner}>
                  <Text style={styles.sttListeningText}>{i18n.t('home.assistant.listening')}</Text>
                </View>
              )}
              {handsFreeMode && (
                <View style={styles.handsFreeBanner}>
                  <Text style={styles.handsFreeBannerText}>{i18n.t('home.assistant.handsFree')}</Text>
                </View>
              )}

              <View style={styles.assistantInputRow}>
                <TextInput
                  style={styles.assistantInput}
                  value={assistantInput}
                  
                  onChangeText={setAssistantInput}
                   onFocus={() => {
    setTimeout(() => {
      assistantScrollRef.current?.scrollToEnd({ animated: true });
    }, 250);
  }}
                  placeholder={
                    handsFreeMode
                      ? i18n.t('home.assistant.placeholderHandsFree')
                      : isListening
                        ? i18n.t('home.assistant.placeholderListening')
                        : i18n.t('home.assistant.placeholder')
                  }
                  placeholderTextColor={
                    handsFreeMode ? '#ff8a80' : isListening ? '#00d4ff' : '#666'
                  }
                  editable={!isListening && !handsFreeMode}
                  onSubmitEditing={() => {
                    if (assistantInput.trim()) {
                      sendToAssistant(assistantInput.trim());
                      setAssistantInput('');
                    }
                  }}
                  returnKeyType="send"
                />

                               {/* Micrófono y Manos libres — deshabilitados en V1 Android */}
                {Platform.OS === 'web' && (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.micBtn,
                        isListening && !handsFreeMode && styles.micBtnActive,
                        handsFreeMode && styles.micBtnDisabled,
                      ]}
                      disabled={handsFreeMode}
                      onPress={() => {
                        if (handsFreeMode) return;
                        if (isListening) stopListening();
                        else startListening();
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.micBtnIcon}>
                        {isListening && !handsFreeMode ? '⏹' : '🎙️'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.handsFreeBtn, handsFreeMode && styles.handsFreeBtnActive]}
                      onPress={toggleHandsFreeMode}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.handsFreeBtnIcon}>👐</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Enviar */}
                <TouchableOpacity
                  style={[
                    styles.assistantSendBtn,
                    (isListening || handsFreeMode) && styles.assistantSendBtnDisabled,
                  ]}
                  disabled={isListening || handsFreeMode}
                  onPress={() => {
                    if (assistantInput.trim()) {
                      sendToAssistant(assistantInput.trim());
                      setAssistantInput('');
                    }
                  }}
                >
                  <Text style={styles.assistantSendText}>➤</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Info usuario */}
          {profile && !assistantActive && (
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {isEmergency ? '🔴' : '🟢'} {profile.full_name}
              </Text>
              <Text style={styles.userRole}>
                {profile.role === 'admin'
                  ? i18n.t('home.user.admin')
                  : profile.role === 'pro'
                    ? i18n.t('home.user.pro')
                    : i18n.t('home.user.free')}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Nav inferior */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/weather')}>
  <Animated.View style={[
    styles.navBtnInner,
    hasActiveAlerts && styles.navBtnAlert,
    hasActiveAlerts && { opacity: climaPulse },
  ]}>
    <CloudRain size={24} color={hasActiveAlerts ? '#ff9100' : Colors.bg} />
  </Animated.View>
</TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/notifications')}>
          <AlertTriangle size={24} color={Colors.bg} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/history')}>
          <Info size={24} color={Colors.bg} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/settings')}>
          <Settings size={24} color={Colors.bg} />
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ── Estilos ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.bg },
  containerEmergency: { backgroundColor: '#1a0000' },
  emergencyBanner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: Colors.red,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  emergencyBannerText: { color: Colors.white, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  topBar: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  paddingHorizontal: 20,
  paddingTop: 8,
  backgroundColor: 'transparent',
  zIndex: 10,
},
  sosBtn: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center', position: 'relative', borderRadius: 26 },
  sosBtnActive: { backgroundColor: Colors.red, shadowColor: Colors.red, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8 },
  sosBadge: { position: 'absolute', bottom: -6, left: 0, right: 0, alignItems: 'center' },
  sosBadgeActive: { backgroundColor: Colors.red, paddingHorizontal: 6 },
  sosText: { color: Colors.white, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, backgroundColor: Colors.red, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  topRight: { alignItems: 'center', gap: 4 },
  iconBtn:  { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  centerArea:   { flex: 1, minHeight: 0 },
 centerScroll: {
  alignItems: 'center',
  paddingVertical: 10,
  flexGrow: 1,
  justifyContent: 'center',
  paddingBottom: 40,
},
  mainBtnWrapper: { width: 210, height: 210, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  asistenteBtnOuter: { width: 180, height: 180, borderRadius: 90, backgroundColor: Colors.assistantBg, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  asistenteBtnInner: { width: 148, height: 148, borderRadius: 74, backgroundColor: '#c8cad4', borderWidth: 3, borderColor: Colors.assistantLines, justifyContent: 'center', alignItems: 'center' },
  asistenteText:     { color: '#3a3a4a', fontSize: 16, fontWeight: '500', letterSpacing: 1.5 },
  asistenteBtnOuterActive: { backgroundColor: Colors.bg, borderWidth: 2, borderColor: 'rgba(92,225,230,0.6)', shadowColor: Colors.teal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  asistenteBtnThinking: { borderColor: 'rgba(92,225,230,0.9)', shadowOpacity: 0.8, shadowRadius: 30 },
  asistenteBtnSpeaking: { borderColor: 'rgba(0,255,180,0.7)', shadowColor: '#00ffb4', shadowOpacity: 0.6, shadowRadius: 25 },
  asistenteBtnInnerActive: { backgroundColor: Colors.bg, borderColor: 'rgba(92,225,230,0.4)' },
  asistenteTextActive:     { color: Colors.teal, fontSize: 28 },
  userInfo:  { marginTop: 20, alignItems: 'center', gap: 4 },
  userName:  { color: Colors.whiteAlpha70, fontSize: 14 },
  userRole:  { color: Colors.greyDark, fontSize: 12 },
  bottomNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingBottom: 24, paddingTop: 16 },
  navBtn:    { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.navBg, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  adminPanel: { backgroundColor: 'rgba(255,49,49,0.75)', margin: 16, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: Colors.red },
  adminPanelTitle:        { color: Colors.white, fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  adminPanelUser:         { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 10, gap: 2 },
  adminPanelUserName:     { color: Colors.white, fontSize: 14, fontWeight: '700' },
  adminPanelUserEmail:    { color: Colors.whiteAlpha70, fontSize: 12 },
  adminPanelUserLocation: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  assistantBubble:     { marginTop: 16, backgroundColor: 'rgba(92,225,230,0.08)', borderWidth: 1, borderColor: 'rgba(92,225,230,0.25)', borderRadius: 16, padding: 14, marginHorizontal: 30, maxWidth: 320 },
  assistantBubbleText: { color: Colors.whiteAlpha70, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  sosRecommendBanner:  { marginTop: 12, backgroundColor: 'rgba(255,49,49,0.15)', borderWidth: 1, borderColor: Colors.red, borderRadius: 12, padding: 12, marginHorizontal: 30 },
  sosRecommendText:    { color: Colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center' },
assistantInputWrapper: {
  alignSelf: 'stretch',
  marginTop: 20,
  marginHorizontal: 0,
  paddingHorizontal: 20,
  gap: 6,
  paddingBottom: Platform.OS === 'android' ? 20 : 8,
},
 assistantInputRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 6,
  gap: 8,
  width: '100%',
},
  assistantInput: {
  flex: 1,
  backgroundColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  borderColor: 'rgba(92,225,230,0.35)',
  borderRadius: 20,
  paddingHorizontal: 16,
  paddingTop: Platform.OS === 'android' ? 14 : 12,
  paddingBottom: 12,
  color: '#ffffff',
  fontSize: 15,
  lineHeight: 20,
  minHeight: 50,
  maxHeight: 120,
  textAlignVertical: 'top',
  minWidth: 0,
},
  assistantSendBtn: {
  width: 52,
  height: 52,
  borderRadius: 26,
  backgroundColor: 'rgba(92,225,230,0.15)',
  borderWidth: 1,
  borderColor: 'rgba(92,225,230,0.35)',
  justifyContent: 'center',
  alignItems: 'center',
},
  assistantSendText:        { color: Colors.teal, fontSize: 18 },
  assistantSendBtnDisabled: { opacity: 0.4 },
  manualsPanel:      { marginTop: 10, marginHorizontal: 20, backgroundColor: 'rgba(92,225,230,0.06)', borderWidth: 1, borderColor: 'rgba(92,225,230,0.2)', borderRadius: 14, padding: 12, gap: 8 },
  manualsPanelTitle: { color: Colors.teal, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  manualItem:        { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(92,225,230,0.12)' },
  manualItemLeft:    { flex: 1, gap: 2 },
  manualItemTitle:   { color: Colors.white, fontSize: 13, fontWeight: '600' },
  manualItemDesc:    { color: Colors.whiteAlpha30, fontSize: 11, lineHeight: 15 },
  manualItemArrow:   { color: Colors.teal, fontSize: 18, marginLeft: 8 },
  manualsSourceTag:  { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(92,225,230,0.06)', borderRadius: 20 },
  manualsSourceText: { color: 'rgba(92,225,230,0.6)', fontSize: 11, fontWeight: '600' },
  sttErrorBanner:     { backgroundColor: 'rgba(255,49,49,0.12)', borderWidth: 1, borderColor: 'rgba(255,49,49,0.35)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  sttErrorText:       { color: Colors.red, fontSize: 12, textAlign: 'center' },
  sttListeningBanner: { backgroundColor: 'rgba(92,225,230,0.1)', borderWidth: 1, borderColor: 'rgba(92,225,230,0.35)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  sttListeningText:   { color: Colors.teal, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  micBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.whiteAlpha30, justifyContent: 'center', alignItems: 'center' },
  micBtnActive:   { backgroundColor: 'rgba(92,225,230,0.15)', borderColor: Colors.teal, shadowColor: Colors.teal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  micBtnIcon:     { fontSize: 20 },
  micBtnDisabled: { opacity: 0.35 },
  handsFreeBanner:     { backgroundColor: 'rgba(255,49,49,0.1)', borderWidth: 1, borderColor: 'rgba(255,49,49,0.35)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  handsFreeBannerText: { color: Colors.red, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  handsFreeBtn:        { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,49,49,0.35)', justifyContent: 'center', alignItems: 'center' },
  handsFreeBtnActive:  { backgroundColor: 'rgba(255,49,49,0.15)', borderColor: Colors.red, shadowColor: Colors.red, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.65, shadowRadius: 10, elevation: 8 },
  handsFreeBtnIcon:    { fontSize: 20 },
  chatBadge:     { position: 'absolute', top: -4, right: -4, backgroundColor: '#ff9100', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: Colors.bg },
  chatBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  navBtnInner: {
  width: 64,
  height: 64,
  borderRadius: 32,
  justifyContent: 'center',
  alignItems: 'center',
},
navBtnAlert: {
  borderWidth: 2,
  borderColor: '#ff9100',
  backgroundColor: 'rgba(255,145,0,0.15)',
},
  tacticalBannerHome: {
    backgroundColor: 'rgba(255,145,0,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,145,0,0.4)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tacticalBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  tacticalBannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
});
