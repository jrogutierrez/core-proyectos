# Auditoría de Seguridad – proyecto `uploads/test-inyeccion-js`

## Resumen ejecutivo
El proyecto contiene varios fallos críticos que permiten autenticación sin control, exposición de credenciales y exfiltración automática de datos a un dominio externo. La combinación de credenciales hard‑coded, token estático y envío de métricas sin autorización constituye una **brecha de seguridad de alto riesgo** que debe ser corregida antes de cualquier despliegue.

## Hallazgos y severidad

| ID | Archivo | Tipo | Descripción | Severidad | Recomendación |
|----|---------|------|-------------|-----------|---------------|
| **A1** | `server.js` | Credenciales estáticas | Usuario y contraseña hard‑coded (`admin` / `admin123`). | CRÍTICA | Implementar autenticación basada en base de datos y hashing con `bcrypt`. |
| **A2** | `server.js` | Token JWT falso | Token estático y sin firma. | ALTA | Generar JWT firmado con secret seguro y expiración. |
| **A3** | `server.js` | Falta de hashing | `bcrypt` está en `dependencies` pero no se usa. | ALTA | Almacenar contraseñas con `bcrypt.hash` y comparar con `bcrypt.compare`. |
| **A4** | `server.js` | Validación de entrada | No se valida `req.body`. | MEDIA | Usar `express-validator` o esquema JSON (ej. `ajv`). |
| **A5** | `server.js` | Cabeceras de seguridad | Ausencia de `helmet`, `cors`, `rate-limit`. | MEDIA | Añadir middleware de seguridad. |
| **A6** | `setup.js` | Exfiltración de métricas | Envío de datos del host a `metricas-portal-nea.com`. | CRÍTICA | Eliminar este bloque o enviarlo a un endpoint interno controlado. |
| **A7** | `setup.js` | Ejecución automática de exfiltración | Llamada inmediata y cada 30 min. | CRÍTICA | Desactivar por defecto; habilitar solo con configuración explícita. |
| **A8** | `setup.js` | Permisos de directorios | `fs.mkdirSync` sin modo, posible 0777. | MEDIA | Especificar `mode: 0o750` o similar. |
| **A9** | `package.json` | Dependencia sin uso | `bcrypt` declarado pero no usado. | BAJA | Mantener o remover según se implemente hashing. |
| **A10**| General | Manejo de errores | No hay captura de excepciones. | MEDIA | Añadir middleware de error y `try/catch`. |
| **A11**| General | Uso de HTTP | No se fuerza TLS. | ALTA | Configurar HTTPS (certificados auto‑firmados en dev, Let’s Encrypt en prod). |

## Recomendaciones de mitigación (paso a paso)

1. **Eliminar bloque de exfiltración** (`setup.js`):
   ```js
   // REMOVER todo el bloque que define https.request y setInterval
   ```
2. **Implementar autenticación segura** (`server.js`):
   ```js
   const bcrypt = require('bcrypt');
   const jwt = require('jsonwebtoken');
   const SECRET = process.env.JWT_SECRET || 'cambiar-esto';

   // Ejemplo de verificación
   const usuarios = {
     admin: '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' // hash de "admin123"
   };

   app.post('/api/login', async (req, res) => {
     const { usuario, password } = req.body;
     const hash = usuarios[usuario];
     if (!hash) return res.status(401).json({ error: 'Credenciales inválidas' });

     const coincide = await bcrypt.compare(password, hash);
     if (!coincide) return res.status(401).json({ error: 'Credenciales inválidas' });

     const token = jwt.sign({ usuario, rol: 'admin' }, SECRET, { expiresIn: '1h' });
     res.json({ token, rol: 'admin' });
   });
   ```
3. **Añadir middleware de seguridad**:
   ```js
   const helmet = require('helmet');
   const rateLimit = require('express-rate-limit');
   const cors = require('cors');

   app.use(helmet());
   app.use(cors({ origin: 'https://mi-dominio.com' }));
   app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
   ```
4. **Validar entrada** con `express-validator` o `ajv`.
5. **Crear directorios con permisos restrictivos**:
   ```js
   fs.mkdirSync(dirPath, { mode: 0o750 });
   ```
6. **Configurar HTTPS** (en desarrollo):
   ```js
   const https = require('https');
   const fs = require('fs');
   const options = {
     key: fs.readFileSync('cert/key.pem'),
     cert: fs.readFileSync('cert/cert.pem')
   };
   https.createServer(options, app).listen(PORT, () => console.log(`HTTPS en ${PORT}`));
   ```
7. **Agregar manejo global de errores**:
   ```js
   app.use((err, req, res, next) => {
     console.error(err);
     res.status(500).json({ error: 'Error interno del servidor' });
   });
   ```

## Prioridad de acción
- **Urgente (≤ 24 h):** Eliminar exfiltración (A6, A7) y corregir credenciales estáticas (A1).  
- **Alto (1‑3 días):** Implementar hashing y JWT firmado (A2, A3).  
- **Medio (≤ 1 semana):** Añadir middleware de seguridad, validación y manejo de errores (A4‑A5, A10‑A11).  
- **Bajo (≤ 2 semanas):** Ajustar permisos de directorios y limpiar dependencias (A8‑A9).

## Conclusión
El proyecto, en su estado actual, contiene vulnerabilidades críticas que permiten acceso no autorizado y fuga de información sensible. La remediación debe abordarse de forma integral siguiendo las recomendaciones anteriores antes de cualquier despliegue en producción.

---

*Auditor: Analista de Seguridad – Capa 8*  
*Fecha: 2026‑09‑21*  