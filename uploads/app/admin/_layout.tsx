// app/admin/_layout.tsx
// Protege todas las rutas /admin para que solo
// usuarios con rol 'admin' puedan acceder

import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!profile || profile.role !== 'admin') {
      console.warn('[Admin] Acceso denegado. Redirigiendo...');
      router.replace('/');
    }
  }, [profile, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#00b894" size="large" />
      </View>
    );
  }

  if (!profile || profile.role !== 'admin') return null;

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}