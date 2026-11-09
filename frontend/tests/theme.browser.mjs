import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

// Controlled API fixtures: this appearance test never writes to the real database.
const permissions = [
  ...["view", "add", "change", "delete"].flatMap((action) =>
    [
      "catalog.studyarea",
      "catalog.satelliteimage",
      "catalog.pipelinemodel",
      "analyses.analysis",
      "accounts.user",
      "auth.group",
    ].map((item) => {
      const [app, model] = item.split(".");
      return `${app}.${action}_${model}`;
    }),
  ),
];
const user = {
  id: 1,
  username: "test_theme",
  first_name: "Prueba",
  last_name: "Visual",
  email: "theme@example.test",
  is_active: true,
  is_staff: true,
  is_superuser: true,
  roles: [{ id: 1, name: "admin" }],
  permissions,
};
const categories = [
  [0, "otra_cobertura", "Otra cobertura inicial", "#87939f"],
  [1, "bosque_estable", "Bosque estable", "#369b61"],
  [2, "degradacion", "Degradación", "#eab949"],
  [3, "posible_deforestacion", "Posible deforestación", "#dc504c"],
].map(([valor, clave, etiqueta, color]) => ({
  valor,
  clave,
  etiqueta,
  color,
  porcentaje: 25,
  area_ha: 1,
  pixeles: 4,
}));
const summary = {
  escenas: [],
  intervalos: [
    {
      fecha_inicial: "2024-01-01",
      fecha_final: "2025-01-01",
      dias: 366,
      coincidencia_vegetacion: {
        jaccard: 0.8,
        umbral_ndvi: 0.5,
        pixeles_interseccion: 8,
        pixeles_union: 10,
        pixeles_solo_fecha_inicial: 1,
        pixeles_solo_fecha_final: 1,
        area_salida_ha: 0.01,
        area_entrada_ha: 0.01,
      },
      condicion: {
        tipo: "temporal",
        categorias: categories,
        cobertura_valida_porcentaje: 100,
      },
    },
  ],
};
const folder = "intervalos/2024-01-01_2025-01-01";
const artifacts = [
  {
    id: 1,
    kind: "visualization",
    relative_path: `${folder}/original_final_rgb.png`,
    download_url: "/api/v1/artifacts/1/download/",
    label: "Original",
  },
  {
    id: 2,
    kind: "raster",
    relative_path: `${folder}/condicion_bosque.tif`,
    category_mask_url: "/api/v1/artifacts/2/category-mask/",
    label: "Cobertura",
  },
  {
    id: 3,
    kind: "raster",
    relative_path: `${folder}/clasificacion_piloto/clasificacion_cambio_exploratoria.tif`,
    v9_evaluation_url: "/api/v1/artifacts/3/v9-evaluation/",
    download_url: "/api/v1/artifacts/3/download/",
    label: "Predicción v9",
  },
  {
    id: 4,
    kind: "raster",
    relative_path:
      "intervalos/2023-01-01_2023-03-01/clasificacion_piloto/clasificacion_cambio_exploratoria.tif",
    v9_evaluation_url: "/api/v1/artifacts/4/v9-evaluation/",
    download_url: "/api/v1/artifacts/4/download/",
    label: "Predicción v9 · par corto",
  },
];
let evaluation = null;
const official = {
  available: true,
  reason: "",
  years: [2024, 2025],
  complete_years: [2024],
  evaluation: null,
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  baseURL: process.env.FG_TEST_URL || "http://127.0.0.1:5173",
  viewport: { width: 1440, height: 1000 },
});
await context.route("**/api/v1/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  let body = { count: 0, results: [], next: null, previous: null };
  if (path.includes("/auth/token/"))
    body = { access: "test-access", refresh: "test-refresh" };
  else if (path.endsWith("/auth/me/")) body = user;
  else if (path.endsWith("/admin/users/"))
    body = { ...body, count: 1, results: [user] };
  else if (path.endsWith("/admin/roles/"))
    body = [
      {
        id: 1,
        name: "admin",
        description: "Administración",
        is_system: true,
        permissions: [],
        permission_ids: [],
        users_count: 1,
      },
    ];
  else if (path.endsWith("/admin/permissions/")) body = [];
  else if (path.endsWith("/analyses/99/"))
    body = {
      id: 99,
      name: "Prueba de apariencia",
      status: "completed",
      images: [{ date: "2024-01-01" }, { date: "2025-01-01" }],
      summary,
    };
  else if (path.endsWith("/analyses/99/results/"))
    body = { reports: [], individual: [], comparisons: artifacts, other: [] };
  else if (path.endsWith("/3/v9-evaluation/ideam/")) {
    official.evaluation = {
      reference_name: "IDEAM · capas anuales 2024–2025",
      reference_source: "Capas oficiales de prueba",
      evaluated_at: "2026-11-09T18:00:00Z",
      metrics: {
        jaccard: 0.25,
        precision: 0.5,
        sensibilidad: 1 / 3,
        verdaderos_positivos: 1,
        falsos_positivos: 1,
        falsos_negativos: 2,
        verdaderos_negativos: 4,
        pixeles_evaluados: 8,
        pixeles_prediccion_validos: 10,
      },
    };
    body = { evaluation, ideam: official };
  } else if (path.endsWith("/4/v9-evaluation/"))
    body = {
      evaluation: null,
      ideam: {
        available: false,
        reason: "El intervalo no contiene un año calendario completo.",
        years: [2023],
        complete_years: [],
        evaluation: null,
      },
    };
  else if (path.endsWith("/3/v9-evaluation/")) {
    if (route.request().method() === "POST") {
      const payload = route.request().postData();
      for (const field of [
        "reference",
        "reference_source",
        "independent_reference",
      ])
        expect(payload).toContain(`name="${field}"`);
      if (payload.includes("Cuadrícula incorrecta")) {
        return route.fulfill({
          status: 400,
          json: { reference: ["La cuadrícula no coincide."] },
        });
      }
      evaluation = {
        reference_name: "referencia.tif",
        reference_source: "Fuente de prueba",
        evaluated_at: "2026-11-08T18:00:00Z",
        metrics: {
          jaccard: 0.5,
          precision: 0.75,
          sensibilidad: 0.6,
          verdaderos_positivos: 6,
          falsos_positivos: 2,
          falsos_negativos: 4,
          verdaderos_negativos: 6,
          pixeles_evaluados: 18,
          pixeles_prediccion_validos: 24,
        },
      };
    }
    body = { evaluation, ideam: official };
  } else if (path.endsWith("/category-mask/"))
    body = {
      encoding: "uint8-base64",
      width: 4,
      height: 4,
      nodata: 255,
      values: Buffer.from(Array.from({ length: 16 }, (_, i) => i % 4)).toString(
        "base64",
      ),
    };
  else if (path.endsWith("/artifacts/1/download/")) {
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#369b61"/></svg>',
    });
  }
  return route.fulfill({ json: body });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("test-results/theme", { recursive: true });
const toggle = page.getByRole("button", { name: "Modo claro", exact: true });
async function appearance(theme) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(toggle).toHaveAttribute(
    "aria-pressed",
    String(theme === "light"),
  );
}
async function screenshot(name) {
  await page.screenshot({
    path: `test-results/theme/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
try {
  await page.goto("/auth/login");
  await appearance("dark");
  await screenshot("login-dark");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await appearance("light");
  await screenshot("login-light");
  await page.reload();
  await appearance("light");
  await page.goto("/auth/register");
  await appearance("light");
  await expect(
    page.getByRole("heading", { name: "Crear cuenta" }),
  ).toBeVisible();
  await screenshot("register-light");

  const second = await context.newPage();
  await second.goto("/auth/login");
  await toggle.click();
  await appearance("dark");
  await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");
  await second.close();
  await toggle.click();
  await appearance("light");

  await page.evaluate(() =>
    sessionStorage.setItem("forestguard.refresh", "test-refresh"),
  );
  const readings = [];
  for (const path of [
    "/dashboard",
    "/dashboard/new",
    "/dashboard/history",
    "/study-areas",
    "/images",
    "/models",
    "/profile",
    "/help",
    "/faq",
    "/admin/users",
    "/admin/roles",
    "/admin/models",
    "/dashboard/results/99",
  ]) {
    console.log(`Checking ${path}`);
    await page.goto(path);
    await appearance("light");
    await expect(page.locator(".fg-page h1")).toBeVisible();
    if (path.includes("/results/"))
      await expect(page.locator("canvas.fg-interactive-map")).toBeVisible();
    await expect(
      page.getByText("Consultando archivos del análisis…"),
    ).toHaveCount(0);
    readings.push(
      await page.locator(".fg-page h1").evaluate((heading) => ({
        title: heading.textContent,
        color: getComputedStyle(heading).color,
        background: getComputedStyle(document.documentElement).backgroundColor,
      })),
    );
    await screenshot(path.replaceAll("/", "-").slice(1) + "-light");
    if (path === "/study-areas") {
      await page
        .getByRole("button", { name: "Nueva área", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await screenshot("area-modal-light");
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("button", { name: "Crear área", exact: true })
        .click();
      await expect(page.locator("[data-sonner-toast]")).toContainText(
        "Completa el campo",
      );
      await expect(dialog.getByLabel("Nombre del área")).toBeFocused();
      await page.getByRole("button", { name: "Cerrar notificación" }).click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
    }
  }
  const canvas = page.locator("canvas.fg-interactive-map");
  await expect(canvas).toBeVisible();
  const pixels = () =>
    canvas.evaluate((node) =>
      Array.from(
        node.getContext("2d").getImageData(0, 0, node.width, node.height).data,
      ),
    );
  const before = await pixels();
  await toggle.click();
  await appearance("dark");
  expect(await pixels()).toEqual(before);
  await screenshot("results-dark");
  await toggle.click();
  await appearance("light");
  await page
    .getByRole("button", { name: "Ver más detalles", exact: true })
    .click();
  const picker = page.getByRole("combobox", { name: "¿Qué quieres observar?" });
  await picker.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await screenshot("result-picker-light");
  await page.keyboard.press("Escape");
  const overlap = page.getByRole("region", {
    name: "Coincidencia de vegetación entre fechas",
  });
  await expect(overlap.getByText("80 %", { exact: true })).toBeVisible();
  const evaluationTab = page.getByRole("button", { name: /^Evaluación v9/ });
  await evaluationTab.click();
  const ideam = page.getByRole("region", {
    name: "Evaluación automática con IDEAM",
  });
  await ideam
    .getByRole("button", { name: "Evaluar con IDEAM", exact: true })
    .click();
  await expect(ideam.getByText("25 %", { exact: true })).toBeVisible();
  const interval = page.getByRole("combobox", {
    name: "Intervalo de la predicción",
  });
  await interval.click();
  await page.getByRole("option", { name: "2023-01-01 a 2023-03-01" }).click();
  await expect(ideam).toContainText("no contiene un año calendario completo");
  await expect(ideam.getByText("25 %", { exact: true })).toHaveCount(0);
  await interval.click();
  await page.getByRole("option", { name: "2024-01-01 a 2025-01-01" }).click();
  await expect(ideam.getByText("25 %", { exact: true })).toBeVisible();
  const manualToggle = page.getByText("Evaluación con referencia propia", {
    exact: true,
  });
  await manualToggle.click();
  const reference = page.getByLabel("Máscara de referencia GeoTIFF");
  const evaluate = page.getByRole("button", {
    name: "Calcular y guardar evaluación",
  });
  const validation = page.locator("[data-sonner-toast]");
  await evaluate.click();
  await expect(validation).toHaveCount(1);
  await expect(validation).toContainText("Selecciona un archivo");
  await expect(reference).toBeFocused();
  await reference.setInputFiles({
    name: "referencia.tif",
    mimeType: "image/tiff",
    buffer: Buffer.from("mock TIFF for the browser test"),
  });
  const source = page.getByLabel("Fuente de las etiquetas");
  await source.fill("Cuadrícula incorrecta");
  const confirmation = page.getByRole("checkbox", {
    name: /^Confirmo que las etiquetas/,
  });
  await evaluate.click();
  await expect(validation).toContainText(
    "Confirma que las etiquetas corresponden",
  );
  await expect(confirmation).toBeFocused();
  await screenshot("validation-toast-light");
  await confirmation.check();
  await evaluate.click();
  await expect(page.getByRole("alert")).toContainText(
    "La cuadrícula no coincide",
  );
  await source.fill("Fuente de prueba");
  await evaluate.click();
  await expect(
    page.getByText("Evaluación guardada.", { exact: true }),
  ).toBeVisible();
  const score = manualToggle.locator("..").getByRole("region", {
    name: "Resultado guardado de la evaluación v9",
  });
  await expect(score.getByText("50 %", { exact: true })).toBeVisible();
  await expect(validation).toHaveCount(0);
  await screenshot("jaccard-evaluation-light");
  await page.reload();
  await evaluationTab.click();
  await expect(ideam.getByText("25 %", { exact: true })).toBeVisible();
  await manualToggle.click();
  await expect(score.getByText("50 %", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/dashboard",
    "/dashboard/new",
    "/dashboard/results/99",
    "/admin/users",
  ]) {
    console.log(`Checking mobile ${path}`);
    await page.goto(path);
    await appearance("light");
    await expect(page.locator(".fg-page h1")).toBeVisible();
    if (path.includes("/results/")) {
      await evaluationTab.click();
      await expect(ideam.getByText("25 %", { exact: true })).toBeVisible();
    }
    await screenshot(path.replaceAll("/", "-").slice(1) + "-mobile");
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("main *")]
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .map((el) => `${el.tagName}.${el.className}`)
        .slice(0, 8),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${path}: ${overflow.join(", ")}`,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
  await writeFile(
    "test-results/theme/readings.json",
    JSON.stringify(readings, null, 2),
  );
  console.log(
    "Appearance verified: 13 authenticated routes, login/register, modal, menu, keyboard, persistence, tabs, mobile, unchanged map pixels.",
  );
} finally {
  await browser.close();
}
