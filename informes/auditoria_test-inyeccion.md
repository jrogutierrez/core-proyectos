# Informe de Auditoría – Carpeta `uploads/test-inyeccion`

## 1. Resumen Ejecutivo
Se encontraron varias vulnerabilidades críticas relacionadas con la gestión de credenciales y la ausencia de mecanismos de protección de contraseñas. La configuración del sistema también muestra prácticas que pueden facilitar ataques de enumeración y fuerza bruta.

## 2. Detalle de Vulnerabilidades

| ID | Severidad | Descripción | Impacto | Recomendación |
|----|-----------|-------------|---------|----------------|
| **VULN‑001** | **CRÍTICA** | **Credenciales hard‑coded** en `modulo_auth.js` (`admin` / `segura123`). | Permite acceso total al portal sin necesidad de credenciales válidas. | Eliminar credenciales estáticas. Implementar autenticación basada en base de datos y hashes seguros (bcrypt, Argon2). |
| **VULN‑002** | **ALTA** | **Sin hashing de contraseñas** – la función `validarUsuario` compara texto plano. | Contraseñas pueden ser extraídas fácilmente si el código se expone. | Aplicar hashing con sal y coste adecuado (p.ej., `bcrypt.hash`). |
| **VULN‑003** | **ALTA** | **Falta de límite de intentos** – la función no registra ni bloquea intentos fallidos. | Facilita ataques de fuerza bruta. | Implementar throttling / bloqueo temporal después de N intentos fallidos. |
| **VULN‑004** | **MEDIA** | **Configuración estática en `config_sistema.json`** con `environment: "production"` pero sin variables de entorno para datos sensibles. | Exposición de información de despliegue y posible uso de valores por defecto. | Migrar valores sensibles (p.ej., puertos, flags) a variables de entorno y validar su presencia en tiempo de ejecución. |
| **VULN‑005** | **BAJA** | **Documentación que sugiere mejoras de seguridad** (`TODO: Conectar con hash bcrypt`) sin implementación real. | Indica que el equipo es consciente del problema pero no lo ha resuelto. | Priorizar la tarea marcada como TODO y cerrar la brecha antes de la siguiente release. |

## 3. Recomendaciones Generales

1. **Reescribir el módulo de autenticación**:  
   - Utilizar una base de datos segura para almacenar usuarios.  
   - Aplicar hashing con `bcrypt` (o algoritmo equivalente).  
   - Implementar gestión de sesiones (JWT, cookies HttpOnly, SameSite).  

2. **Gestión de configuración**:  
   - Adoptar el patrón **12‑factor**: mover valores sensibles a variables de entorno.  
   - Añadir validación de configuración al iniciar la aplicación (p.ej., `dotenv` con esquema).  

3. **Hardening del entorno**:  
   - Habilitar **rate limiting** a nivel de API (p.ej., `express-rate-limit`).  
   - Registrar y monitorear intentos de autenticación fallidos.  

4. **Pruebas de seguridad**:  
   - Ejecutar escáneres de vulnerabilidades (OWASP ZAP, npm audit).  
   - Incluir pruebas unitarias que verifiquen que la contraseña nunca se almacena ni se compara en texto plano.  

## 4. Conclusión
La carpeta contiene vulnerabilidades críticas que deben ser remediadas antes de cualquier despliegue a producción. La prioridad inmediata es eliminar las credenciales hard‑coded y aplicar hashing de contraseñas. Posteriormente, se deben reforzar la configuración y los controles de acceso.

---

*Informe generado automáticamente por el auditor de seguridad del ecosistema C.O.R.E.*  