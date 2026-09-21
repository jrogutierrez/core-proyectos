import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity,
  Switch, StyleSheet, Alert, ActivityIndicator, Platform, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Phone, Star, Check,
  ChevronDown, Globe, User, LogOut,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { LegalDisclaimerModal } from '@/components/LegalDisclaimerModal';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearVoiceCache } from '@/services/voice';
import { WebView } from 'react-native-webview';
import { Modal } from 'react-native';

type ToggleKey = 'notifications' | 'location';

const SETTINGS_STORAGE_KEY = '@defensor_jrg_settings';

const DEFAULT_TOGGLES: Record<ToggleKey, boolean> = {
  notifications: true,
  location: true,
};

// Badge de rol
function RoleBadge({ role }: { role: string }) {
  const config = {
    admin: { label: '⚡ Admin', bg: 'rgba(231,76,60,0.2)', border: 'rgba(231,76,60,0.5)', color: '#e74c3c' },
    pro:   { label: '⭐ Pro',   bg: 'rgba(247,183,49,0.2)', border: 'rgba(247,183,49,0.5)', color: '#f7b731' },
    free:  { label: '🟢 Free', bg: 'rgba(0,184,148,0.2)',  border: 'rgba(0,184,148,0.5)',  color: '#00b894' },
  };
  const c = config[role as keyof typeof config] ?? config.free;
  return (
    <View style={[styles.roleBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.roleBadgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

// Mapa idioma ↔ label
const LANG_TO_LABEL: Record<string, string> = {
  es: 'Español', en: 'English', pt: 'Português', ja: '日本語', zh: '中文',
};
const LABEL_TO_LANG: Record<string, string> = {
  'Español': 'es', 'English': 'en', 'Português': 'pt', '日本語': 'ja', '中文': 'zh',
};

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, signOut, loading: authLoading, updateProfile } = useAuth();
  const { t, i18n } = useTranslation();

  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(DEFAULT_TOGGLES);
  const [togglesLoaded, setTogglesLoaded] = useState(false);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // ── Cargar preferencias guardadas ─────────────────
  useEffect(() => {
    const loadSavedToggles = async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setToggles({
            ...DEFAULT_TOGGLES,
            ...parsed,
          });
        }
      } catch (e) {
        console.warn('[settings] No se pudieron cargar los toggles:', e);
      } finally {
        setTogglesLoaded(true);
      }
    };

    loadSavedToggles();
  }, []);

  // ── Guardar preferencias ──────────────────────────
  useEffect(() => {
    if (!togglesLoaded) return;

    AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toggles)).catch((e) => {
      console.warn('[settings] No se pudieron guardar los toggles:', e);
    });
  }, [toggles, togglesLoaded]);

  // ── Logout ────────────────────────────────────────
  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('settings.logout.message'));
      if (!confirmed) return;
      try {
        await signOut();
        router.replace('/auth');
      } catch {
        window.alert(t('settings.logout.error'));
      }
      return;
    }

    Alert.alert(
      t('settings.logout.title'),
      t('settings.logout.message'),
      [
        { text: t('settings.logout.cancel'), style: 'cancel' },
        {
          text: t('settings.logout.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/auth');
            } catch {
              Alert.alert('Error', t('settings.logout.error'));
            }
          },
        },
      ]
    );
  };

      // ── Upgrade Pro (Abre la web directamente en la sección de planes) ──
  const handleUpgrade = async () => {
    const pricingUrl = 'https://defensorjrg.com/#pricing';

    if (Platform.OS === 'web') {
      window.open(pricingUrl, '_blank');
      return;
    }

    try {
      await Linking.openURL(pricingUrl);
    } catch {
      Alert.alert('Planes Pro', 'Ingresá a defensorjrg.com/#pricing desde tu navegador para ver las opciones de protección.');
    }
  };
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

  // ── Fecha localizada ──────────────────────────────
  const today = new Date();
  const days   = t('settings.date.days',   { returnObjects: true }) as string[];
  const months = t('settings.date.months', { returnObjects: true }) as string[];
  const dateStr = `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]}`;

  // ── Dropdowns ─────────────────────────────────────
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({
    units: 'Celsius (°C)',
    lang: LANG_TO_LABEL[i18n.language] || 'Español',
    theme: t('settings.dropdowns.themeOptions.dark'),
  });

  // Sincronizar label de idioma si cambia externamente
  useEffect(() => {
    setSelectedOptions((prev) => ({
      ...prev,
      lang: LANG_TO_LABEL[i18n.language] || 'Español',
    }));
  }, [i18n.language]);

  const [showLegalInfo, setShowLegalInfo] = useState(false);

  function toggleSwitch(id: ToggleKey) {
    const nextValue = !toggles[id];

    setToggles((prev) => ({
      ...prev,
      [id]: nextValue,
    }));

    if (id === 'notifications' && !nextValue) {
      showMessage(
        'Notificaciones desactivadas',
        'Podrías no recibir avisos críticos a tiempo. Te recomendamos mantener esta opción activada.'
      );
    }

    if (id === 'location' && !nextValue) {
      showMessage(
        'Ubicación automática desactivada',
        'La app dejará de usar tu ubicación automáticamente para funciones como clima, mapa y alertas por proximidad.'
      );
    }
  }

  async function selectOption(dropId: string, option: string) {
    setSelectedOptions((prev) => ({ ...prev, [dropId]: option }));

    if (dropId === 'lang') {
      const newLang = LABEL_TO_LANG[option];
      if (newLang) {
        i18n.changeLanguage(newLang);
        clearVoiceCache();

        try {
          await AsyncStorage.setItem('user_language', newLang);
        } catch (e) {
          console.warn('[i18n] No se pudo guardar idioma en storage:', e);
        }

        try {
          const result = await updateProfile({ language_preference: newLang });
          if (!result.success) console.warn('[i18n] No se pudo guardar en Supabase:', result.error);
        } catch (e) {
          console.warn('[i18n] Error guardando en Supabase:', e);
        }
      }
    }

    setOpenDropdown(null);
  }

  // ── Arrays traducidos ─────────────────────────────
  const PRO_FEATURES = [
    t('settings.pro.features.realtime'),
    t('settings.pro.features.history'),
    t('settings.pro.features.forecast'),
    t('settings.pro.features.maps'),
  ];

  const TOGGLES = [
    { id: 'notifications' as ToggleKey, label: t('settings.toggles.notifications') },
    { id: 'location' as ToggleKey,      label: t('settings.toggles.location') },
  ];

  const DROPDOWNS = [
    {
      id: 'units',
      label: t('settings.dropdowns.units'),
      options: ['Celsius (°C)', 'Fahrenheit (°F)', 'Kelvin (K)'],
    },
    {
      id: 'lang',
      label: t('settings.dropdowns.lang'),
      options: ['Español', 'English', 'Português', '日本語', '中文'],
    },
    {
      id: 'theme',
      label: t('settings.dropdowns.theme'),
      options: [
        t('settings.dropdowns.themeOptions.dark'),
        t('settings.dropdowns.themeOptions.light'),
        t('settings.dropdowns.themeOptions.auto'),
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
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

        <Text style={styles.headerTitle}>{t('settings.title')}</Text>

        <TouchableOpacity style={styles.iconBtn} onPress={handleEmergencyCall}>
          <Phone size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <Text style={styles.dateText}>{dateStr}</Text>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── TARJETA DE PERFIL ── */}
        {profile && (
          <View style={styles.profileCard}>
            <View style={styles.profileAvatarCircle}>
              <User size={28} color={Colors.teal} />
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName}>{profile.full_name}</Text>
                <RoleBadge role={profile.role} />
              </View>
              <Text style={styles.profileEmail}>{profile.email}</Text>
              {profile.city ? (
                <Text style={styles.profileLocation}>
                  📍 {profile.city}{profile.country ? `, ${profile.country}` : ''}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* ── PRO CARD ── */}
        {profile?.role !== 'admin' && (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={handleUpgrade}
            style={styles.proCardTouchable}
          >
            <LinearGradient
              colors={['#f7b731', '#5ce1e6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proCard}
            >
              <View style={styles.proContent}>
                <View style={styles.proLeft}>
                  <View style={styles.proTitleRow}>
                    <Star size={22} color="#fff" fill="#fff" />
                    <Text style={styles.proTitle}>
                      {profile?.role === 'pro'
                        ? t('settings.pro.alreadyPro')
                        : t('settings.pro.upgrade')}
                    </Text>
                  </View>

                  {PRO_FEATURES.map((feat, i) => (
                    <View key={i} style={styles.proFeatureRow}>
                      <View style={styles.checkCircle}>
                        <Check size={11} color="#fff" strokeWidth={3} />
                      </View>
                      <Text style={styles.proFeatureText}>{feat}</Text>
                    </View>
                  ))}

                  <Text style={styles.proSoonText}>Próximamente</Text>
                </View>

                <View style={styles.proRight}>
                  <Globe size={64} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── TOGGLES ── */}
        <View style={styles.section}>
          {TOGGLES.map((item, idx) => (
            <View
              key={item.id}
              style={[styles.toggleRow, idx < TOGGLES.length - 1 && styles.toggleBorder]}
            >
              <Text style={styles.toggleLabel}>{item.label}</Text>
              <Switch
                value={toggles[item.id]}
                onValueChange={() => toggleSwitch(item.id)}
                trackColor={{ false: Colors.bgCardLight, true: Colors.teal }}
                thumbColor={Colors.white}
              />
            </View>
          ))}
        </View>

        {/* ── DROPDOWNS ── */}
        <View style={styles.section}>
          {DROPDOWNS.map((item, index) => {
            const isLast = index === DROPDOWNS.length - 1;

            return (
              <View key={item.id}>
                <TouchableOpacity
                  style={[
                    styles.dropdownRow,
                    isLast && openDropdown !== item.id && styles.dropdownRowLast,
                  ]}
                  onPress={() => setOpenDropdown(openDropdown === item.id ? null : item.id)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.dropdownLabel}>{item.label}</Text>
                  <View style={styles.dropdownRight}>
                    <Text style={styles.dropdownValue}>{selectedOptions[item.id]}</Text>
                    <ChevronDown
                      size={16}
                      color={Colors.whiteAlpha70}
                      style={{ transform: [{ rotate: openDropdown === item.id ? '180deg' : '0deg' }] }}
                    />
                  </View>
                </TouchableOpacity>

                {openDropdown === item.id && (
                  <View style={[styles.optionsList, isLast && styles.optionsListLast]}>
                    {item.options.map((opt, optIndex) => {
                      const isLastOption = optIndex === item.options.length - 1;

                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            styles.optionItem,
                            isLastOption && styles.optionItemLast,
                          ]}
                          onPress={() => selectOption(item.id, opt)}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              selectedOptions[item.id] === opt && styles.optionTextSelected,
                            ]}
                          >
                            {opt}
                          </Text>
                          {selectedOptions[item.id] === opt && (
                            <Check size={14} color={Colors.teal} strokeWidth={2.5} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── LEGAL ── */}
        <TouchableOpacity style={styles.settingsItem} onPress={() => setShowLegalInfo(true)}>
          <Text style={styles.settingsItemIcon}>⚖️</Text>
          <View style={styles.settingsItemContent}>
            <Text style={styles.settingsItemTitle}>{t('common.legalSettingsTitle')}</Text>
            <Text style={styles.settingsItemDesc}>{t('common.legalSettingsDesc')}</Text>
          </View>
        </TouchableOpacity>

        {/* ── ADMIN BUTTON ── */}
        {profile?.role === 'admin' && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push('/admin/dashboard')}
          >
            <Text style={styles.adminBtnText}>{t('settings.admin.button')}</Text>
            <Text style={styles.adminBtnSub}>{t('settings.admin.subtitle')}</Text>
          </TouchableOpacity>
        )}

              {/* ── LOGOUT ── */}
        <TouchableOpacity
          style={[styles.logoutBtn, authLoading && styles.logoutBtnDisabled]}
          onPress={handleLogout}
          disabled={authLoading}
        >
          {authLoading ? (
            <ActivityIndicator color="#e74c3c" size="small" />
          ) : (
            <View style={styles.logoutInner}>
              <LogOut size={18} color="#e74c3c" />
              <Text style={styles.logoutText}>{t('settings.logout.button')}</Text>
            </View>
          )}
        </TouchableOpacity>

      </ScrollView>

      {/* Modal de Disclaimer Legal */}
      <LegalDisclaimerModal
        visible={showLegalInfo}
        onAccept={() => setShowLegalInfo(false)}
        dismissOnBackdrop={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dateText: {
    color: Colors.whiteAlpha70,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },

  content: {
    padding: 16,
    gap: 16,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },

  profileAvatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(92,225,230,0.12)',
    borderWidth: 2,
    borderColor: Colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileInfo: { flex: 1, gap: 4 },

  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  profileName: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },

  profileEmail: {
    color: Colors.whiteAlpha70,
    fontSize: 13,
  },

  profileLocation: {
    color: Colors.whiteAlpha70,
    fontSize: 13,
  },

  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },

  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  proCardTouchable: {
    borderRadius: 18,
  },

  proCard: {
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
  },

  proContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  proLeft: {
    flex: 1,
    gap: 8,
  },

  proTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },

  proTitle: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '700',
  },

  proFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  proFeatureText: {
    color: Colors.white,
    fontSize: 13,
  },

  proSoonText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    letterSpacing: 0.4,
  },

  proRight: {
    marginLeft: 12,
  },

  section: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  toggleBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },

  toggleLabel: {
    color: Colors.white,
    fontSize: 15,
  },

  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },

  dropdownRowLast: {
    borderBottomWidth: 0,
  },

  dropdownLabel: {
    color: Colors.white,
    fontSize: 15,
  },

  dropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  dropdownValue: {
    color: Colors.whiteAlpha70,
    fontSize: 14,
  },

  optionsList: {
    backgroundColor: Colors.selectorBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },

  optionsListLast: {
    borderBottomWidth: 0,
  },

  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },

  optionItemLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },

  optionText: {
    color: Colors.whiteAlpha70,
    fontSize: 14,
  },

  optionTextSelected: {
    color: Colors.teal,
    fontWeight: '600',
  },

  logoutBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,49,49,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,49,49,0.25)',
  },

  logoutBtnDisabled: {
    opacity: 0.5,
  },

  logoutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  logoutText: {
    color: Colors.red,
    fontSize: 15,
    fontWeight: '600',
  },

  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },

  settingsItemIcon: {
    fontSize: 24,
  },

  settingsItemContent: {
    flex: 1,
    gap: 2,
  },

  settingsItemTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },

  settingsItemDesc: {
    color: Colors.whiteAlpha70,
    fontSize: 12,
  },

  adminBtn: {
    backgroundColor: 'rgba(255,49,49,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,49,49,0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },

  adminBtnText: {
    color: Colors.red,
    fontSize: 16,
    fontWeight: 'bold',
  },

  adminBtnSub: {
    color: Colors.grey,
    fontSize: 12,
    marginTop: 4,
  },
});