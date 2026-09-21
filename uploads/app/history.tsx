// app/history.tsx
// Historial de indicaciones de emergencia
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import AudioMessage from '@/components/AudioMessage';
import {
  getInstructions, toggleCompleted, Instruction,
} from '@/services/instruction-history';
import i18n from '@/i18n';
import { getLocalizedDateLabel, getLocalizedTime } from '@/utils/dateLocale';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function getSourceLabel(source: string): string {
  switch (source) {
    case 'assistant':   return i18n.t('history.sources.assistant');
    case 'admin_chat':  return i18n.t('history.sources.adminChat');
    case 'admin_audio': return i18n.t('history.sources.adminAudio');
    default:            return i18n.t('history.sources.default');
  }
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'assistant':   return Colors.teal;
    case 'admin_chat':  return Colors.red;
    case 'admin_audio': return Colors.red;
    default:            return Colors.grey;
  }
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<'all' | 'pending' | 'done'>('all');

  // ── Cargar instrucciones ──────────────────────────────────
  const loadInstructions = async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await getInstructions(user.id);
    setInstructions(data);
    setLoading(false);
  };

  useEffect(() => { loadInstructions(); }, [user?.id]);

  // ── Marcar como completado ────────────────────────────────
  const handleToggle = async (id: string, current: boolean) => {
    const updated = !current;
    setInstructions((prev) =>
      prev.map((i) => i.id === id ? { ...i, is_completed: updated } : i)
    );
    await toggleCompleted(id, updated);
  };

  // ── Filtrar ───────────────────────────────────────────────
  const filtered = instructions.filter((i) => {
    if (filter === 'pending') return !i.is_completed;
    if (filter === 'done')    return i.is_completed;
    return true;
  });

  // ── Agrupar por fecha ─────────────────────────────────────
  const grouped: { date: string; items: Instruction[] }[] = [];
  let lastDate = '';
  for (const item of filtered) {
    const date = getLocalizedDateLabel(item.created_at);
    if (date !== lastDate) {
      grouped.push({ date, items: [item] });
      lastDate = date;
    } else {
      grouped[grouped.length - 1].items.push(item);
    }
  }

  // ── Stats ─────────────────────────────────────────────────
  const total   = instructions.length;
  const done    = instructions.filter((i) => i.is_completed).length;
  const pending = total - done;

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.teal} />
        <Text style={styles.loadingText}>
          {i18n.t('history.loading')}
        </Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>

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
        <Text style={styles.headerTitle}>
          {i18n.t('history.title')}
        </Text>
        <TouchableOpacity
          onPress={loadInstructions}
          style={styles.iconBtn}
        >
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{total}</Text>
          <Text style={styles.statLabel}>
            {i18n.t('history.stats.total')}
          </Text>
        </View>
        <View style={[styles.statCard, styles.statCardPending]}>
          <Text style={[styles.statNumber, { color: Colors.red }]}>
            {pending}
          </Text>
          <Text style={styles.statLabel}>
            {i18n.t('history.stats.pending')}
          </Text>
        </View>
        <View style={[styles.statCard, styles.statCardDone]}>
          <Text style={[styles.statNumber, { color: Colors.teal }]}>
            {done}
          </Text>
          <Text style={styles.statLabel}>
            {i18n.t('history.stats.done')}
          </Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'done'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterText,
              filter === f && styles.filterTextActive,
            ]}>
              {i18n.t(`history.filters.${f}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista o vacío */}
      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>
            {i18n.t(`history.empty.${filter}`)}
          </Text>
          <Text style={styles.emptySubtext}>
            {i18n.t('history.empty.subtitle')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View style={styles.group}>

              {/* Separador de fecha */}
              <View style={styles.dateSeparator}>
                <View style={styles.dateLine} />
                <Text style={styles.dateLabel}>{group.date}</Text>
                <View style={styles.dateLine} />
              </View>

              {/* Instrucciones del día */}
              {group.items.map((instruction) => (
                <View key={instruction.id} style={styles.instructionCard}>

                  {/* Header */}
                  <View style={styles.instructionHeader}>
                    <Text style={[
                      styles.sourceTag,
                      { color: getSourceColor(instruction.source) },
                    ]}>
                      {getSourceLabel(instruction.source)}
                    </Text>
                    <Text style={styles.timeTag}>
                      {getLocalizedTime(instruction.created_at)}
                    </Text>
                  </View>

                  {/* Contenido */}
                  {instruction.type === 'audio' ? (
                    <AudioMessage
                      url={instruction.content}
                      isOwn={false}
                      isAdmin={instruction.source !== 'assistant'}
                    />
                  ) : (
                    <Text style={[
                      styles.instructionText,
                      instruction.is_completed && styles.instructionTextDone,
                    ]}>
                      {instruction.content}
                    </Text>
                  )}

                  {/* Botón completar */}
                  <TouchableOpacity
                    style={[
                      styles.completeBtn,
                      instruction.is_completed && styles.completeBtnDone,
                    ]}
                    onPress={() =>
                      handleToggle(instruction.id, instruction.is_completed)
                    }
                  >
                    <Text style={[
                      styles.completeBtnText,
                      instruction.is_completed && styles.completeBtnTextDone,
                    ]}>
                      {instruction.is_completed
                        ? i18n.t('history.complete.marked')
                        : i18n.t('history.complete.mark')}
                    </Text>
                  </TouchableOpacity>

                </View>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────
// Estilos — sin cambios
// ─────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: {
    flex: 1, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingText: { color: Colors.grey, fontSize: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backText:    { color: Colors.red, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 1.5 },
  iconBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  refreshIcon: { color: Colors.teal, fontSize: 22, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16,
    gap: 10, marginBottom: 12,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  statCardPending: {
    borderColor: 'rgba(255,49,49,0.3)',
    backgroundColor: 'rgba(255,49,49,0.06)',
  },
  statCardDone: {
    borderColor: 'rgba(92,225,230,0.3)',
    backgroundColor: 'rgba(92,225,230,0.06)',
  },
  statNumber: { color: Colors.white, fontSize: 24, fontWeight: '700' },
  statLabel:  { color: Colors.grey, fontSize: 11, marginTop: 2 },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16,
    gap: 8, marginBottom: 16,
  },
  filterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    alignItems: 'center', backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  filterBtnActive:  { backgroundColor: Colors.teal, borderColor: Colors.teal },
  filterText:       { color: Colors.grey, fontSize: 13 },
  filterTextActive: { color: Colors.bg, fontWeight: '700' },
  listContent:      { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  group:            { gap: 8 },
  dateSeparator: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginVertical: 8,
  },
  dateLine:  { flex: 1, height: 1, backgroundColor: Colors.borderSubtle },
  dateLabel: { color: Colors.greyDark, fontSize: 12, fontWeight: '600' },
  instructionCard: {
    backgroundColor: Colors.bgCard, borderRadius: 14,
    padding: 14, gap: 10,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  instructionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sourceTag:           { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  timeTag:             { color: Colors.greyDark, fontSize: 11 },
  instructionText:     { color: Colors.white, fontSize: 14, lineHeight: 22 },
  instructionTextDone: { color: Colors.greyDark, textDecorationLine: 'line-through' },
  completeBtn: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(92,225,230,0.1)',
    borderWidth: 1, borderColor: 'rgba(92,225,230,0.3)',
  },
  completeBtnDone:     { backgroundColor: 'rgba(92,225,230,0.06)', borderColor: Colors.borderSubtle },
  completeBtnText:     { color: Colors.teal, fontSize: 12, fontWeight: '600' },
  completeBtnTextDone: { color: Colors.greyDark },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32,
  },
  emptyIcon:    { fontSize: 48 },
  emptyText:    { color: Colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySubtext: { color: Colors.greyDark, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});