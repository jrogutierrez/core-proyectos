# Auditoría de Seguridad, SEO y Accesibilidad – Panadería Don Corrientes

## 1. CONTEXTO
- **Estructura actual del proyecto**: la carpeta `docs/` contiene toda la documentación (specs, referencia, guía de diseño, README, etc.). La carpeta `src/` está vacía; no existe `src/index.html` ni hoja de estilos asociada.  
- **Objetivo del auditor**: revisar el proyecto completo para detectar vulnerabilidades XSS en el futuro formulario de suscripción, identificar meta‑tags SEO faltantes o incompletos, evaluar problemas de accesibilidad según WCAG 2.1 AA y comprobar desviaciones respecto a los requisitos descritos en `docs/specs.md` y `docs/guia-diseno.md`.  
- **Estado de los artefactos**:  
  - `docs/specs.md` – completo y define requisitos funcionales y no funcionales.  
  - `docs/referencia.md` – completo, indica stack y roadmap.  
  - `docs/guia-diseno.md` – completo, incluye paleta, tipografía, componentes UI, SEO y accesibilidad.  
  - `src/` – vacío (no hay implementación).  
  - `README.md` – describe el proyecto y la acción esperada (“ARRANCAR PROYECTO”).  

## 2. TAREA
Realizar una auditoría preliminar que cubra los cuatro puntos solicitados:

1. **Vulnerabilidades XSS potenciales** en el formulario de suscripción al newsletter.  
2. **Meta‑tags SEO** que estén ausentes o incompletos.  
3. **Problemas de accesibilidad** respecto a WCAG 2.1 AA.  
4. **Desviaciones del código** respecto a las especificaciones originales (en caso de existir código).  

## 3. DIRECTIVAS
1. **Revisión de `src/index.html`** (actualmente inexistente).  
   - Verificar si el archivo está presente; si no, registrar su ausencia como hallazgo.  
2. **Comprobación de formulario de suscripción**:  
   - Analizar los atributos esperados (`method`, `action`, `type`, `required`, `pattern`, `aria-label`, `autocomplete`, `novalidate`).  
   - Evaluar la necesidad de sanitización del lado cliente y la dependencia de un backend externo.  
3. **Inventario de meta‑tags SEO**: comparar los requeridos en la guía de diseño (`title`, `description`, Open Graph, Twitter Card, `canonical`, `robots`, `schema.org` JSON‑LD) con los presentes en el HTML (si existiera).  
4. **Auditoría de accesibilidad**:  
   - Contraste de colores (según paleta).  
   - Uso de atributos `lang`, `alt`, `aria-*`, orden semántico de encabezados (`h1` → `h2` → …).  
   - Enfoque visible (`outline`), navegación por teclado y tamaños de fuente.  
5. **Comparación contra specs**: validar que cada requisito funcional (RF‑01 a RF‑07) y no funcional (RNF‑01 a RNF‑06) esté cubierto por la implementación (o su ausencia).  
6. **Documentar hallazgos** con severidad: **CRÍTICA**, **ALTA**, **MEDIA**, **BAJA**.  
7. **Actualizar `docs/auditoria.md`** con los resultados siguiendo el formato de 7 secciones (este documento).  

## 4. ZONAS PROTEGIDAS
Los siguientes archivos y directorios **NO deben modificarse** sin autorización explícita del Analista/Capa 8:

- `docs/specs.md`  
- `docs/referencia.md`  
- `docs/guia-diseno.md`  
- `README.md`  
- Cualquier otro archivo bajo `docs/` que no sea parte de la auditoría directa (por ejemplo, `docs/arquitectura-datos.md`, `docs/arquitectura-seguridad.md`, etc.).  

## 5. PROHIBICIONES
- **NO** crear o modificar archivos fuera de la estructura obligatoria (`src/`, `docs/`, `informes/`, `uploads/`, `README.md`).  
- **NO** introducir dependencias externas (CDN, frameworks CSS/JS, Firebase, etc.).  
- **NO** escribir código que haga llamadas a servicios externos sin que exista un backend definido.  
- **NO** sobrescribir contenido de los documentos protegidos listados en la sección anterior.  

## 6. ENTREGABLES
- **Archivo actualizado**: `docs/auditoria.md` (el presente documento) con los hallazgos organizados por categoría y severidad, además de la definición de zonas protegidas y en reparación.  
- No se generan otros archivos en esta iteración.  

## 7. RECORDATORIOS
- **Modo offline / anti‑cache**: el proyecto será desplegado en GitHub Pages; todos los recursos deben estar incluidos localmente (imágenes en `uploads/`, CSS inline o en `src/styles.css`).  
- **Variables de entorno**: `WHATSAPP_NUMBER` debe estar disponible en el entorno de producción; no se debe hardcodear en HTML.  
- **Validación**: antes de que el Obrero implemente `src/index.html`, ejecutar pruebas de Lighthouse (Performance > 90, SEO > 90, Accessibility > 90).  
- **Seguridad**: aunque la página sea estática, cualquier formulario que envíe datos a un endpoint externo debe usar HTTPS y sanitizar la entrada en el servidor receptor.  

---

## Hallazgos detallados

### 1️⃣ Vulnerabilidades XSS potenciales
| Hallazgo | Severidad | Comentario | Recomendación |
|----------|-----------|------------|---------------|
| Ausencia de formulario de suscripción | **ALTA** | No existe formulario, por lo que no hay vectores XSS activos, pero al implementarlo existe riesgo de inyección si se omiten validaciones. | Implementar formulario con: `<form method="POST" action="https://api.ejemplo.com/subscribe" novalidate autocomplete="off">`, usar `type="email"` y `required`, validar con expresión regular (`pattern`), y sanitizar en el backend. Añadir `aria-label="Suscripción al newsletter"` y `role="form"`. |
| Falta de escape en atributos `value` (potencial) | **MEDIA** | Si se reutilizan valores enviados por el usuario (p. ej., para re‑poblar el campo tras error) sin escape, podría generar XSS reflejado. | Nunca insertar datos del usuario directamente en HTML; usar `textContent` o plantillas seguras del lado del servidor. |

### 2️⃣ Meta‑tags SEO faltantes o incompletos
| Hallazgo | Severidad | Comentario | Recomendación |
|----------|-----------|------------|---------------|
| No hay archivo HTML → meta‑tags no pueden evaluarse | **CRÍTICA** | La ausencia de `index.html` impide la verificación de todos los meta‑tags requeridos (title, description, Open Graph, Twitter Card, `canonical`, `robots`, `schema.org`). | Crear `src/index.html` con los meta‑tags especificados en `guia-diseno.md`: <title>, <meta name="description">, Open Graph (`og:title`, `og:description`, `og:image`, `og:url`), Twitter Card, `<link rel="canonical">`, `<meta name="robots" content="index,follow">`, y JSON‑LD schema `Bakery`. |
| Falta de `hreflang` para idioma español | **MEDIA** | No se indica el idioma objetivo, lo que puede afectar SEO local. | Añadir `<link rel="alternate" hreflang="es" href="https://panaderiadoncorrientes.com/">`. |
| No se incluye `viewport` meta tag | **ALTA** | Sin `<meta name="viewport" content="width=device-width, initial-scale=1">` la página no será responsive en móviles. | Incluirlo en `<head>`. |

### 3️⃣ Problemas de accesibilidad (WCAG 2.1 AA)
| Hallazgo | Severidad | Comentario | Recomendación |
|----------|-----------|------------|---------------|
| No hay contenido HTML → no se pueden validar contrastes, foco, ARIA, alt‑text | **CRÍTICA** | La ausencia de markup impide cualquier validación de accesibilidad. | Implementar la estructura HTML siguiendo la guía de diseño: usar `lang="es"` en `<html>`, `alt` descriptivo en todas las imágenes, `role` y `aria-label` en botones/links, encabezados jerárquicos correctos (`h1` para el nombre de la panadería, `h2` para secciones). |
| Falta de foco visible en elementos interactivos | **ALTA** | Sin estilos de `outline` los usuarios de teclado no podrán identificar el foco. | Añadir CSS: `a:focus, button:focus { outline: 2px solid #2E8B57; outline-offset: 2px; }`. |
| No se ha definido un esquema de colores con contraste ≥ 4.5:1 | **ALTA** | La paleta propuesta sí cumple contraste, pero sin CSS aplicado no se garantiza. | Aplicar colores de la guía (`#8B4513` sobre `#FFFFFF` para texto, `#2E8B57` sobre `#FFFFFF` para CTA) y validar con herramienta de contraste. |
| Falta de `lang` y `dir` en `<html>` | **MEDIA** | Afecta lectores de pantalla. | Añadir `lang="es"` y, si fuera necesario, `dir="ltr"`. |
| No hay atributos `aria-live` en mensajes de error del formulario | **MEDIA** | Los usuarios de lectores de pantalla no recibirán feedback. | Incluir `<div aria-live="polite" class="error-message"></div>` dentro del formulario. |

### 4️⃣ Desviaciones del código respecto a las specs originales
| Requisito | Estado | Comentario | Acción |
|-----------|--------|------------|--------|
| **RF‑01** (hero) | **NO IMPLEMENTADO** | No hay `index.html`. | Crear hero con imagen de fondo, título y CTA. |
| **RF‑02** (listado de productos) | **NO IMPLEMENTADO** | Falta la grid de tarjetas. | Implementar sección `Productos` con tarjetas responsivas. |
| **RF‑03** (botón delivery) | **NO IMPLEMENTADO** | Falta botón que abra WhatsApp. | Añadir `<a href="https://wa.me/5493411234567" class="cta">Pedido por Delivery</a>`. |
| **RF‑04** (mapa) | **NO IMPLEMENTADO** | No hay iframe de Google Maps. | Insertar `<iframe src="https://www.google.com/maps/embed?...">`. |
| **RF‑05** (footer) | **NO IMPLEMENTADO** | Falta footer con datos legales y redes. | Crear footer siguiendo diseño. |
| **RF‑06** (SEO on‑page) | **NO IMPLEMENTADO** | Meta‑tags ausentes (ver tabla de SEO). | Ver recomendaciones SEO. |
| **RF‑07** (WCAG) | **NO IMPLEMENTADO** | No hay markup para validar accesibilidad. | Ver recomendaciones de accesibilidad. |
| **RNF‑01** (carga < 2 s) | **NO EVALUABLE** | Sin assets no se puede medir. | Optimizar imágenes (WebP) y CSS inline. |
| **RNF‑02** (compatibilidad) | **NO EVALUABLE** | No hay código. | Usar HTML5 y CSS3 estándar. |
| **RNF‑03** (responsive) | **NO IMPLEMENTADO** | Falta media queries. | Implementar breakpoints 320 px, 768 px, 1024 px según guía. |
| **RNF‑04** (SEO local) | **NO IMPLEMENTADO** | Falta contenido con palabras clave. | Incluir texto “panadería artesanal Corrientes” en headings y meta‑description. |
| **RNF‑05** (accesibilidad) | **NO IMPLEMENTADO** | Ver sección de accesibilidad. | Aplicar recomendaciones. |
| **RNF‑06** (código estático) | **EN REPARACIÓN** | No hay archivos. | Crear `index.html` y `styles.css` sin dependencias externas. |

---

### Resumen de severidades
- **CRÍTICA**: Ausencia total de `src/index.html` (impide validar SEO, accesibilidad y funcionalidad).  
- **ALTA**: Falta de meta‑tags esenciales (viewport, Open Graph), ausencia de foco visible, contraste no garantizado, formulario sin validaciones.  
- **MEDIA**: Falta de `lang`, `hreflang`, `aria-live`, potencial XSS por falta de sanitización.  
- **BAJA**: Ningún hallazgo de bajo riesgo detectado (todo está ausente, no mal implementado).  

---  

**Próximos pasos**  
1. El Obrero debe crear `src/index.html` y `src/styles.css` siguiendo las recomendaciones de esta auditoría.  
2. Validar con Lighthouse después de la implementación.  
3. Re‑ejecutar esta auditoría una vez que exista código para confirmar la corrección de los hallazgos.  
