# Informe de Etapa Actual – Calculadora de Índice de Peligro de Incendio

## 1. Qué se hizo
- **Arquitectura**: Se creó una SPA en `src/index.html` que:
  - Consulta la API de Defensor JRG (`/v1/situation`) para obtener temperatura, humedad y velocidad del viento.
  - Normaliza los campos (`temperature|temp|t`, `humidity|hum|h`, `wind_speed|wind|w`).
  - Aplica la **Regla del 30** para determinar el nivel de riesgo.
  - Muestra un semáforo de riesgo (🟢, 🟡, 🔴) y los valores obtenidos.
  - Incluye un botón “Exportar reporte PDF” usando **jsPDF** (CDN).
- **Offline**: Se añadió un `sw.js` que:
  - Elimina cachés antiguos al instalar.
  - Permite que la herramienta funcione sin conexión mediante una estrategia *network‑first* para la API y caching de recursos estáticos.
- **UI/UX**: Tema oscuro, tipografía monoespaciada y estilo táctico acorde a la documentación.

## 2. Estado actual
- **Funcionalidad**: La calculadora consulta la API, procesa los datos y muestra el semáforo correctamente.
- **Offline**: El Service Worker guarda los recursos estáticos y la última respuesta de la API; la app se abre y muestra la última información cuando no hay conexión.
- **Exportación**: El botón PDF genera un reporte con los datos actuales y el nivel de riesgo.
- **Seguridad**: Se sanitizan los valores mostrados con `escapeHTML`.

## 3. Próximos pasos
1. **Notificaciones Push**: Implementar notificaciones cuando el riesgo cambie a *Peligro Extremo*.
2. **Histórico local**: Guardar las lecturas en `localStorage` para análisis de tendencias.
3. **Mejoras UX**:
   - Añadir un indicador de “Última actualización”.
   - Animaciones sutiles en el semáforo.
4. **Pruebas**:
   - Test unitarios con Jest para la lógica de la Regla del 30.
   - Test de integración con la API simulada.

## 4. Riesgos detectados
| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| **Cambios en la API** | Alto | Media | Normalizar los nombres de campo y usar un adaptador flexible. |
| **Pérdida de datos offline** | Medio | Baja | Cachear la última respuesta de la API y mostrar un mensaje de “Datos desactualizados”. |
| **Problemas de rendimiento** | Bajo | Media | Minimizar el tamaño de `index.html` y usar lazy‑load para jsPDF. |
| **Fallas de seguridad** | Alto | Baja | Sanitizar todas las entradas y usar HTTPS en la producción. |

---