import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { CountryPicker } from '@/components/CountryPicker';
import { CitySearch } from '@/components/CitySearch';
import { Country } from '@/constants/countries';
import { CityResult } from '@/services/geocoding';
import { Colors } from '@/constants/theme';
import i18n from '@/i18n';

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge]           = useState('');
  const [disability, setDisability]         = useState('');
  const [emergencyName, setEmergencyName]   = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedCity, setSelectedCity]       = useState<CityResult | null>(null);
  const [error, setError] = useState('');

   // ── Login ─────────────────────────────────────────────────
 const handleLogin = async () => {
  setError('');
  const cleanEmail = email.trim().toLowerCase(); // Limpia espacios accidentales y pasa a minúsculas
  const cleanPassword = password.trim();

  if (!cleanEmail || !cleanPassword) {
    setError(i18n.t('auth.validation.emailRequired'));
    return;
  }
  const result = await signIn(cleanEmail, cleanPassword);
  if (result.success) {
    setTimeout(() => {
      router.replace('/');
    }, 100);
  } else {
    setError(result.error || i18n.t('auth.errorLogin'));
  }
};

  // ── Register ──────────────────────────────────────────────
  const handleRegister = async () => {
    setError('');

    if (!email || !password || !fullName) {
      setError(i18n.t('auth.validation.required'));
      return;
    }
    if (!selectedCountry) {
      setError(i18n.t('auth.validation.selectCountry'));
      return;
    }
    if (!selectedCity) {
      setError(i18n.t('auth.validation.selectCity'));
      return;
    }
    if (password.length < 6) {
      setError(i18n.t('auth.validation.passwordLength'));
      return;
    }

    const result = await signUp(email, password, {
      full_name:               fullName,
      age:                     age ? parseInt(age) : null,
      city:                    selectedCity.name,
      province:                selectedCity.province || '',
      country:                 selectedCountry.name,
      country_code:            selectedCountry.code,
      latitude:                selectedCity.latitude,
      longitude:               selectedCity.longitude,
      disability:              disability || undefined,
      emergency_contact_name:  emergencyName || undefined,
      emergency_contact_phone: emergencyPhone || undefined,
    });

    if (result.success) {
      if (Platform.OS === 'web') {
        window.alert(
          `${i18n.t('auth.success.title')}\n\n${i18n.t('auth.success.message')}`
        );
        setMode('login');
      } else {
        Alert.alert(
          i18n.t('auth.success.title'),
          i18n.t('auth.success.message'),
          [{ text: 'OK', onPress: () => setMode('login') }]
        );
      }
    } else {
      setError(result.error || i18n.t('auth.errorRegister'));
    }
  };

   return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.shield}>🛡️</Text>
          <Text style={styles.title}>DEFENSOR JRG</Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? i18n.t('auth.loginTitle')
              : i18n.t('auth.registerTitle')}
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* Formulario */}
        <View style={styles.form}>
          {mode === 'register' && (
            <>
              <Text style={styles.label}>
                {i18n.t('auth.fields.fullName')}
              </Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder={i18n.t('auth.placeholders.fullName')}
                placeholderTextColor="#666"
              />

              <Text style={styles.label}>
                {i18n.t('auth.fields.age')}
              </Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder={i18n.t('auth.placeholders.age')}
                placeholderTextColor="#666"
                keyboardType="numeric"
              />

              <Text style={styles.label}>
                {i18n.t('auth.fields.country')}
              </Text>
              <CountryPicker
                value={selectedCountry}
                onChange={(country) => {
                  setSelectedCountry(country);
                  setSelectedCity(null);
                }}
              />

              <Text style={styles.label}>
                {i18n.t('auth.fields.city')}
              </Text>
              <CitySearch
                value={selectedCity}
                countryCode={selectedCountry?.code || ''}
                provinceName={selectedCity?.province || ''}
                onChange={setSelectedCity}
                disabled={!selectedCountry}
              />

              {selectedCity && (
                <View style={styles.locationInfo}>
                  <Text style={styles.locationInfoText}>
                    📍 {selectedCity.name}
                    {selectedCity.state ? `, ${selectedCity.state}` : ''}
                    {' — '}{selectedCountry?.flag} {selectedCountry?.name}
                  </Text>
                  <Text style={styles.locationCoords}>
                    🌐 {selectedCity.latitude.toFixed(4)}, {selectedCity.longitude.toFixed(4)}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>
                {i18n.t('auth.fields.disability')}
              </Text>
              <TextInput
                style={styles.input}
                value={disability}
                onChangeText={setDisability}
                placeholder={i18n.t('auth.placeholders.disability')}
                placeholderTextColor="#666"
              />

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>
                {i18n.t('auth.fields.emergencyContact')}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {i18n.t('auth.fields.emergencyContactSub')}
              </Text>

              <Text style={styles.label}>
                {i18n.t('auth.fields.emergencyName')}
              </Text>
              <TextInput
                style={styles.input}
                value={emergencyName}
                onChangeText={setEmergencyName}
                placeholder={i18n.t('auth.placeholders.emergencyName')}
                placeholderTextColor="#666"
              />

              <Text style={styles.label}>
                {i18n.t('auth.fields.emergencyPhone')}
              </Text>
              <TextInput
                style={styles.input}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                placeholder={i18n.t('auth.placeholders.emergencyPhone')}
                placeholderTextColor="#666"
                keyboardType="phone-pad"
              />

              <View style={styles.divider} />
            </>
          )}

          <Text style={styles.label}>
            {i18n.t('auth.fields.email')}
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={i18n.t('auth.placeholders.email')}
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>
            {i18n.t('auth.fields.password')}
          </Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={i18n.t('auth.placeholders.password')}
            placeholderTextColor="#666"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login'
                  ? i18n.t('auth.loginBtn')
                  : i18n.t('auth.registerBtn')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            <Text style={styles.toggleText}>
              {mode === 'login'
                ? i18n.t('auth.toggleToRegister')
                : i18n.t('auth.toggleToLogin')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.securityInfo}>
          <Text style={styles.securityText}>
            {i18n.t('auth.security')}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// estilos sin cambios
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 300 },
  header:        { alignItems: 'center', marginBottom: 30 },
  shield:        { fontSize: 60, marginBottom: 10 },
  title:         { fontSize: 28, fontWeight: 'bold', color: Colors.teal, letterSpacing: 2 },
  subtitle:      { fontSize: 16, color: Colors.grey, marginTop: 5 },
  errorBox:      { backgroundColor: Colors.red, padding: 12, borderRadius: 8, marginBottom: 15 },
  errorText:     { color: Colors.white, textAlign: 'center', fontSize: 14 },
  form:          { width: '100%' },
  label:         { color: Colors.whiteAlpha70, fontSize: 14, marginBottom: 5, marginTop: 10 },
  input: {
    backgroundColor: Colors.bgElevated, borderWidth: 1,
    borderColor: Colors.borderSubtle, borderRadius: 10,
    padding: 14, color: Colors.white, fontSize: 16,
  },
  locationInfo: {
    backgroundColor: 'rgba(92,225,230,0.08)', borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.25)', borderRadius: 8,
    padding: 10, marginTop: 6,
  },
  locationInfoText: { color: Colors.teal, fontSize: 13 },
  locationCoords:   { color: Colors.greyDark, fontSize: 11, marginTop: 3 },
  button: {
    backgroundColor: Colors.teal, padding: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 25,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: Colors.bg, fontSize: 18, fontWeight: 'bold' },
  toggleButton:   { marginTop: 20, alignItems: 'center' },
  toggleText:     { color: Colors.teal, fontSize: 15 },
  divider:        { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 20 },
  sectionTitle:   { color: Colors.white, fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  sectionSubtitle:{ color: Colors.greyDark, fontSize: 13, marginBottom: 10 },
  securityInfo: {
    marginTop: 30, padding: 15, backgroundColor: Colors.bgElevated,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  securityText: { color: Colors.greyDark, textAlign: 'center', fontSize: 12, lineHeight: 18 },
});