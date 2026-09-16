**Evaluación de la Arquitectura – Panadería Don Corrientes**  

**1. Stack y VPS**  
- El stack estático (HTML5 + CSS3) consume < 5 MB de RAM y < 0.5 % de CPU en tráfico moderado.  
- Un VPS de $8/mes (1 GB RAM, 1 vCPU) es más que suficiente.  
- Se recomienda usar Nginx/Apache con gzip y cache‑control para optimizar el ancho de banda.

**2. Estructura de carpetas**  
- `docs/` → documentación técnica.  
- `src/` → código fuente (HTML/CSS).  
- `uploads/` → activos (imágenes, SVG, favicon).  
- Limpia y coherente; respeta la convención “Código → src/ | Docs → docs/ | Subidas → uploads/”.

**3. Riesgos de escalabilidad**  
- Sitio estático → escalar horizontalmente es trivial (copia de repositorio).  
- Riesgo mínimo: carga de imágenes grandes. Se recomienda compresión WebP + lazy‑load.  
- Google Maps embed puede añadir latencia; usar un iframe con `loading="lazy"` mitigará el impacto.

**4. Seguridad**  
- HTTPS: obligatorio (GitHub Pages/NGINX con Let’s Encrypt).  
- No base de datos → riesgo de inyección SQL inexistente.  
- Recomendaciones:  
  - Añadir headers de seguridad: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`.  
  - Validar número de WhatsApp en `WHATSAPP_NUMBER` (regex).  
  - Evitar `iframe` sin sandbox.  
  - Desactivar `X-Powered-By`.  

**Conclusiones**  
- Stack y VPS son adecuados.  
- Carpeta limpia y bien estructurada.  
- Escalabilidad no representa riesgo crítico.  
- Seguridad es suficiente con las medidas recomendadas.  

---  

**Acciones sugeridas**  
- Implementar gzip y cache‑control en el servidor.  
- Añadir CSP y otros headers de seguridad.  
- Optimizar imágenes y usar lazy‑load.  
- Documentar la configuración del VPS en `docs/infra.md` (opcional).  

**Estado Actual**: Se ha generado el informe y no se han modificado archivos protegidos.  

---  

**Próximo paso**: El Obrero puede proceder a crear el código en `src/` siguiendo la guía de diseño y los requisitos funcionales.  
