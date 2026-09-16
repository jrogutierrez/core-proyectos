# Guía de diseño – Panadería Don Corrientes

## 1. Paleta de colores (HEX)
| Uso | Color | HEX |
|-----|-------|-----|
| Primario | Marrón pan | `#8B4513` |
| Secundario | Crema pastel | `#F5E1A4` |
| Accento | Naranja horno | `#D2691E` |
| Fondo | Blanco nieve | `#FFFFFF` |
| Texto | Gris oscuro | `#333333` |
| Link/CTA | Verde hoja | `#2E8B57` |

## 2. Tipografía
- **Principal:** `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (fallback local).  
- **Secundaria (decorativa):** `Georgia, "Times New Roman", Times, serif` para títulos de sección.

## 3. Breakpoints responsive
| Dispositivo | Min‑width |
|-------------|----------|
| Mobile | 320 px |
| Tablet | 768 px |
| Desktop | 1024 px |

## 4. Componentes UI
- **Botón CTA:** fondo `#2E8B57`, texto blanco, border‑radius 4 px, hover `#276749`.  
- **Tarjeta de producto:** borde fino `#E2E8F0`, sombra ligera, padding 1rem.  
- **Header sticky:** fondo `#FFFFFF`, sombra `0 2px 4px rgba(0,0,0,0.1)`.  
- **Footer:** fondo `#F5E1A4`, texto `#333333`.

## 5. SEO on‑page
- **Meta title:** “Panadería Don Corrientes – Pan artesanal en Corrientes, AR”.  
- **Meta description:** “Descubrí nuestros panes caseros, facturas, tortas y empanadas. Pedí delivery o visitanos en el centro de Corrientes.”  
- **Open Graph:** imagen destacada (`uploads/og-image.jpg`).  
- **Schema.org:** tipo `Bakery` con `name`, `address`, `telephone`, `url`, `image`.  

## 6. Schema.org (JSON‑LD) básico
```json
{
  "@context": "https://schema.org",
  "@type": "Bakery",
  "name": "Panadería Don Corrientes",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Av. San Martín 123",
    "addressLocality": "Corrientes",
    "addressRegion": "Corrientes",
    "postalCode": "3400",
    "addressCountry": "AR"
  },
  "telephone": "+54 9 341 1234567",
  "url": "https://panaderiadoncorrientes.com",
  "image": "https://panaderiadoncorrientes.com/uploads/logo.png",
  "servesCuisine": ["Pan artesanal", "Facturas", "Tortas", "Empanadas"]
}
```

## 7. Accesibilidad WCAG 2.1 AA
- **Contraste** ≥ 4.5:1 (ver tabla de colores).  
- **Enfoque visible**: outline `2px solid #2E8B57` en elementos interactivos.  
- **Aria‑labels** en botones y enlaces externos.  
- **Texto alternativo** en todas las imágenes (`alt` descriptivo).  
- **Orden lógico** del DOM y encabezados (`h1` → `h2` → `h3`).  