# Red en Movimiento — versión aumentada

Este repositorio contiene la evolución de un proyecto existente de visualización de datos de servicios de transporte (QuéTren): una animación que muestra un día completo de trenes programados del AMBA sobre la traza real de sus vías. Sobre esa base se construye una **versión aumentada** cuyo objetivo es incorporar, gradualmente, información específica de cada servicio y datos útiles para el viajero — empezando por los **cuadros horarios en cada punto de paso para cada servicio**.

## Estado actual

La versión de partida ya incluye las primeras piezas de esa evolución:

| Capacidad | Descripción |
|-----------|-------------|
| Mapa animado | Un día completo de servicios (2.149 en día hábil, 8 líneas, 26 ramales) sobre la geometría real de las vías, con reloj y velocidad ajustable. |
| Marcas de estación | Ticks perpendiculares sobre cada línea en la posición real de cada estación. |
| Consulta por servicio | Click/touch sobre un tren abre un panel lateral con el horario completo de ese servicio: hora de paso por cada estación donde detiene, con resaltado del tramo en el que circula, sincronizado con la barra de tiempo. |
| Identificador de formación | Cada tren muestra un código estable (ej. `RO-14`) que se mantiene durante toda su jornada, inferido por encadenamiento de horarios (idéntico coche circulando en ambos sentidos). |
| Tipos de día | Cuadros de servicio independientes para día hábil, sábado y domingo/feriados. |

## Objetivo: versión aumentada

La meta es que cada punto en movimiento deje de ser solo un punto y se convierta en la puerta de entrada a la información del servicio que representa:

1. **Cuadros horarios por punto de paso** — para cada servicio, el detalle completo de horas de paso/arribo en cada estación de su recorrido, consultable desde el mapa.
2. **Información específica del servicio** — origen y destino, ramales, sentidos, expresos, y su evolución a lo largo de la jornada.
3. **Evolución incremental** — nuevas capas de información útil sobre la misma base de visualización, sin perder la escala de "un día entero de un vistazo".

> Nota honesta: los identificadores de formación se infieren de los horarios publicados, no de datos operativos reales de la operadora.

## Ruta rápida

```bash
# Servir el sitio estáticamente (los datos se cargan por fetch: no abrir index.html con file://)
python3 -m http.server 8080
# o bien
npx serve .
```

1. Abrir `http://localhost:8080`.
2. Pulsar **Reproducir** y arrastrar la barra de **Hora del día**.
3. Verificación: durante la mañana debería verse el pico de trenes en circulación y, al hacer click sobre un punto, el panel lateral con el cuadro horario de ese servicio.

## Datos

- Los horarios provienen de los cuadros programados vigentes y se agrupan en tres bundles (`data/animation-bundle-{habil,sabado,domingo}.json`) con la geometría de vías, las estaciones y los tiempos de paso de cada servicio.
- La aplicación es 100% estática: HTML, CSS y JavaScript vanilla sin dependencias ni proceso de build.
- No es una aplicación oficial de Trenes Argentinos. Los horarios son referenciales y pueden cambiar sin previo aviso.
