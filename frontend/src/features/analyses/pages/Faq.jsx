import { Link } from "react-router";
import { LuArrowLeft, LuCircleHelp } from "react-icons/lu";
import { Page } from "../../../shared/components/UI";

const FAQ_GROUPS = [
  {
    title: "Interpretación de resultados",
    items: [
      {
        q: "¿Una sola imagen muestra pérdidas de vegetación?",
        a: "No. Una imagen muestra los valores de esa fecha, no pérdidas temporales. Para observar cambios se necesitan dos o más fechas.",
      },
      {
        q: "¿Un cambio negativo o la clase 1 confirman deforestación?",
        a: "No. Un cambio negativo o la clase 1 exploratoria requieren referencias independientes antes de afirmar deforestación.",
      },
      {
        q: "¿Qué significan p10 y p90?",
        a: "Son percentiles de los píxeles válidos, no la exactitud del modelo.",
      },
      {
        q: "¿Qué indica «Sin clasificación»?",
        a: "Significa que el modelo no se ejecutó, no que no existan cambios.",
      },
      {
        q: "¿La cobertura inválida es vegetación perdida?",
        a: "No. La cobertura inválida no equivale a vegetación perdida.",
      },
    ],
  },
  {
    title: "Carga de escenas y procesamiento",
    items: [
      {
        q: "¿Por qué se rechazó mi GeoTIFF?",
        a: "La fecha de adquisición debe poder detectarse en los metadatos o en el nombre del archivo, y el servidor rechaza escenas con cobertura válida inferior al 60 %. La fecha de carga no sustituye la fecha de adquisición.",
      },
      {
        q: "¿Cuándo se ejecuta el modelo v9?",
        a: "El modelo v9 requiere la banda SCL y dos o más fechas separadas al menos 35 días, sin límite máximo, además de cobertura válida y área común suficientes. Con una sola imagen se calculan índices y estadísticas.",
      },
      {
        q: "Mi análisis sigue «En cola», ¿qué hago?",
        a: "El worker es quien pasa el análisis de En cola a Procesando. Si permanece en cola, comprueba que el worker está activo.",
      },
    ],
  },
];

export function Faq() {
  return (
    <Page
      title="Preguntas frecuentes"
      description="Respuestas a las dudas más comunes sobre la carga de escenas, el procesamiento y la lectura de resultados en ForestGuard."
      action={
        <Link className="fg-img-subtle-action" to="/help">
          <LuArrowLeft size={15} aria-hidden="true" />
          <span>Volver a Ayuda</span>
        </Link>
      }
    >
      {FAQ_GROUPS.map((group) => (
        <section
          key={group.title}
          className="fg-help-card"
          aria-label={group.title}
        >
          <div className="fg-help-section-head">
            <span className="fg-eyebrow">
              <LuCircleHelp aria-hidden="true" /> {group.items.length} preguntas
            </span>
            <h2>{group.title}</h2>
          </div>
          <div className="fg-help-faq">
            {group.items.map((item) => (
              <details key={item.q} className="fg-help-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}
