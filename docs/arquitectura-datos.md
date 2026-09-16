# Arquitectura de datos – Panadería Don Corrientes

## 1. Modelo de datos conceptual
| Entidad | Descripción |
|---------|-------------|
| **Producto** | Pan, factura, torta, empanada. |
| **ImagenProducto** | URL de la foto (WebP/JPEG). |
| **Contacto** | Dirección, teléfono, email, horario. |
| **RedSocial** | Nombre y URL de la red (Facebook, Instagram). |
| **DeliveryInfo** | Número WhatsApp, mensaje predefinido. |

## 2. Esquema JSON‑LD (Bakery)
*(ver `guia-diseno.md` para detalle)*

## 3. Datos estáticos
Los datos se entregarán como **archivos JSON** dentro de `src/data/` (será creado por el Obrero). Ejemplo:

```json
{
  "productos": [
    {
      "id": "pan-casero",
      "nombre": "Pan casero",
      "descripcion": "Pan artesanal horneado diariamente.",
      "imagen": "/uploads/pan-casero.webp"
    },
    {
      "id": "factura-chocolate",
      "nombre": "Factura de chocolate",
      "descripcion": "Deliciosa factura con relleno de chocolate.",
      "imagen": "/uploads/factura-chocolate.webp"
    }
  ],
  "contacto": {
    "direccion": "Av. San Martín 123, Corrientes, AR",
    "telefono": "+54 9 341 1234567",
    "email": "info@panaderiadoncorrientes.com",
    "horario": "Lun‑Vie 07:00‑20:00, Sáb 08:00‑14:00"
  },
  "delivery": {
    "whatsapp": "+5493411234567",
    "mensaje": "¡Hola! Quiero hacer un pedido de..."
  },
  "redes": [
    { "nombre": "Facebook", "url": "https://facebook.com/panaderiadoncorrientes" },
    { "nombre": "Instagram", "url": "https://instagram.com/panaderiadoncorrientes" }
  ]
}
```

## 4. Persistencia
Todo es estático; no hay base de datos. Los archivos JSON serán incluidos en el build y servidos como recursos estáticos.

## 5. Seguridad de datos
- Los JSON son de solo lectura.  
- No se exponen datos sensibles (no hay credenciales).  

## 6. Versionado
- Cada cambio de contenido se versionará en Git (commit con mensaje descriptivo).  

## 7. Consideraciones de internacionalización
- Texto en español (es‑AR).  
- Posible extensión a inglés futuro mediante archivos `i18n/*.json`.  