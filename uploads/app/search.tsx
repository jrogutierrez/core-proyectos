import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, X, Search } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import i18n from '@/i18n';

// ── Tipo de resultado ──────────────────────────────────────────
interface CityResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  country: string;
  isRural?: boolean;
}

// ── Búsqueda con Nominatim (igual que WeatherCitySearch) ───────
async function searchCities(query: string): Promise<CityResult[]> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}` +
      `&format=json&limit=10` +
      `&accept-language=es` +
      `&addressdetails=1`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DEFENSOR-JRG/1.0',
      },
    });

    if (!res.ok) return [];

    const data = await res.json();

    return data
      .filter((item: any) => {
        const type = (item.type || '').toLowerCase();
        const cls  = (item.class || '').toLowerCase();
        return (
          cls === 'place' ||
          cls === 'boundary' ||
          type === 'city' ||
          type === 'town' ||
          type === 'village' ||
          type === 'hamlet' ||
          type === 'municipality' ||
          type === 'suburb' ||
          type === 'locality'
        );
      })
      .map((item: any) => {
        const parts = item.display_name.split(',');
        const name = parts[0]?.trim() ?? query;
        const country = parts[parts.length - 1]?.trim() ?? '';
        const isRural =
          item.type === 'village' ||
          item.type === 'hamlet' ||
          item.type === 'locality';

        return {
          name,
          displayName: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          country,
          isRural,
        };
      });
  } catch {
    return [];
  }
}

// ── Pantalla ───────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Búsqueda con debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setNoResults(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setNoResults(false);
      try {
        const found = await searchCities(query);
        setResults(found);
        setNoResults(found.length === 0);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (city: CityResult) => {
    // Navegar al mapa con las coordenadas de la ciudad elegida
    router.push({
      pathname: '/weather',
      params: {
        focusLat: city.latitude.toString(),
        focusLng: city.longitude.toString(),
        focusCity: city.name,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (router.canGoBack()) { router.back(); }
              else { router.replace('/'); }
            }}
          >
            <ChevronLeft size={28} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {i18n.t('search.title')}
          </Text>
        </View>

        {/* Input */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputRow}>
            <Search size={18} color={Colors.whiteAlpha70} style={{ marginRight: 4 }} />
            <TextInput
              style={styles.input}
              placeholder={i18n.t('search.placeholder')}
              placeholderTextColor={Colors.whiteAlpha70}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              autoCorrect={false}
            />
            {searching && (
              <ActivityIndicator size="small" color={Colors.teal} />
            )}
            {query.length > 0 && !searching && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setQuery('');
                  setResults([]);
                  setNoResults(false);
                }}
              >
                <X size={18} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>

          {/* Resultados */}
          {results.length > 0 && (
            <View style={styles.suggestions}>
              <FlatList
                data={results}
                keyExtractor={(item, index) =>
                  `${item.name}-${item.latitude}-${index}`
                }
                keyboardShouldPersistTaps="handled"
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[
                      styles.suggestionItem,
                      index < results.length - 1 && styles.suggestionBorder,
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <Text style={styles.cityIcon}>
                      {item.isRural ? '🏘️' : '🏙️'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cityName}>{item.name}</Text>
                      <Text style={styles.cityDetail} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Sin resultados */}
          {noResults && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>
                {i18n.t('search.noResults', { query })}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8,
    paddingBottom: 16, gap: 8,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 20, fontWeight: '600', letterSpacing: 0.5 },
  inputWrapper: { paddingHorizontal: 16, gap: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 16,
    paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.teal,
    gap: 8,
  },
  input:    { flex: 1, color: Colors.white, fontSize: 16, paddingVertical: 14 },
  clearBtn: { padding: 8 },
  suggestions: {
    backgroundColor: 'rgba(92,225,230,0.08)',
    borderRadius: 16, overflow: 'hidden', marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(92,225,230,0.2)',
    maxHeight: 400,
  },
  suggestionItem: {
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  cityIcon:   { fontSize: 20 },
  cityName:   { color: Colors.white, fontSize: 15, fontWeight: '500' },
  cityDetail: { color: Colors.whiteAlpha70, fontSize: 12, marginTop: 2 },
  noResults: {
    backgroundColor: 'rgba(92,225,230,0.08)',
    borderRadius: 16, padding: 20,
    alignItems: 'center', marginTop: 4,
  },
  noResultsText: {
    color: Colors.whiteAlpha70, fontSize: 14, textAlign: 'center',
  },
});