# Referencia del proyecto – Observatorio Planetario

## 1. Objetivos
- Presentar el observatorio de forma atractiva y educativa.
- Mostrar imágenes de los planetas con alta calidad.
- Facilitar el contacto de usuarios interesados.

## 2. Stack tecnológico elegido
- **HTML5** + **Tailwind CSS** (CDN) para estilos rápidos y responsivos.
- **Alpine.js** (CDN) para interactividad ligera (lightbox, toggle de menú).
- **Netlify** (opcional) para despliegue estático.

## 3. Estado actual
- Documentación generada (10 archivos).
- No hay código fuente aún; el Obrero iniciará con la estructura base.

## 4. Arquitectura de carpetas
```
/
│─ README.md
│
├─ docs/
│   ├─ specs.md
│   ├─ referencia.md
│   ├─ guia-diseno.md
│   ├─ arquitectura-datos.md
│   ├─ arquitectura-seguridad.md
│   ├─ stack-tecnologico.md
│   ├─ analisis-riesgos.md
│   ├─ plan-desarrollo.md
│   └─ COMO-USAR-ESTE-PROYECTO.md
│
├─ src/
│   └─ (próximamente index.html, assets, etc.)
│
└─ uploads/
    └─ (imágenes de planetas, logo, etc.)
```

## 5. Variables clave
- `PROJECT_NAME = "Observatorio Planetario"`
- `PRIMARY_COLOR = "#1e3a8a"` (azul oscuro)
- `FONT_FAMILY = "Inter, system-ui, sans-serif"`

## 6. Dependencias externas (CDN)
- Tailwind CSS (`https://cdn.tailwindcss.com`)
- Alpine.js (`https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js`)

## 7. Próximos pasos
- **Etapa 1:** Setup de carpetas y archivos base (README + docs).  
- **Etapa 2:** Implementar HTML estático con Tailwind y Alpine.  
- **Etapa 3:** Optimizar imágenes y pruebas de accesibilidad.  