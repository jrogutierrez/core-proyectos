# Arquitectura de seguridad – Panadería Don Corrientes

## 1. Principios de seguridad
- **Minimizar superficie de ataque**: sitio estático sin backend.  
- **Confidencialidad**: no se manejan datos personales sensibles.  
- **Integridad**: contenido servido vía HTTPS (GitHub Pages).  

## 2. Autenticación y autorización
- No hay login de usuarios.  
- El único punto de contacto externo es el enlace a WhatsApp, que abre la app del cliente.

## 3. Protección de recursos
- **HTTPS obligatorio** (GitHub Pages fuerza TLS).  
- **CSP (Content‑Security‑Policy)** básica en `<meta http‑equiv="Content-Security-Policy">` para limitar scripts a `self` y `https://www.google.com` (mapa).  
- **X‑Content‑Type‑Options: nosniff** y **X‑Frame‑Options: SAMEORIGIN** configurados por el servidor estático.

## 4. Gestión de vulnerabilidades
| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Inyección de código en URL | Medio | Sanitizar parámetros (aunque no hay parámetros). |
| Clickjacking | Bajo | X‑Frame‑Options SAMEORIGIN. |
| Fugas de datos de contacto | Bajo | Mostrar solo información pública (teléfono, email). |

## 5. Seguridad de imágenes
- Servir imágenes en formato WebP con fallback JPEG.  
- No permitir carga de archivos por usuarios externos.

## 6. Monitoreo y logs
- No hay backend, por lo que no se generan logs.  
- Se pueden usar herramientas externas (Google Analytics) respetando privacidad (opcional).

## 7. Cumplimiento
- Cumple con la normativa local de datos personales (solo datos públicos).  
- WCAG 2.1 AA para accesibilidad.  