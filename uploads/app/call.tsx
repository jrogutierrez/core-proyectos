import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bell, Volume2, VolumeX, MapPin, PhoneOff } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import i18n from '@/i18n';

export default function CallScreen() {
  const router = useRouter();
  const [speakerOn, setSpeakerOn] = useState(false);
  const [muted, setMuted] = useState(false);

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
        <Text style={styles.headerTitle}>
          {i18n.t('call.title')}
        </Text>
        <TouchableOpacity style={styles.sosBtn}>
          <Bell size={24} color={Colors.redBell} fill={Colors.redBell} strokeWidth={0} />
        </TouchableOpacity>
      </View>

      <View style={styles.callerArea}>
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=1',
            }}
            style={styles.avatar}
          />
        </View>
        <Text style={styles.callerName}>Papá</Text>
        <Text style={styles.callStatus}>
          {i18n.t('call.status')}
        </Text>
      </View>

      <View style={styles.actionsArea}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, speakerOn && styles.actionBtnActive]}
            onPress={() => setSpeakerOn(!speakerOn)}
          >
            <Volume2 size={24} color={Colors.white} />
            <Text style={styles.actionLabel}>
              {i18n.t('call.actions.speaker')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, muted && styles.actionBtnMuted]}
            onPress={() => setMuted(!muted)}
          >
            <VolumeX size={24} color={Colors.white} />
            <Text style={styles.actionLabel}>
              {i18n.t('call.actions.mute')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnLocation]}>
            <MapPin size={24} color={Colors.white} />
            <Text style={styles.actionLabel}>
              {i18n.t('call.actions.location')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.hangupBtn}
          onPress={() => router.back()}
        >
          <PhoneOff size={28} color={Colors.white} />
          <Text style={styles.hangupLabel}>
            {i18n.t('call.actions.hangup')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// estilos sin cambios
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 18, fontWeight: '500', letterSpacing: 0.3 },
  sosBtn:      { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  callerArea:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  avatarContainer: {
    width: 160, height: 160, borderRadius: 80,
    overflow: 'hidden', borderWidth: 3,
    borderColor: Colors.whiteAlpha30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 16,
  },
  avatar:      { width: '100%', height: '100%' },
  callerName:  { color: Colors.white, fontSize: 24, fontWeight: '600', letterSpacing: 0.3 },
  callStatus:  { color: Colors.whiteAlpha70, fontSize: 15 },
  actionsArea: { padding: 20, gap: 12 },
  actionRow:   { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, backgroundColor: Colors.callBtnBg,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', gap: 8,
  },
  actionBtnActive:   { backgroundColor: Colors.tealDark },
  actionBtnMuted:    { backgroundColor: Colors.blockBtnBg },
  actionBtnLocation: { backgroundColor: Colors.callBtnBg },
  actionLabel:       { color: Colors.white, fontSize: 13, fontWeight: '500' },
  hangupBtn: {
    backgroundColor: Colors.hangupBg, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 10,
  },
  hangupLabel: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});