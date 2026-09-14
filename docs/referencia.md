# Estado Actual

- **index.html** actualizado: se añadió `<link rel="stylesheet" href="style.css">` dentro del `<head>`.
- **sw.js** creado: servicio worker que cachea solo `index.html`, `script.js` y `style.css`, verifica el origen y aplica `Cache-Control: no-store` a rutas que contengan “medical” o “notes”.