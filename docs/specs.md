# Especificaciones del proyecto – Panadería Don Corrientes

## 1. Introducción
Landing page para la panadería artesanal “Don Corrientes”. Debe ser informativa, atractiva y responsiva, con énfasis en SEO local y accesibilidad.

## 2. Alcance
- Presentación de la marca y su historia.  
- Catálogo visual de productos (pan casero, facturas, tortas, empanadas).  
- Información de local (dirección, horario, teléfono).  
- Botón de llamada a la acción para delivery (teléfono o WhatsApp).  
- Formulario de suscripción al newsletter (opcional).  

## 3. Requisitos funcionales
| # | Requisito |
|---|-----------|
| RF‑01 | Mostrar hero con foto del local y tagline. |
| RF‑02 | Listado de productos con foto, nombre y breve descripción. |
| RF‑03 | Sección “Cómo pedir” con botón “Pedido por Delivery” que abre enlace a WhatsApp. |
| RF‑04 | Información de contacto y mapa estático de Google Maps (embed). |
| RF‑05 | Footer con datos legales y redes sociales. |
| RF‑06 | SEO on‑page: meta title, description, Open Graph, schema.org `Bakery`. |
| RF‑07 | Cumplir WCAG 2.1 AA (contraste, foco visible, aria‑labels). |

## 4. Requisitos no funcionales
| # | Requisito |
|---|-----------|
| RNF���01 | Carga inicial < 2 s en conexión 3G. |
| RNF‑02 | Compatibilidad con navegadores modernos (Chrome, Firefox, Safari, Edge). |
| RNF‑03 | Responsive: mobile‑first, breakpoints 320 px, 768 px, 1024 px. |
| RNF‑04 | SEO local: palabras clave “panadería artesanal Corrientes”. |
| RNF‑05 | Accesibilidad: contraste ≥ 4.5:1, navegación por teclado. |
| RNF‑06 | Código estático (HTML + CSS) sin dependencias externas. |

## 5. Arquitectura de la información
- **Header** → logo + menú ancla.  
- **Hero** → imagen de fondo + título + CTA.  
- **Sobre nosotros** → breve historia.  
- **Productos** → grid de tarjetas.  
- **Cómo pedir** → pasos + botón delivery.  
- **Contacto** → formulario + mapa.  
- **Footer** → datos legales + redes.

## 6. Criterios de aceptación
- Todas las secciones aparecen correctamente en desktop y mobile.  
- El botón de delivery abre WhatsApp con número predefinido.  
- El sitio pasa la auditoría Lighthouse > 90 (Performance, SEO, Accessibility).  

## 7. Anexos
- Wireframes (por crear).  
- Paleta de colores y tipografía (ver `guia-diseno.md`).  
- Lista de imágenes a subir (`uploads/`).  