# Stack tecnológico – Observatorio Planetario

## 1. Frontend
- **HTML5** – estructura semántica.  
- **Tailwind CSS (CDN)** – estilos rápidos y responsivos.  
- **Alpine.js (CDN)** – interactividad ligera (lightbox, toggle menú).  
- **Google Fonts (Inter)** – tipografía legible.

## 2. Backend (opcional)
- No se requiere backend para la versión inicial.  
- Si se necesita procesamiento de formularios, se usará **Formspree** o **Getform** (servicio sin código).

## 3. Infraestructura
- **Netlify** o **Vercel** – hosting estático con HTTPS automático.  
- **GitHub** – repositorio de código fuente.

## 4. Herramientas de desarrollo
- **VS Code** – editor.  
- **Prettier** – formato (solo para el Obrero cuando genere código).  
- **ESLint** – linting (opcional).  

## 5. Justificación de elecciones
| Tecnologías | Por qué |
|-------------|----------|
| Tailwind (CDN) | Permite crear UI sin configuración build, ideal para preview rápido. |
| Alpine.js | Añade interactividad sin peso de frameworks pesados. |
| Netlify | Deploy en segundos, HTTPS gratis, sin servidor. |
| Formspree | Solución sin backend para recibir contactos. |
| Google Fonts (Inter) | Legibilidad y buena renderización. |

## 6. Gestión de dependencias
- Todas las dependencias se cargan vía CDN, por lo que no hay `package.json` en esta fase.  
- Si el proyecto evoluciona a SPA, se migrará a npm + Vite.

## 7. Roadmap tecnológico
1. **Fase 1:** Landing estática con Tailwind + Alpine.  
2. **Fase 2:** Integrar Formspree, reCAPTCHA.  
3. **Fase 3:** Añadir sección de blog usando Markdown + Netlify CMS.  
4. **Fase 4:** Migrar a framework React/Vue si se requieren funcionalidades avanzadas.  