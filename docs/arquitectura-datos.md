# Arquitectura de datos – Observatorio Planetario

## 1. Modelo de datos conceptual
| Entidad | Atributos |
|---------|-----------|
| **Planeta** | id, nombre, descripción, url_imagen, alt_text |
| **Contacto** | id, nombre, email, mensaje, fecha_envio |
| **Sección** | id, slug, título, contenido_html |

## 2. Fuente de datos
- **Imágenes de planetas:** Almacenadas en `uploads/` (formato WebP/AVIF).  
- **Contenido estático:** Texto de secciones guardado en archivos markdown dentro de `src/content/` (será creado por el Obrero).  

## 3. Flujo de datos
1. El navegador carga `index.html`.  
2. Alpine.js lee un JSON estático (`data/planetas.json`) para poblar la galería.  
3. El formulario envía datos a un endpoint externo (por ejemplo Formspree) – no se persiste en backend en esta fase.

## 4. Esquema JSON de ejemplo (planetas)
```json
[
  {
    "id": 1,
    "nombre": "Mercurio",
    "descripcion": "El planeta más cercano al Sol.",
    "url_imagen": "/uploads/mercurio.webp",
    "alt_text": "Imagen de Mercurio"
  },
  {
    "id": 2,
    "nombre": "Venus",
    "descripcion": "El planeta más caliente.",
    "url_imagen": "/uploads/venus.webp",
    "alt_text": "Imagen de Venus"
  }
  // ... resto de planetas
]
```

## 5. Persistencia
- No hay base de datos en esta versión.  
- Los datos del formulario pueden enviarse a un servicio de terceros (Formspree, Getform, etc.).

## 6. Seguridad de datos
- **CORS:** Solo se permite cargar recursos desde el mismo dominio.  
- **Validación:** Frontend valida campos obligatorios y formato de email antes de enviar.

## 7. Versionado
- Cada cambio de contenido se versiona mediante Git (commit por cada actualización de `uploads/` o `data/`).  