import { Link } from "react-router";
import {
  LuArrowRight,
  LuBookOpen,
  LuCalendarCheck,
  LuCircleHelp,
  LuDownload,
  LuFolderOpen,
  LuImages,
  LuLayers,
  LuLightbulb,
  LuListChecks,
  LuMap,
  LuSatellite,
  LuScanLine,
  LuUpload,
} from "react-icons/lu";
import { Page } from "../../../shared/components/UI";

const REQUIREMENTS = [
  {
    icon: LuSatellite,
    title: "GeoTIFF Sentinel-2",
    desc: "Escena georreferenciada en formato GeoTIFF.",
  },
  {
    icon: LuLayers,
    title: "Bandas espectrales",
    desc: "Bandas descritas en el archivo:",
    chips: ["B2", "B3", "B4", "B5", "B8", "B11", "B12"],
  },
  {
    icon: LuScanLine,
    title: "Banda SCL",
    desc: "Necesaria para ejecutar el modelo v9.",
  },
  {
    icon: LuCalendarCheck,
    title: "Fecha de adquisición",
    desc: "Detectable en los metadatos o en el nombre del archivo.",
  },
  {
    icon: LuImages,
    title: "Cantidad de escenas",
    desc: "De 1 a 32 imágenes del área, con fechas diferentes.",
  },
];

const STEPS = [
  {
    icon: LuMap,
    title: "Elige el área de estudio",
    text: "Crea o selecciona un área en Nuevo análisis.",
  },
  {
    icon: LuUpload,
    title: "Carga las escenas Sentinel-2",
    text: "Sube GeoTIFF georreferenciados con las bandas descritas B2, B3, B4, B5, B8, B11 y B12. La banda SCL es necesaria para el modelo v9.",
  },
  {
    icon: LuCalendarCheck,
    title: "Verifica la fecha de adquisición",
    text: "La fecha debe poder detectarse en los metadatos o en el nombre del archivo. El servidor detecta las escalas y rechaza escenas con cobertura válida inferior al 60 %.",
  },
  {
    icon: LuLayers,
    title: "Selecciona las imágenes",
    text: "Elige de 1 a 32 imágenes del área, con fechas diferentes. Una imagen calcula índices y estadísticas; varias comparan fechas.",
  },
  {
    icon: LuSatellite,
    title: "Crea el análisis",
    text: "El worker lo procesa automáticamente. Puedes seguir su estado desde el historial.",
  },
  {
    icon: LuDownload,
    title: "Consulta y descarga resultados",
    text: "Abre el análisis desde el historial. En Resumen verás mapas, porcentajes e informe; en Explorar índices, las estadísticas; y en Descargas técnicas, los archivos y el ZIP completo.",
  },
];

const INDICES = [
  { code: "NDVI", desc: "Describe la vegetación." },
  { code: "NDMI", desc: "Representa la humedad espectral." },
  { code: "NBR", desc: "Mide el contraste entre NIR y SWIR." },
  { code: "NDRE", desc: "Refleja la respuesta de borde rojo." },
];

function SectionHead({ icon: Icon, eyebrow, title, id }) {
  return (
    <div className="fg-help-section-head">
      <span className="fg-eyebrow">
        <Icon aria-hidden="true" /> {eyebrow}
      </span>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

export function Help() {
  return (
    <Page
      title="Ayuda"
      description="Guía rápida para preparar tus escenas, ejecutar un análisis e interpretar correctamente los resultados de ForestGuard."
    >
      {/* 1. Antes de empezar */}
      <section className="fg-help-card" aria-labelledby="help-req">
        <SectionHead
          id="help-req"
          icon={LuFolderOpen}
          eyebrow="Antes de empezar"
          title="Requisitos de las escenas"
        />
        <ul className="fg-help-req-grid">
          {REQUIREMENTS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="fg-help-req-item">
                <span className="fg-help-req-icon" aria-hidden="true">
                  <Icon size={17} />
                </span>
                <div className="fg-help-req-copy">
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                  {item.chips && (
                    <div className="fg-help-req-chips">
                      {item.chips.map((chip) => (
                        <span key={chip}>{chip}</span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="fg-help-callout" role="note">
          <span className="fg-help-callout-icon" aria-hidden="true">
            <LuLightbulb size={19} />
          </span>
          <div className="fg-help-callout-copy">
            <strong>¿No sabes si tu imagen es apta?</strong>
            <p>
              No necesitas revisarla manualmente: cárgala siguiendo el proceso
              normal. ForestGuard valida automáticamente cada GeoTIFF al subirlo
              y te indica si la imagen sirve o qué le falta para poder usarla.
            </p>
          </div>
          <Link to="/dashboard/new" className="fg-help-callout-action">
            Ir a cargar imágenes
            <LuArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* 2. Flujo de trabajo */}
      <section className="fg-help-card" aria-labelledby="help-steps">
        <SectionHead
          id="help-steps"
          icon={LuListChecks}
          eyebrow="Flujo de trabajo"
          title="Del GeoTIFF al resultado"
        />
        <ol className="fg-help-steps">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="fg-help-step">
                <div className="fg-help-step-top">
                  <span className="fg-help-step-marker" aria-hidden="true">
                    {index + 1}
                  </span>
                  <Icon
                    className="fg-help-step-icon"
                    size={17}
                    aria-hidden="true"
                  />
                </div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 3. Lectura de resultados */}
      <section className="fg-help-card" aria-labelledby="help-maps">
        <SectionHead
          id="help-maps"
          icon={LuBookOpen}
          eyebrow="Lectura de resultados"
          title="Interpretar los mapas"
        />
        <div className="fg-help-index-grid">
          {INDICES.map((item) => (
            <div key={item.code} className="fg-help-index-card">
              <span>{item.code}</span>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="fg-help-note">
          Un cambio negativo o la clase 1 exploratoria requieren referencias
          independientes antes de afirmar deforestación.
        </p>
      </section>

      {/* 4. Más ayuda */}
      <Link to="/faq" className="fg-help-faq-cta">
        <span className="fg-help-quick-icon" aria-hidden="true">
          <LuCircleHelp size={18} />
        </span>
        <span className="fg-help-quick-copy">
          <strong>¿Tienes más dudas?</strong>
          <small>
            Consulta las preguntas frecuentes sobre carga de escenas,
            procesamiento e interpretación de resultados.
          </small>
        </span>
        <span className="fg-help-faq-cta-label">
          Ver preguntas frecuentes
          <LuArrowRight size={15} aria-hidden="true" />
        </span>
      </Link>
    </Page>
  );
}
