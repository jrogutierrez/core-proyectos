# Especificaciones del proyecto – Observatorio Planetario

## 1. Visión del proyecto
Crear una landing page atractiva que presente el observatorio, sus instalaciones y permita a los visitantes explorar imágenes de planetas, fomentando el interés por la astronomía.

## 2. Alcance
- Página única (single‑page) responsiva.
- Sección de bienvenida, galería de planetas, información del observatorio y formulario de contacto.
- No incluye backend ni sistema de reservas.

## 3. Requisitos funcionales
| ID | Descripción |
|----|-------------|
| RF‑01 | Mostrar hero con título, subtítulo y botón “Conocer más”. |
| RF‑02 | Galería de imágenes de los planetas con efecto hover y lightbox. |
| RF‑03 | Sección “Sobre nosotros” con texto y foto del observatorio. |
| RF‑04 | Formulario de contacto (nombre, email, mensaje) con validación básica. |
| RF‑05 | Footer con enlaces a redes sociales y datos de contacto. |

## 4. Requisitos no funcionales
- **Rendimiento:** Carga completa < 2 s en conexión 3G.
- **Accesibilidad:** WCAG 2.1 AA.
- **SEO:** Metadatos, Open Graph, schema.org `Organization`.
- **Responsive:** Breakpoints 320 px, 768 px, 1024 px, 1440 px.
- **Compatibilidad:** Navegadores modernos (Chrome, Firefox, Safari, Edge).

## 5. Casos de uso
1. **Visitar la landing:** El usuario abre la URL y ve la página completa.
2. **Explorar planetas:** Hace click en una miniatura y abre la imagen en grande.
3. **Contactar:** Completa y envía el formulario; recibe mensaje de confirmación.

## 6. Prioridades
| Prioridad | Ítem |
|-----------|------|
| Alta | Hero, galería, formulario. |
| Media | SEO, accesibilidad, optimización de imágenes. |
| Baja | Animaciones avanzadas, integración con redes sociales. |

## 7. Entregables
- Documentación completa (estos archivos).
- Mockup visual (en `uploads/`).
- Código HTML/CSS/JS en `src/` (será generado por el Obrero).  