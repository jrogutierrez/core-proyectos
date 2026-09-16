# Arquitectura de seguridad – Observatorio Planetario

## 1. Principios de seguridad
- **Principio de menor privilegio:** Sólo lo necesario se expone al cliente.  
- **Defensa en profundidad:** CDN, HTTPS, CSP y validaciones en frontend.  
- **Privacidad por diseño:** No se almacena información sensible en el servidor.

## 2. Comunicación segura
- **HTTPS obligatorio** (certificado TLS en el host).  
- **CSP (Content Security Policy):**  
```http
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;
```

## 3. Autenticación y autorización
- No se requiere login para la landing.  
- Si en el futuro se agrega zona de admin, se usará autenticación basada en JWT con provider externo (Auth0, Netlify Identity).

## 4. Protección de formularios
- **reCAPTCHA v2/v3** opcional (carga vía CDN).  
- **Validaci��n de campos** en cliente y, si se usa un endpoint externo, ese servicio debe validar también.

## 5. Manejo de errores
- Mensajes genéricos al usuario (ej. “Algo salió mal, intente más tarde”).  
- Registro de errores en consola del navegador; opcional envío a Sentry (solo en producción).

## 6. Política de privacidad
- Declarar que los datos del formulario se usan únicamente para responder consultas y no se comparten con terceros.  
- Enlace a página de política en el footer.

## 7. Actualizaciones y parches
- Mantener actualizadas las librerías CDN (Tailwind, Alpine, reCAPTCHA).  
- Revisar periódicamente la CSP y los encabezados de seguridad.  