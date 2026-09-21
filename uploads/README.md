# 🛡️ DEFENSOR JRG

> **"Esta app es una posibilidad de sobrevivir para la gente"**

Aplicación móvil y web de alerta temprana y asistencia en emergencias climáticas y desastres naturales.

---

## 🎯 ¿Qué es DEFENSOR JRG?

DEFENSOR JRG es una plataforma de protección civil que combina:

- **Asistente IA** entrenado en protocolos de emergencia reales
- **Mapa de alertas en tiempo real** (terremotos, tormentas, incendios, volcanes)
- **Sistema de alertas por proximidad** con avisos automáticos por voz
- **SOS manual** con notificación en tiempo real al equipo de asistencia
- **Manos libres operacional** para situaciones donde no se puede escribir

Construido por un desarrollador con experiencia real en operaciones de emergencia.

---

## ✨ Features principales

### 🤖 Asistente IA de emergencias
- Responde como despachador de emergencias entrenado
- Pasos numerados y directos en situaciones críticas
- Recomienda activar SOS cuando detecta peligro grave
- Voz bidireccional (habla y escucha)
- Modo manos libres operacional 👐
- Conectado a manuales PDF de referencia

### 🗺️ Mapa de alertas en tiempo real
- Terremotos (USGS), Tormentas, Incendios, Volcanes
- Flechas animadas de dirección para tormentas
- Elipses de propagación para incendios (según viento)
- Anillos expansivos para terremotos y volcanes
- Sistema de alertas por proximidad 
- Avisos automáticos por voz cuando hay amenaza cercana

### 🆘 Sistema SOS
- Botón SOS con confirmación
- Registro de ubicación GPS
- Notificación en tiempo real al admin
- Panel admin con lista de emergencias activas
- Historial de eventos

### 🔐 Seguridad multicapa
- Capa 1: Anti prompt injection + sanitización
- Capa 2: Protección del SOS (rate limiting, anti-abuso)
- Capa 3: Firewall API por rol (Gladiator)
- Capa 4: Edge Function en Supabase (API key segura)
- RLS auditado en todas las tablas

### ♿ Accesibilidad
- TTS adaptado por país/idioma
- STT para comunicación sin escribir
- Modo manos libres para discapacidad motriz
- Base para adaptaciones futuras (auditiva, visual, cognitiva)

---

## 🛠️ Stack

| Tecnología | Uso |
|-----------|-----|
| React Native + Expo | Frontend mobile/web |
| TypeScript | Tipado completo |
| Supabase | Auth, DB, Storage, Realtime, Edge Functions |
| Groq (LLaMA 3) | Motor de IA |
| Leaflet + OpenStreetMap | Mapa interactivo |
| Open-Meteo | Clima en tiempo real |
| USGS API | Datos de terremotos |
| Web Speech API | STT en Chrome |
| expo-speech | TTS multiplataforma |

---

## 🏗️ Arquitectura
Usuario
↓
Frontend (React Native / Web)
→ Capa 1: Anti injection (client)
→ Capa 3: Gladiator rate limit (client)
↓
Supabase Edge Function (servidor)
→ Auth verificada
→ Rate limit real
→ Anti injection (server)
→ Groq API (key segura)
↓
Respuesta filtrada al usuario

text


---

## 🚀 Setup

### 1. Clonar

```bash
git clone https://github.com/jrogutierrez/defensor-jrg.git
cd defensor-jrg
npm install
2. Configurar Supabase
Bash

cp lib/supabase.example.ts lib/supabase.ts
Completá con tus credenciales de supabase.com.

3. Configurar Groq
Bash

cp services/groq.example.ts services/groq.ts
La API key de Groq debe configurarse como secret en Supabase Edge Functions.

4. Deploy Edge Function
Bash

supabase functions deploy assistant
5. Correr
Bash

npx expo start --web --clear
📁 Estructura
text

app/                    # Pantallas (Expo Router)
  index.tsx             # Home + SOS + Asistente
  weather.tsx           # Mapa + Alertas
  auth.tsx              # Login/Registro
  ...

components/
  FloatingAssistantBubble.tsx

context/
  AssistantContext.tsx

hooks/
  useAssistant.ts
  useProximityAlerts.ts
  useSpeechToText.ts
  useRealtimeSOS.ts
  ...

services/
  proximity-alerts.ts
  alert-visuals/        # Visuales por tipo de evento
  sos-security.ts
  api-firewall.ts
  voice.ts
  speech-to-text.ts
  ...

supabase/
  functions/            # Edge Functions (privado)
🔒 Seguridad
Este repositorio no incluye:

Prompts operativos del asistente
Patrones específicos de detección de ataques
Lógica de la Edge Function
Credenciales de ningún tipo
Ver archivos .example.ts para referencias de configuración.

📊 Estado del proyecto
Área	Estado
Auth + Roles	✅
SOS + Admin	✅
Asistente IA	✅
Voz (TTS + STT)	✅
Manos libres	✅
Mapa de alertas	✅
Alertas por proximidad	✅
Seguridad multicapa	✅
Edge Function	✅
Dashboard admin web	🔜
Notificaciones push	🔜
Offline mode	🔜
i18n	🔜
👤 Autor
jrogutierrez

GitHub: @jrogutierrez
YouTube: GutierrezDeveloping
Desarrollador + Especialista en operaciones de emergencia real.
