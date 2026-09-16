# Guía de diseño – Observatorio Planetario

## 1. Paleta de colores (HEX)
| Uso | Color |
|-----|-------|
| Primario | #1e3a8a (azul noche) |
| Secundario | #f59e0b (ámbar) |
| Fondo | #f3f4f6 (gris claro) |
| Texto principal | #111827 (gris casi negro) |
| Texto secundario | #6b7280 (gris medio) |
| Accento | #10b981 (verde) |

## 2. Tipografía
- **Fuente principal:** `Inter` (cargada vía Google Fonts).  
- **Fallback local:** `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
</style>
```

## 3. Breakpoints responsive (Tailwind)
- **sm:** 640 px  
- **md:** 768 px  
- **lg:** 1024 px  
- **xl:** 1280 px  
- **2xl:** 1536 px  

## 4. Componentes UI
| Componente | Descripción | Clase Tailwind sugerida |
|------------|-------------|--------------------------|
| Botón primario | Acción principal (ej. “Conocer más”) | `bg-primary text-white font-semibold py-2 px-4 rounded hover:bg-primary/90` |
| Card galería | Miniatura de planeta | `rounded overflow-hidden shadow-lg hover:shadow-2xl transition-shadow` |
| Modal Lightbox | Visualizador de imagen grande | `fixed inset-0 bg-black/70 flex items-center justify-center z-50` |
| Formulario | Inputs y botón enviar | `border border-gray-300 rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-primary` |

## 5. SEO on‑page
- **Title:** “Observatorio Planetario – Descubre los planetas”  
- **Meta description:** “Landing del Observatorio Planetario con imágenes de alta calidad de los planetas del Sistema Solar. Aprende, explora y contáctanos.”  
- **Open Graph:** `og:title`, `og:description`, `og:image` (imagen hero).  
- **Schema.org:** Tipo `Organization` con `name`, `url`, `logo`, `contactPoint`.

## 6. Schema.org (JSON‑LD)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Observatorio Planetario",
  "url": "https://tusitio.com",
  "logo": "https://tusitio.com/uploads/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-555-1234",
    "contactType": "Customer Service",
    "email": "info@observatorioplanetario.com"
  }
}
```

## 7. Accesibilidad (WCAG 2.1 AA)
- **Contraste:** Cumplir al menos 4.5:1 (ver tabla de colores).  
- **Alt text:** Todas las imágenes de planetas con descripción (`alt="Imagen de Marte"`).  
- **Navegación por teclado:** Enlaces y botones accesibles con `tabindex`.  
- **ARIA:** Lightbox con `role="dialog"` y `aria-modal="true"`.  
- **Tamaño de fuente:** Mínimo 16 px en cuerpo, escalable.  