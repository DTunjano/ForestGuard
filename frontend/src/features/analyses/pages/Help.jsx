import { Page, Panel } from "../../../shared/components/UI";
export function Help() {
  return (
    <Page title="Ayuda">
      <Panel>
        <h2>Del GeoTIFF al resultado</h2>
        <ol className="list-inside list-decimal space-y-3">
          <li>Crea o selecciona un área en Nuevo análisis.</li>
          <li>
            Carga GeoTIFF Sentinel-2 georreferenciados con bandas descritas B2,
            B3, B4, B5, B8, B11 y B12. SCL es necesaria para v9.
          </li>
          <li>
            La fecha debe poder detectarse en los metadatos o el nombre del
            archivo. La fecha de carga no sustituye la fecha de adquisición. El
            servidor detecta las escalas y rechaza escenas sin píxeles válidos.
          </li>
          <li>
            Selecciona de 1 a 32 imágenes del área, con fechas diferentes. Una
            imagen calcula índices y estadísticas; varias comparan fechas. v9 es
            opcional y solo se ejecuta en intervalos compatibles.
          </li>
          <li>
            Crea el análisis. El worker lo pasa de En cola a Procesando y
            finalmente Completado o Falló. Si permanece en cola, comprueba que
            el worker está activo.
          </li>
          <li>
            Abre el análisis desde el historial. Consulta métricas, las dos
            paletas individuales y las comparaciones disponibles. Descarga el
            ZIP completo en PNG, GeoTIFF o ambos, o cada informe/mapa por
            separado.
          </li>
        </ol>
      </Panel>
      <Panel>
        <h2>Interpretar los mapas</h2>
        <p>
          NDVI describe vegetación; NDMI humedad espectral; NBR contraste
          NIR/SWIR; NDRE respuesta de borde rojo. Una imagen muestra valores de
          esa fecha, no pérdidas temporales. Un cambio negativo o la clase 1
          exploratoria requiere referencias independientes antes de afirmar
          deforestación.
        </p>
        <p>
          p10 y p90 son percentiles de píxeles válidos, no exactitud del modelo.
          Sin clasificación significa que el modelo no se ejecutó, no que no
          existan cambios. La cobertura inválida no es vegetación perdida.
        </p>
      </Panel>
    </Page>
  );
}
