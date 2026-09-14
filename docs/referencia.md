# Referencia del proyecto – Calculadora de Índice de Peligro de Incendio

## Estado actual (2026‑09‑14)

- **Arquitectura**: aplicación *single‑page* dentro de `src/` con:
  - `index.html` (HTML + CSS + JS) que consulta la API del Defensor JRG, procesa los datos y muestra un semáforo de riesgo.
  - `sw.js` Service Worker para funcionamiento offline (caché de recursos estáticos y estrategia *network‑first* para la API).
- **Datos**: se solicitan a `http://45.82.73.208:4000/v1/situation?lat=-27.4712&lon=-58.8390`.  
  Los campos aceptados son `temperature|temp|t`, `humidity|hum|h` y `wind_speed|wind|w`.  
  Cualquier variación es normalizada antes de aplicar la regla.
- **Regla del 30**:
  - **Temperatura ≥ 30 °C**
  - **Humedad ≤ 30 %**
  - **Viento ≥ 30 km/h**
  - **Resultado**  
    - 3 condiciones → 🔴 *Peligro Extremo*  
    - 1‑2 condiciones → 🟡 *Precaución*  
    - 0 condiciones → 🟢 *Seguro*
- **UI / UX**:
  - Tema oscuro tipo “dashboard táctico”.
  - Tipografía monoespaciada para dar sensación de herramienta de campo.
  - Botón “Exportar reporte PDF” que genera un documento con jsPDF (CDN).
- **Seguridad**:
  - Sanitización de los valores mostrados mediante `escapeHTML` nativo.
  - No se usa Firebase ni ningún backend adicional.
- **Persistencia offline**:
  - `sw.js` guarda `index.html` y cualquier recurso externo solicitado (p.ej. jsPDF) para que la herramienta siga operando sin conexión.
- **Próximos pasos** (opcional):
  - Añadir notificaciones push cuando el estado cambie a *Peligro Extremo*.
  - Guardar histórico en `localStorage` para análisis de tendencias.

---  
*Documentado y generado por el Escriba (📝) del ecosistema C.O.R.E.*  