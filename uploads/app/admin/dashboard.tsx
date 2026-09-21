// app/admin/dashboard.tsx
import { useEffect, useState,  useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput,
  RefreshControl, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Users, AlertTriangle, MessageCircle,
  Globe, Search, Shield,
} from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { alertNearbyUsers } from '@/services/push-alerts';
import i18n from '@/i18n';
import { getLocalizedDateFull } from '@/utils/dateLocale';
import { getTimeAgoShort } from '@/utils/timeAgo';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

// ── Tipos ──────────────────────────────────────────────────────
interface AdminStats {
  totalUsers:        number;
  activeEmergencies: number;
  totalMessages:     number;
  usersByCountry:    { country: string; count: number }[];
}

interface UserRow {
  id:                  string;
  full_name:           string;
  email:               string;
  city:                string;
  province:            string;
  country:             string;
  role:                string;
  is_in_emergency:     boolean;
  created_at:          string;
  language_preference: string;
}

interface NewAlert {
  type:        string;
  severity:    string;
  title:       string;
  description: string;
  radius_km:   number;
  lat:         number | null;
  lng:         number | null;
}

interface AlertRow {
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
  event_start: string | null;
  event_end:   string | null;
}

const ALERT_TYPES = [
  { id: 'earthquake', label: '🔴 Sismo',        color: '#e74c3c' },
  { id: 'fire',       label: '🔥 Incendio',     color: '#e67e22' },
  { id: 'storm',      label: '⛈️ Tormenta',     color: '#8e44ad' },
  { id: 'volcano',    label: '🌋 Volcán',        color: '#c0392b' },
  { id: 'flood',      label: '🌊 Inundación',    color: '#2980b9' },
  { id: 'tsunami',    label: '🌊 Tsunami',       color: '#1a5276' },
  { id: 'custom',     label: '⚠️ Personalizada', color: '#f39c12' },
];

const SEVERITY_LEVELS = [
  { id: 'low',      label: 'INFO',    color: '#00b894' },
  { id: 'medium',   label: 'AVISO',   color: '#e67e22' },
  { id: 'high',     label: 'PELIGRO', color: '#e74c3c' },
  { id: 'critical', label: 'CRÍTICO', color: '#c0392b' },
];

// ═══════════════════════════════════════════════════════════════
// AlertCreator
// ═══════════════════════════════════════════════════════════════
function AlertCreator() {
  const { profile } = useAuth();

  const [alert, setAlert] = useState<NewAlert>({
    type: 'storm', severity: 'medium',
    title: '', description: '', radius_km: 50,
    lat: null, lng: null,
  });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [mapKey,  setMapKey]  = useState(0);

  const mapInstruction = i18n.t('adminDashboard.alertCreator.mapInstruction');
  const mapConfirmedLabel = (lat: number, lng: number) =>
    i18n.t('adminDashboard.alertCreator.mapConfirmed', {
      lat: lat.toFixed(4),
      lng: lng.toFixed(4),
    });

  const mapHTML = `
    <!DOCTYPE html><html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        html, body, #map { width:100%; height:100vh; background:#0a0a1a; }
        .leaflet-control-attribution { display:none; }
        #info {
          position:absolute; bottom:10px; left:50%; transform:translateX(-50%);
          background:rgba(0,0,0,0.8); color:#5ce1e6; padding:8px 16px;
          border-radius:20px; font-size:13px; font-family:sans-serif;
          z-index:1000; pointer-events:none; white-space:nowrap;
        }
        .leaflet-popup-content-wrapper {
          background:#1a1a2e; color:#fff;
          border:1px solid rgba(92,225,230,0.4); border-radius:10px;
        }
        .leaflet-popup-tip { background:#1a1a2e; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div id="info">${mapInstruction}</div>
      <script>
        var map = L.map('map', { center: [-20, -60], zoom: 3 });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom:18, subdomains:'abcd'
        }).addTo(map);
        var marker = null; var circle = null;
        map.on('click', function(e) {
          var lat = e.latlng.lat.toFixed(6);
          var lng = e.latlng.lng.toFixed(6);
          if (marker) { map.removeLayer(marker); }
          if (circle) { map.removeLayer(circle); }
          var icon = L.divIcon({
            html: '<div style="font-size:28px;filter:drop-shadow(0 0 8px rgba(255,50,50,0.8))">📍</div>',
            className:'', iconSize:[32,32], iconAnchor:[16,32],
          });
          marker = L.marker([lat,lng], {icon}).addTo(map);
          marker.bindPopup('<b>⚠️ ${i18n.t('adminDashboard.alertCreator.typeTitle')}</b><br/>Lat: '+lat+'<br/>Lng: '+lng).openPopup();
          circle = L.circle([lat,lng], {
            radius: ${alert.radius_km * 1000},
            color:'#ff1744', fillColor:'#ff1744', fillOpacity:0.15, weight:2, dashArray:'6 4',
          }).addTo(map);
          document.getElementById('info').textContent = '✅ '+lat+', '+lng;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({lat:parseFloat(lat),lng:parseFloat(lng)}));
          } else {
            window.parent.postMessage(JSON.stringify({lat:parseFloat(lat),lng:parseFloat(lng)}), '*');
          }
        });
      <\/script>
    </body></html>
  `;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.lat && data.lng) {
          setAlert(prev => ({ ...prev, lat: data.lat, lng: data.lng }));
        }
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCreate = async () => {
    if (!alert.lat || !alert.lng) {
      if (Platform.OS === 'web') {
        window.alert(i18n.t('adminDashboard.alertCreator.validationMap'));
      }
      return;
    }
    if (!alert.title.trim()) {
      if (Platform.OS === 'web') {
        window.alert(i18n.t('adminDashboard.alertCreator.validationTitle'));
      }
      return;
    }
    if (!alert.description.trim()) {
      if (Platform.OS === 'web') {
        window.alert(i18n.t('adminDashboard.alertCreator.validationDesc'));
      }
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('alerts').insert({
        title:       alert.title.trim(),
        description: alert.description.trim(),
        type:        alert.type,
        severity:    alert.severity,
        latitude:    alert.lat,
        longitude:   alert.lng,
        radius_km:   alert.radius_km,
        is_active:   true,
        source:      'DEFENSOR JRG Admin',
        created_by:  profile?.id ?? null,
        expires_at:  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
            if (error) throw error;

      // Enviar push a usuarios cercanos
      try {
        await alertNearbyUsers(
          alert.lat!,
          alert.lng!,
          alert.radius_km,
          alert.title.trim(),
          alert.description.trim(),
          i18n.language || 'es'
        );
        console.log('[AlertCreator] Push enviado a usuarios cercanos ✅');
      } catch (pushErr) {
        console.warn('[AlertCreator] Error enviando push:', pushErr);
      }

      setSuccess(true);
      setTimeout(() => {
        setAlert({
          type: 'storm', severity: 'medium',
          title: '', description: '', radius_km: 50,
          lat: null, lng: null,
        });
        setSuccess(false);
        setMapKey(k => k + 1);
      }, 2000);
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(`${i18n.t('common.error')}: ${err.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedType     = ALERT_TYPES.find(t => t.id === alert.type);
  const selectedSeverity = SEVERITY_LEVELS.find(s => s.id === alert.severity);

  return (
    <View style={acStyles.container}>

      {/* Mapa */}
      <View style={acStyles.mapCard}>
        <Text style={acStyles.mapLabel}>
          {alert.lat && alert.lng
            ? i18n.t('adminDashboard.alertCreator.mapMarked', {
                lat: alert.lat.toFixed(4),
                lng: alert.lng.toFixed(4),
              })
            : i18n.t('adminDashboard.alertCreator.mapLabel')}
        </Text>
        <View style={acStyles.mapBox}>
          <iframe
            key={mapKey}
            srcDoc={mapHTML}
            style={{ width:'100%', height:'100%', border:'none', borderRadius:12 }}
            title="Mapa admin"
          />
        </View>
      </View>

      {/* Tipo */}
      <View style={acStyles.card}>
        <Text style={acStyles.cardTitle}>
          {i18n.t('adminDashboard.alertCreator.typeTitle')}
        </Text>
        <View style={acStyles.chipRow}>
          {ALERT_TYPES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[
                acStyles.chip,
                alert.type === t.id && {
                  backgroundColor: t.color + '33',
                  borderColor: t.color,
                },
              ]}
              onPress={() => setAlert(prev => ({ ...prev, type: t.id }))}
            >
              <Text style={[
                acStyles.chipText,
                alert.type === t.id && { color: t.color, fontWeight: '700' },
              ]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Severidad */}
      <View style={acStyles.card}>
        <Text style={acStyles.cardTitle}>
          {i18n.t('adminDashboard.alertCreator.severityTitle')}
        </Text>
        <View style={acStyles.chipRow}>
          {SEVERITY_LEVELS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[
                acStyles.chip, acStyles.chipSeverity,
                alert.severity === s.id && {
                  backgroundColor: s.color,
                  borderColor: s.color,
                },
              ]}
              onPress={() => setAlert(prev => ({ ...prev, severity: s.id }))}
            >
              <Text style={[
                acStyles.chipText,
                alert.severity === s.id && { color: '#fff', fontWeight: '700' },
              ]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Radio */}
      <View style={acStyles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={acStyles.cardTitle}>
            {i18n.t('adminDashboard.alertCreator.radiusTitle', { n: alert.radius_km })}
          </Text>
        </View>
        <View style={acStyles.radioBtns}>
          {[10, 25, 50, 100, 200, 500].map(r => (
            <TouchableOpacity
              key={r}
              style={[
                acStyles.radioBtn,
                alert.radius_km === r && acStyles.radioBtnActive,
              ]}
              onPress={() => setAlert(prev => ({ ...prev, radius_km: r }))}
            >
              <Text style={[
                acStyles.radioBtnText,
                alert.radius_km === r && acStyles.radioBtnTextActive,
              ]}>
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={acStyles.radioHint}>
          {i18n.t('adminDashboard.alertCreator.radiusHint')}
        </Text>
      </View>

      {/* Título */}
      <View style={acStyles.card}>
        <Text style={acStyles.cardTitle}>
          {i18n.t('adminDashboard.alertCreator.titleField')}
        </Text>
        <TextInput
          style={acStyles.input}
          value={alert.title}
          onChangeText={v => setAlert(prev => ({ ...prev, title: v }))}
          placeholder={i18n.t('adminDashboard.alertCreator.titlePlaceholder')}
          placeholderTextColor="#555"
          maxLength={100}
        />
        <Text style={acStyles.charCount}>{alert.title.length}/100</Text>
      </View>

      {/* Descripción */}
      <View style={acStyles.card}>
        <Text style={acStyles.cardTitle}>
          {i18n.t('adminDashboard.alertCreator.descField')}
        </Text>
        <TextInput
          style={[acStyles.input, acStyles.inputMulti]}
          value={alert.description}
          onChangeText={v => setAlert(prev => ({ ...prev, description: v }))}
          placeholder={i18n.t('adminDashboard.alertCreator.descPlaceholder')}
          placeholderTextColor="#555"
          multiline
          numberOfLines={4}
          maxLength={500}
        />
        <Text style={acStyles.charCount}>{alert.description.length}/500</Text>
      </View>

      {/* Resumen */}
      {alert.lat && alert.lng && alert.title.trim() ? (
        <View style={acStyles.summaryCard}>
          <Text style={acStyles.summaryTitle}>
            {i18n.t('adminDashboard.alertCreator.summaryTitle')}
          </Text>
          <Text style={acStyles.summaryRow}>
            {i18n.t('adminDashboard.alertCreator.summaryType')}
            <Text style={{ color: selectedType?.color }}>
              {selectedType?.label}
            </Text>
          </Text>
          <Text style={acStyles.summaryRow}>
            {i18n.t('adminDashboard.alertCreator.summarySeverity')}
            <Text style={{ color: selectedSeverity?.color }}>
              {selectedSeverity?.label}
            </Text>
          </Text>
          <Text style={acStyles.summaryRow}>
            {i18n.t('adminDashboard.alertCreator.summaryRadius')}
            <Text style={{ color: Colors.teal }}>{alert.radius_km} km</Text>
          </Text>
          <Text style={acStyles.summaryRow}>
            {i18n.t('adminDashboard.alertCreator.summaryZone')}
            <Text style={{ color: Colors.teal }}>
              {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
            </Text>
          </Text>
          <Text style={acStyles.summaryRow}>
            {i18n.t('adminDashboard.alertCreator.summaryValid')}
            <Text style={{ color: '#aaa' }}>
              {i18n.t('adminDashboard.alertCreator.summaryValidValue')}
            </Text>
          </Text>
        </View>
      ) : null}

      {/* Botón crear */}
      <TouchableOpacity
        style={[
          acStyles.createBtn,
          (!alert.lat || !alert.title.trim() || saving) && acStyles.createBtnDisabled,
          success && acStyles.createBtnSuccess,
        ]}
        onPress={handleCreate}
        disabled={saving || success}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={acStyles.createBtnText}>
            {success
              ? i18n.t('adminDashboard.alertCreator.createSuccess')
              : i18n.t('adminDashboard.alertCreator.createBtn')}
          </Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// AlertManager
// ═══════════════════════════════════════════════════════════════
function AlertManager() {
  const [alerts,        setAlerts]        = useState<AlertRow[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editData,      setEditData]      = useState<Partial<AlertRow>>({});
  const [savingEdit,    setSavingEdit]    = useState(false);

  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const { data, error } = await supabase
        .from('alerts').select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAlerts((data ?? []) as AlertRow[]);
    } catch (err) {
      console.error('[AlertManager]', err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => { loadAlerts(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-alerts-manage')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        () => loadAlerts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDeactivate = async (a: AlertRow) => {
    if (Platform.OS === 'web' && !window.confirm(
      i18n.t('adminDashboard.alertManager.confirms.deactivate', { title: a.title })
    )) return;

    const { error } = await supabase.from('alerts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', a.id);
    if (error && Platform.OS === 'web') {
      window.alert(`${i18n.t('common.error')}: ${error.message}`);
    }
  };

  const handleReactivate = async (a: AlertRow) => {
    if (Platform.OS === 'web' && !window.confirm(
      i18n.t('adminDashboard.alertManager.confirms.reactivate', { title: a.title })
    )) return;

    const { error } = await supabase.from('alerts').update({
      is_active:   true,
      updated_at:  new Date().toISOString(),
      expires_at:  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', a.id);
    if (error && Platform.OS === 'web') {
      window.alert(`${i18n.t('common.error')}: ${error.message}`);
    }
  };

  const handleDelete = async (a: AlertRow) => {
    if (Platform.OS === 'web') {
      if (!window.confirm(
        i18n.t('adminDashboard.alertManager.confirms.delete', { title: a.title })
      )) return;
      if (!window.confirm(
        i18n.t('adminDashboard.alertManager.confirms.deleteSecond', { title: a.title })
      )) return;
    }
    const { error } = await supabase.from('alerts').delete().eq('id', a.id);
    if (error && Platform.OS === 'web') {
      window.alert(`${i18n.t('common.error')}: ${error.message}`);
    }
  };

  const startEdit = (a: AlertRow) => {
    setEditingId(a.id);
    setEditData({
      title:       a.title,
      description: a.description,
      severity:    a.severity,
      radius_km:   a.radius_km,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('alerts')
        .update({ ...editData, updated_at: new Date().toISOString() })
        .eq('id', editingId);
      if (error) throw error;
      setEditingId(null);
      setEditData({});
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(`${i18n.t('common.error')}: ${err.message}`);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const getTypeInfo     = (type: string)     => ALERT_TYPES.find(t => t.id === type)         ?? { label: '⚠️ Alerta', color: '#f39c12' };
  const getSeverityInfo = (severity: string) => SEVERITY_LEVELS.find(s => s.id === severity) ?? { label: 'INFO', color: '#00b894' };

  const typeEmoji = (type: string) => {
    const map: Record<string, string> = {
      earthquake: '🔴', fire: '🔥', storm: '⛈️',
      volcano: '🌋', flood: '🌊', tsunami: '🌊',
    };
    return map[type] ?? '⚠️';
  };

  if (loadingAlerts) {
    return (
      <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
        <ActivityIndicator color={Colors.teal} size="large" />
        <Text style={{ color: '#aaa', fontSize: 14 }}>
          {i18n.t('adminDashboard.alertManager.loading')}
        </Text>
      </View>
    );
  }

  const activeAlerts   = alerts.filter(a => a.is_active);
  const inactiveAlerts = alerts.filter(a => !a.is_active);

  const renderCard = (a: AlertRow, isActive: boolean) => {
    const typeInfo  = getTypeInfo(a.type);
    const sevInfo   = getSeverityInfo(a.severity);
    const isEditing = editingId === a.id;

    return (
      <View
        key={a.id}
        style={[
          amStyles.alertCard,
          isActive  && { borderColor: sevInfo.color },
          !isActive && { opacity: 0.6 },
        ]}
      >
        {/* Header */}
        <View style={amStyles.alertHeader}>
          <View style={[amStyles.alertBadge, { backgroundColor: typeInfo.color }]}>
            <Text style={{ fontSize: 16 }}>{typeEmoji(a.type)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {isEditing ? (
              <TextInput
                style={amStyles.editInput}
                value={editData.title ?? ''}
                onChangeText={v => setEditData(p => ({ ...p, title: v }))}
                maxLength={100}
              />
            ) : (
              <Text style={amStyles.alertTitle}>{a.title}</Text>
            )}
            <Text style={amStyles.alertMeta}>
              {typeInfo.label}{' • '}{getTimeAgoShort(a.created_at)}
            </Text>
          </View>
          <View style={[amStyles.sevBadge, { backgroundColor: sevInfo.color + '33' }]}>
            <Text style={[amStyles.sevText, { color: sevInfo.color }]}>
              {sevInfo.label}
            </Text>
          </View>
        </View>

        {/* Descripción */}
        {isEditing ? (
          <TextInput
            style={[amStyles.editInput, { minHeight: 60, textAlignVertical: 'top' }]}
            value={editData.description ?? ''}
            onChangeText={v => setEditData(p => ({ ...p, description: v }))}
            multiline maxLength={500}
          />
        ) : (
          <Text style={amStyles.alertDesc}>{a.description}</Text>
        )}

        {/* Info */}
        <View style={amStyles.infoRow}>
          <Text style={amStyles.infoText}>
            {i18n.t('adminDashboard.alertManager.card.location', {
              lat: a.latitude.toFixed(4),
              lng: a.longitude.toFixed(4),
            })}
          </Text>
          <Text style={amStyles.infoText}>
            {i18n.t('adminDashboard.alertManager.card.radius', { n: a.radius_km })}
          </Text>
        </View>
        <Text style={amStyles.infoText}>
          {i18n.t('adminDashboard.alertManager.card.created', {
            date: getLocalizedDateFull(a.created_at),
          })}
        </Text>
        {a.expires_at && (
          <Text style={amStyles.infoText}>
            {i18n.t('adminDashboard.alertManager.card.expires', {
              date: getLocalizedDateFull(a.expires_at),
            })}
          </Text>
        )}

        {/* Severidad editable */}
        {isEditing && (
          <View style={amStyles.editSevRow}>
            <Text style={amStyles.editLabel}>
              {i18n.t('adminDashboard.alertManager.severity')}
            </Text>
            {SEVERITY_LEVELS.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[
                  amStyles.editSevChip,
                  editData.severity === s.id && {
                    backgroundColor: s.color, borderColor: s.color,
                  },
                ]}
                onPress={() => setEditData(p => ({ ...p, severity: s.id }))}
              >
                <Text style={[
                  amStyles.editSevChipText,
                  editData.severity === s.id && { color: '#fff' },
                ]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Botones */}
        <View style={amStyles.btnRow}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={amStyles.btnSave}
                onPress={saveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={amStyles.btnSaveText}>
                    {i18n.t('adminDashboard.alertManager.actions.save')}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={amStyles.btnCancel}
                onPress={() => { setEditingId(null); setEditData({}); }}
              >
                <Text style={amStyles.btnCancelText}>
                  {i18n.t('adminDashboard.alertManager.actions.cancel')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={amStyles.btnEdit}
                onPress={() => startEdit(a)}
              >
                <Text style={amStyles.btnEditText}>
                  {i18n.t('adminDashboard.alertManager.actions.edit')}
                </Text>
              </TouchableOpacity>
              {isActive ? (
                <TouchableOpacity
                  style={amStyles.btnDeactivate}
                  onPress={() => handleDeactivate(a)}
                >
                  <Text style={amStyles.btnDeactivateText}>
                    {i18n.t('adminDashboard.alertManager.actions.deactivate')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={amStyles.btnReactivate}
                  onPress={() => handleReactivate(a)}
                >
                  <Text style={amStyles.btnReactivateText}>
                    {i18n.t('adminDashboard.alertManager.actions.reactivate')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={amStyles.btnDelete}
                onPress={() => handleDelete(a)}
              >
                <Text style={amStyles.btnDeleteText}>
                  {i18n.t('adminDashboard.alertManager.actions.delete')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={amStyles.container}>

      {/* Resumen */}
      <View style={amStyles.summaryRow}>
        <View style={[amStyles.summaryCard, { borderColor: '#ff1744' }]}>
          <Text style={[amStyles.summaryValue, { color: '#ff1744' }]}>
            {activeAlerts.length}
          </Text>
          <Text style={amStyles.summaryLabel}>
            {i18n.t('adminDashboard.alertManager.summary.active')}
          </Text>
        </View>
        <View style={[amStyles.summaryCard, { borderColor: '#666' }]}>
          <Text style={[amStyles.summaryValue, { color: '#666' }]}>
            {inactiveAlerts.length}
          </Text>
          <Text style={amStyles.summaryLabel}>
            {i18n.t('adminDashboard.alertManager.summary.inactive')}
          </Text>
        </View>
        <View style={[amStyles.summaryCard, { borderColor: Colors.teal }]}>
          <Text style={[amStyles.summaryValue, { color: Colors.teal }]}>
            {alerts.length}
          </Text>
          <Text style={amStyles.summaryLabel}>
            {i18n.t('adminDashboard.alertManager.summary.total')}
          </Text>
        </View>
      </View>

      {alerts.length === 0 && (
        <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
          <Text style={{ fontSize: 40 }}>🔕</Text>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {i18n.t('adminDashboard.alertManager.empty.title')}
          </Text>
          <Text style={{ color: '#666', fontSize: 13, textAlign: 'center' }}>
            {i18n.t('adminDashboard.alertManager.empty.subtitle')}
          </Text>
        </View>
      )}

      {activeAlerts.length > 0 && (
        <View style={amStyles.section}>
          <Text style={amStyles.sectionTitle}>
            {i18n.t('adminDashboard.alertManager.sections.active', {
              n: activeAlerts.length,
            })}
          </Text>
          {activeAlerts.map(a => renderCard(a, true))}
        </View>
      )}

      {inactiveAlerts.length > 0 && (
        <View style={amStyles.section}>
          <Text style={amStyles.sectionTitleInactive}>
            {i18n.t('adminDashboard.alertManager.sections.inactive', {
              n: inactiveAlerts.length,
            })}
          </Text>
          {inactiveAlerts.map(a => renderCard(a, false))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// StatCard
// ═══════════════════════════════════════════════════════════════
function StatCard({ icon, label, value, color, highlight = false }: {
  icon: React.ReactNode; label: string;
  value: number; color: string; highlight?: boolean;
}) {
  return (
    <View style={[styles.statCard, highlight && { borderColor: color, borderWidth: 1.5 }]}>
      {icon}
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// RoleBadge
// ═══════════════════════════════════════════════════════════════
function RoleBadge({ role }: { role: string }) {
  const config = {
    admin: { label: i18n.t('adminDashboard.roles.admin'), color: '#e74c3c' },
    pro:   { label: i18n.t('adminDashboard.roles.pro'),   color: '#f7b731' },
    free:  { label: i18n.t('adminDashboard.roles.free'),  color: '#00b894' },
  };
  const c = config[role as keyof typeof config] ?? config.free;
  return (
    <Text style={[styles.roleBadge, { color: c.color }]}>{c.label}</Text>
  );
}

// ═══════════════════════════════════════════════════════════════
// UserItem
// ═══════════════════════════════════════════════════════════════
function UserItem({ user, onChat, adminId }: {
  user: UserRow;
  onChat: () => void;
  adminId: string;
}) {
  const initials = user.full_name
    ?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  // Badge de no leídos — mensajes del usuario hacia el admin
  const [unread, setUnread] = useState(0);
  const chatPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Cargar no leídos de este usuario específico
    const loadUnread = async () => {
      const { supabase } = await import('@/lib/supabase');
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .eq('receiver_id', adminId)
        .eq('is_read', false);
      setUnread(count ?? 0);
    };

    loadUnread();

    // Realtime para este usuario
    const channelName = `admin-unread-${user.id}-${Date.now()}`;
    let channel: any;

    import('@/lib/supabase').then(({ supabase }) => {
      channel = supabase.channel(channelName);
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${user.id}`,
        },
        () => loadUnread()
      );
      channel.subscribe();
    });

    return () => {
      import('@/lib/supabase').then(({ supabase }) => {
        if (channel) supabase.removeChannel(channel);
      });
    };
  }, [user.id, adminId]);

  // Animación de latido cuando hay no leídos
  useEffect(() => {
    if (unread > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(chatPulse, {
            toValue: 0.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(chatPulse, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      chatPulse.stopAnimation();
      chatPulse.setValue(1);
    }
  }, [unread]);

  return (
    <View style={[
      styles.userItem,
      user.is_in_emergency && styles.userItemEmergency,
    ]}>
      <View style={[
        styles.userAvatar,
        user.is_in_emergency && styles.userAvatarEmergency,
      ]}>
        <Text style={styles.userInitials}>{initials}</Text>
        {user.is_in_emergency && <View style={styles.emergencyDot} />}
      </View>

      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName}>{user.full_name}</Text>
          <RoleBadge role={user.role} />
        </View>
        <Text style={styles.userLocation}>
          {i18n.t('adminDashboard.users.location', {
            location: [user.city, user.province, user.country]
              .filter(Boolean).join(', '),
          })}
        </Text>
        {user.is_in_emergency && (
          <Text style={styles.emergencyLabel}>
            {i18n.t('adminDashboard.users.inEmergency')}
          </Text>
        )}
      </View>

      {/* Botón chat con badge parpadeante */}
      <TouchableOpacity style={styles.chatBtn} onPress={onChat}>
        <Animated.View style={{ opacity: chatPulse }}>
          <MessageCircle
            size={18}
            color={unread > 0 ? '#ff9100' : Colors.teal}
          />
        </Animated.View>
        {unread > 0 && (
          <Animated.View style={[styles.chatBadge, { opacity: chatPulse }]}>
            <Text style={styles.chatBadgeText}>
              {unread > 9 ? '9+' : unread}
            </Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// AdminDashboard — PANTALLA PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const router = useRouter();
  const { profile } = useAuth();

  const [stats,           setStats]           = useState<AdminStats | null>(null);
  const [users,           setUsers]           = useState<UserRow[]>([]);
  const [filtered,        setFiltered]        = useState<UserRow[]>([]);
  const [search,          setSearch]          = useState('');
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [filterEmergency, setFilterEmergency] = useState(false);
  const [activeTab,       setActiveTab]       = useState<'users' | 'create' | 'manage'>('users');

  const loadData = async () => {
    try {
      const { data: usersData } = await supabase
        .from('profiles').select('*')
        .order('created_at', { ascending: false });
      const allUsers = (usersData || []) as UserRow[];
      setUsers(allUsers);
      setFiltered(allUsers);

      const { count: msgCount } = await supabase
        .from('messages').select('*', { count: 'exact', head: true });

      const byCountry: Record<string, number> = {};
      for (const u of allUsers) {
        const c = u.country || 'Desconocido';
        byCountry[c] = (byCountry[c] || 0) + 1;
      }
      const usersByCountry = Object.entries(byCountry)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalUsers:        allUsers.length,
        activeEmergencies: allUsers.filter(u => u.is_in_emergency).length,
        totalMessages:     msgCount || 0,
        usersByCountry,
      });
    } catch (err) {
      console.error('[AdminDashboard]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    let result = [...users];
    if (filterEmergency) result = result.filter(u => u.is_in_emergency);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.city?.toLowerCase().includes(q) ||
        u.country?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, filterEmergency, users]);

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator color={Colors.teal} size="large" />
        <Text style={styles.loadingText}>
          {i18n.t('adminDashboard.loading')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {i18n.t('adminDashboard.title')}
          </Text>
          <Text style={styles.headerSub}>
            {i18n.t('adminDashboard.hello', {
              name: profile?.full_name?.split(' ')[0] ?? '',
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/settings')
          }
        >
          <Text style={styles.headerBackText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Users size={16} color={activeTab === 'users' ? Colors.teal : '#666'} />
          <Text style={[
            styles.tabText,
            activeTab === 'users' && styles.tabTextActive,
          ]}>
            {i18n.t('adminDashboard.tabs.users')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'create' && styles.tabActive]}
          onPress={() => setActiveTab('create')}
        >
          <AlertTriangle size={16} color={activeTab === 'create' ? '#ff1744' : '#666'} />
          <Text style={[
            styles.tabText,
            activeTab === 'create' && styles.tabTextActive,
          ]}>
            {i18n.t('adminDashboard.tabs.create')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'manage' && styles.tabActive]}
          onPress={() => setActiveTab('manage')}
        >
          <Shield size={16} color={activeTab === 'manage' ? '#f7b731' : '#666'} />
          <Text style={[
            styles.tabText,
            activeTab === 'manage' && styles.tabTextActive,
          ]}>
            {i18n.t('adminDashboard.tabs.manage')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab — Usuarios */}
      {activeTab === 'users' && (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadData(); }}
              tintColor={Colors.teal}
            />
          }
          contentContainerStyle={styles.scroll}
        >
          {/* Stats */}
          <View style={styles.statsGrid}>
            <StatCard
              icon={<Users size={22} color={Colors.teal} />}
              label={i18n.t('adminDashboard.stats.users')}
              value={stats?.totalUsers ?? 0}
              color={Colors.teal}
            />
            <StatCard
              icon={<AlertTriangle size={22} color="#ff1744" />}
              label={i18n.t('adminDashboard.stats.emergencies')}
              value={stats?.activeEmergencies ?? 0}
              color="#ff1744"
              highlight={!!stats?.activeEmergencies}
            />
            <StatCard
              icon={<MessageCircle size={22} color="#7c4dff" />}
              label={i18n.t('adminDashboard.stats.messages')}
              value={stats?.totalMessages ?? 0}
              color="#7c4dff"
            />
            <StatCard
              icon={<Globe size={22} color="#ff9100" />}
              label={i18n.t('adminDashboard.stats.countries')}
              value={stats?.usersByCountry.length ?? 0}
              color="#ff9100"
            />
          </View>

          {/* Banner emergencias */}
          {stats && stats.activeEmergencies > 0 && (
            <View style={styles.emergencyBanner}>
              <AlertTriangle size={20} color="#ff1744" />
              <Text style={styles.emergencyBannerText}>
                {stats.activeEmergencies === 1
                  ? i18n.t('adminDashboard.emergencyBanner', {
                      n: stats.activeEmergencies,
                    })
                  : i18n.t('adminDashboard.emergencyBannerPlural', {
                      n: stats.activeEmergencies,
                    })}
              </Text>
            </View>
          )}

          {/* Países */}
          {stats && stats.usersByCountry.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {i18n.t('adminDashboard.countries.title')}
              </Text>
              {stats.usersByCountry.map(({ country, count }) => (
                <View key={country} style={styles.countryRow}>
                  <Text style={styles.countryName}>{country}</Text>
                  <View style={styles.countryBarWrapper}>
                    <View style={[
                      styles.countryBar,
                      {
                        width: `${Math.round(
                          (count / (stats?.totalUsers ?? 1)) * 100
                        )}%`,
                      },
                    ]} />
                  </View>
                  <Text style={styles.countryCount}>{count}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Usuarios */}
          <View style={styles.card}>
            <View style={styles.searchRow}>
              <View style={styles.searchInput}>
                <Search size={16} color="#666" />
                <TextInput
                  style={styles.searchText}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={i18n.t('adminDashboard.search.placeholder')}
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.filterBtn,
                filterEmergency && styles.filterBtnActive,
              ]}
              onPress={() => setFilterEmergency(!filterEmergency)}
            >
              <AlertTriangle
                size={14}
                color={filterEmergency ? '#fff' : '#ff1744'}
              />
              <Text style={[
                styles.filterBtnText,
                filterEmergency && styles.filterBtnTextActive,
              ]}>
                {i18n.t('adminDashboard.filter.emergencyOnly')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.cardTitle}>
              {i18n.t('adminDashboard.users.title', { n: filtered.length })}
            </Text>

            {filtered.length === 0 && (
              <Text style={styles.emptyText}>
                {i18n.t('adminDashboard.users.empty')}
              </Text>
            )}

            {filtered.map(u => (
  <UserItem
    key={u.id}
    user={u}
    adminId={profile?.id ?? ''}
    onChat={() => router.push({
      pathname: '/admin/chat',
      params: { userId: u.id, userName: u.full_name },
    })}
  />
))}
          </View>
        </ScrollView>
      )}

      {/* Tab — Crear */}
      {activeTab === 'create' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <AlertCreator />
        </ScrollView>
      )}

      {/* Tab — Gestionar */}
      {activeTab === 'manage' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <AlertManager />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0a0a0a' },
  loadingCenter: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:   { color: '#aaa', fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  headerTitle:    { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerSub:      { color: '#aaa', fontSize: 13, marginTop: 2 },
  headerBack:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerBackText: { color: '#aaa', fontSize: 20 },
  tabs:          { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: Colors.teal },
  tabText:       { color: '#666', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: Colors.teal },
  scroll:        { padding: 16, gap: 12 },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard:      { flex: 1, minWidth: '45%', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#222' },
  statValue:     { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  statLabel:     { color: '#aaa', fontSize: 12 },
  emergencyBanner:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,23,68,0.12)', borderWidth: 1, borderColor: '#ff1744', borderRadius: 10, padding: 12 },
  emergencyBannerText: { color: '#ff1744', fontSize: 14, fontWeight: '600' },
  card:      { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#222', gap: 10 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  countryRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countryName:       { color: '#ccc', fontSize: 13, width: 90 },
  countryBarWrapper: { flex: 1, height: 6, backgroundColor: '#2a2a3e', borderRadius: 3, overflow: 'hidden' },
  countryBar:        { height: '100%', backgroundColor: Colors.teal, borderRadius: 3 },
  countryCount:      { color: '#aaa', fontSize: 12, width: 24, textAlign: 'right' },
  searchRow:   { marginBottom: 4 },
  searchInput: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0f0f1a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333' },
  searchText:  { flex: 1, color: '#fff', fontSize: 14 },
  filterBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ff1744', alignSelf: 'flex-start' },
  filterBtnActive:    { backgroundColor: '#ff1744' },
  filterBtnText:      { color: '#ff1744', fontSize: 13 },
  filterBtnTextActive:{ color: '#fff' },
  emptyText: { color: '#666', textAlign: 'center', paddingVertical: 20 },
  userItem:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  userItemEmergency:  { backgroundColor: 'rgba(255,23,68,0.06)', borderRadius: 8, paddingHorizontal: 6 },
  userAvatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2a2a4e', justifyContent: 'center', alignItems: 'center' },
  userAvatarEmergency:{ backgroundColor: 'rgba(255,23,68,0.2)', borderWidth: 2, borderColor: '#ff1744' },
  userInitials:       { color: Colors.teal, fontSize: 16, fontWeight: 'bold' },
  emergencyDot:       { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff1744', borderWidth: 2, borderColor: '#0a0a0a' },
  userInfo:      { flex: 1, gap: 3 },
  userNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName:      { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  userLocation:  { color: '#888', fontSize: 12 },
  emergencyLabel:{ color: '#ff1744', fontSize: 12, fontWeight: 'bold' },
  roleBadge:     { fontSize: 11, fontWeight: '600' },
  chatBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,184,148,0.1)', justifyContent: 'center', alignItems: 'center' },
});

const acStyles = StyleSheet.create({
  container:  { gap: 12 },
  mapCard:    { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#333', gap: 8 },
  mapLabel:   { color: Colors.teal, fontSize: 13, fontWeight: '600' },
  mapBox:     { height: 280, borderRadius: 12, overflow: 'hidden' },
  card:       { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#333', gap: 10 },
  cardTitle:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#0f0f1a' },
  chipSeverity:      { minWidth: 70, alignItems: 'center' },
  chipText:          { color: '#aaa', fontSize: 13 },
  radioBtns:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radioBtn:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#0f0f1a' },
  radioBtnActive:    { borderColor: Colors.teal, backgroundColor: 'rgba(92,225,230,0.12)' },
  radioBtnText:      { color: '#aaa', fontSize: 13 },
  radioBtnTextActive:{ color: Colors.teal, fontWeight: '700' },
  radioHint:    { color: '#555', fontSize: 12 },
  input:        { backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14 },
  inputMulti:   { minHeight: 100, textAlignVertical: 'top' },
  charCount:    { color: '#555', fontSize: 11, textAlign: 'right' },
  summaryCard:  { backgroundColor: 'rgba(92,225,230,0.06)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(92,225,230,0.25)', gap: 6 },
  summaryTitle: { color: Colors.teal, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  summaryRow:   { color: '#aaa', fontSize: 13 },
  createBtn:         { backgroundColor: '#e74c3c', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  createBtnDisabled: { opacity: 0.4 },
  createBtnSuccess:  { backgroundColor: '#00b894' },
  createBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});

const amStyles = StyleSheet.create({
  container:            { gap: 12 },
  summaryRow:           { flexDirection: 'row', gap: 10 },
  summaryCard:          { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1 },
  summaryValue:         { fontSize: 24, fontWeight: 'bold' },
  summaryLabel:         { color: '#aaa', fontSize: 11 },
  section:              { gap: 10 },
  sectionTitle:         { color: '#ff1744', fontSize: 14, fontWeight: '700' },
  sectionTitleInactive: { color: '#666', fontSize: 14, fontWeight: '700', marginTop: 8 },
  alertCard:    { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#333', gap: 10 },
  alertHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertBadge:   { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  alertTitle:   { color: '#fff', fontSize: 14, fontWeight: '600' },
  alertMeta:    { color: '#888', fontSize: 11, marginTop: 2 },
  alertDesc:    { color: '#aaa', fontSize: 13, lineHeight: 18 },
  sevBadge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sevText:      { fontSize: 10, fontWeight: '700' },
  infoRow:      { flexDirection: 'row', gap: 16 },
  infoText:     { color: '#666', fontSize: 12 },
  btnRow:       { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnEdit:      { flex: 1, backgroundColor: 'rgba(92,225,230,0.1)', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(92,225,230,0.3)' },
  btnEditText:  { color: Colors.teal, fontSize: 13, fontWeight: '600' },
  btnDeactivate:    { flex: 1, backgroundColor: 'rgba(255,145,0,0.1)', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,145,0,0.3)' },
  btnDeactivateText:{ color: '#ff9100', fontSize: 13, fontWeight: '600' },
  btnReactivate:    { flex: 1, backgroundColor: 'rgba(0,184,148,0.1)', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,184,148,0.3)' },
  btnReactivateText:{ color: '#00b894', fontSize: 13, fontWeight: '600' },
  btnDelete:    { width: 44, backgroundColor: 'rgba(255,49,49,0.1)', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,49,49,0.3)' },
  btnDeleteText:{ fontSize: 18 },
  btnSave:      { flex: 1, backgroundColor: '#00b894', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnSaveText:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnCancel:    { flex: 1, backgroundColor: '#333', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnCancelText:{ color: '#aaa', fontSize: 13 },
  editInput:    { backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: Colors.teal, borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 },
  editSevRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  editLabel:    { color: '#aaa', fontSize: 13 },
  editSevChip:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#333' },
  editSevChipText: { color: '#aaa', fontSize: 12 },
    chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff9100',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  chatBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});