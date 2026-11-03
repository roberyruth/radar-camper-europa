# RADAR CAMPER EUROPA

Buscador y analizador de autocaravanas y campers de ocasión en Europa. Objetivo: encontrar una que se pueda comprar y legalizar en Málaga por **7.000 € o menos, todo incluido**.

## Estado actual (versión 0.1, modo local)

Funciona y está probado:
- Analizador de anuncios pegados como texto (alemán, francés, italiano, neerlandés, español, inglés).
- Detector de riesgos y de humedades (nunca asume que no hay humedad si no se menciona).
- Calculadora de coste hasta Málaga con escenario optimista y conservador. **No inventa importes legales**: lo que falta queda como "COSTE PENDIENTE DE VERIFICAR".
- Puntuación explicable 0-100 y clasificación (OPORTUNIDAD / INTERESANTE / SEGUIR / DESCARTAR).
- Guardados, favoritos, notas, historial de precios, detección de duplicados, comparador (hasta 4).
- Ajustes editables, copia de seguridad (exportar/importar JSON).

Todavía NO existe (fases siguientes): búsqueda automática en portales, ejecución horaria, base de datos en la nube, alertas por Telegram/correo, login. Ninguna fuente está integrada.

## Privacidad

El repositorio es público y solo contiene código. Tus anuncios, favoritos y ajustes se guardan **únicamente en el navegador de tu móvil**. No hay claves ni datos personales en el código.

## Probar en local

```
npm test                       # pruebas automáticas
cd docs && python -m http.server 8080
```
Abre http://localhost:8080

## Publicar en GitHub Pages

Settings → Pages → Source: "Deploy from a branch" → Branch `main`, carpeta `/docs`.
