# Auditoría de Seguridad
## Hallazgos v4
- **Firebase** eliminado de la base de código.
- **CDN de DOMPurify** eliminado.
- No se utiliza la función `escapeHTML()` nativo; la sanitización de datos debe implementarse manualmente.
- Se identificó una **potencial vulnerabilidad XSS** en la entrada de usuario que no está sanitizada.
## Zonas Protegidas
- `src/components.js` (sin modificaciones en esta revisión)
## Zonas en Reparación
- `src/index.html` – necesita implementación de `escapeHTML()` o equivalente para evitar XSS.
