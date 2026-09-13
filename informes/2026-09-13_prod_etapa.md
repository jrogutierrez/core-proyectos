## Informe de la Etapa Actual del Proyecto

| Sección | Descripción |
|---------|-------------|
| **1. Qué se hizo** | • Definición de los requisitos funcionales y no funcionales.<br>• Arquitectura de alto nivel aprobada.<br>• Configuración inicial del repositorio Git y CI/CD.<br>• Primer sprint de desarrollo (implementación de la API de autenticación). |
| **2. Estado actual** | • 75 % del código base desarrollado.<br>• Tests unitarios y de integración alcanzan 82 % de cobertura.<br>• Entorno de staging listo y pruebas de carga realizadas.<br>• Documentación técnica actualizada en Confluence. |
| **3. Próximos pasos** | 1. Completar el módulo de gestión de usuarios (punto 2).<br>2. Integrar servicio de mensajería (Kafka).<br>3. Realizar pruebas de penetración y auditoría de seguridad.<br>4. Planificar despliegue a producción (Sprint 4). |
| **4. Riesgos detectados** | • **Dependencia de librería externa**: versión 3.1.0 tiene vulnerabilidad CVE‑2025‑1234.<br>• **Escalabilidad**: la arquitectura monolítica puede no soportar 10 k usuarios concurrentes sin refactor.<br>• **Falta de pruebas de UI**: la capa frontend aún no tiene cobertura automatizada.<br>• **Gestión de datos sensibles**: requerimientos de GDPR aún no implementados en la capa de persistencia. |

> **Recomendación**: Revisar la dependencia crítica antes de la próxima entrega y comenzar la migración a microservicios para mitigar el riesgo de escalabilidad.