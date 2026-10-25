import { chromium, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  baseURL: process.env.FG_TEST_URL,
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
await mkdir("test-results/redesign", { recursive: true });
async function capture(name) {
  if (await page.locator("aside").count()) {
    await expect
      .poll(() =>
        page
          .locator("aside")
          .evaluate(
            (element) =>
              Math.abs(
                element.getBoundingClientRect().width -
                  (element.dataset.expanded === "true" ? 256 : 76),
              ) < 1,
          ),
      )
      .toBe(true);
  }
  await page.screenshot({
    path: `test-results/redesign/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
page.on("pageerror", (error) => errors.push(error.message));
const password = "BrowserTest123!";
async function pick(label, choice) {
  const control = page.getByRole("combobox", { name: label, exact: true });
  await control.click();
  const option =
    typeof choice === "object"
      ? page.getByRole("option", { name: choice.label, exact: true })
      : page.locator(`[role="option"][data-value="${choice}"]`);
  await option.click();
  await expect(control).toHaveAttribute("aria-expanded", "false");
}
async function login(username, currentPassword = password) {
  await page.goto("/auth/login");
  await page.getByLabel("Usuario", { exact: true }).fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill(currentPassword);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function logout() {
  await page.getByRole("button", { name: "Abrir perfil" }).click();
  await page.getByRole("button", { name: "Cerrar Sesión" }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
}
async function create(name) {
  await page.getByLabel("Nombre del análisis").fill(name);
  await page
    .getByRole("button", { name: "Crear análisis", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/results\/\d+$/);
  await expect(
    page.getByText("Estado: Completado", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByRole("heading", { name: "Resumen y métricas", exact: true }),
  ).toBeVisible();
}
async function download(button, extension) {
  const pending = page.waitForEvent("download");
  await button.click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(extension);
  const buffer = await readFile(await file.path());
  expect(buffer.length).toBeGreaterThan(30);
  return buffer;
}
try {
  await page.goto("/dashboard/new");
  await expect(page).toHaveURL(/auth\/login/);
  await capture("login");
  await page.getByRole("link", { name: "Crear cuenta" }).click();
  await page.getByLabel("Usuario", { exact: true }).fill("integration_analyst");
  await page.getByLabel("Correo", { exact: true }).fill("analyst@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar contraseña").fill(password);
  await page.getByRole("button", { name: "Registrar e ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ForestGuard · Panel de trabajo" }),
  ).toBeVisible();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/dashboard$/);
  const rail = page.locator("aside");
  await page.mouse.move(1100, 500);
  await rail.hover();
  await expect(rail).toHaveAttribute("data-expanded", "true");
  await page.mouse.move(1100, 500);
  await expect(rail).toHaveAttribute("data-expanded", "false");
  await page
    .getByRole("button", { name: "Abrir navegación", exact: true })
    .focus();
  await expect(rail).toHaveAttribute("data-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(rail).toHaveAttribute("data-expanded", "false");
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Editar información", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill("Analista prueba");
  await capture("profile");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByText("Tus datos básicos fueron actualizados."),
  ).toBeVisible();
  await page.goto("/dashboard/new");
  if (
    await page
      .getByRole("button", { name: "Crear un área de estudio", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Crear un área de estudio", exact: true })
      .click();
  await capture("upload");
  await page.getByLabel("Nombre del área").fill("Área controlada");
  await page.getByRole("button", { name: "Crear área", exact: true }).click();
  await page.locator(".fg-wizard-step").first().click();
  await expect(
    page.getByLabel("Área de estudio", { exact: true }),
  ).toContainText("Área controlada");
  const areaPicker = page.getByRole("combobox", {
    name: "Área de estudio",
    exact: true,
  });
  await areaPicker.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.screenshot({
    path: "test-results/redesign/styled-dropdown.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(areaPicker).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(areaPicker).toContainText("Área controlada");
  await page
    .getByRole("button", { name: "Siguiente: Cargar imágenes", exact: true })
    .click();
  await page
    .getByLabel("Archivos Sentinel-2 GeoTIFF")
    .setInputFiles([
      join(process.env.FG_TEST_FILES, "scene_2024_01_01.tif"),
      join(process.env.FG_TEST_FILES, "invalid_2024_02_01.tif"),
    ]);
  await page
    .getByRole("button", { name: "Cargar pendientes", exact: true })
    .first()
    .click();
  await expect(
    page
      .locator(".fg-upload-item")
      .filter({ hasText: "invalid_2024_02_01.tif" })
      .getByText("Falló", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".fg-upload-item")
      .filter({ hasText: "scene_2024_01_01.tif" })
      .getByText("Cargada", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Siguiente: Revisar escenas seleccionadas",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Siguiente: Configurar análisis",
      exact: true,
    })
    .click();
  await create("Individual controlado");
  const individualUrl = page.url();
  await capture("individual");
  await expect(page.locator("img").first()).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("img")
        .first()
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  const zip = await download(
    page.getByRole("button", { name: "Descargar ZIP completo" }),
    /\.zip$/,
  );
  expect(zip.subarray(0, 2).toString()).toBe("PK");
  const png = await download(
    page.getByRole("button", { name: "Descargar PNG", exact: true }).first(),
    /\.png$/,
  );
  expect(png[0]).toBe(137);
  await download(
    page
      .getByRole("button", { name: "Descargar GeoTIFF", exact: true })
      .first(),
    /\.tif$/,
  );
  await download(
    page.getByRole("button", { name: "Descargar PDF", exact: true }),
    /\.pdf$/,
  );
  await download(
    page.getByRole("button", { name: "Descargar JSON", exact: true }),
    /\.json$/,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Individual controlado", exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard/new");
  await pick("Área de estudio", { label: "Área controlada" });
  await page
    .getByRole("button", { name: "Siguiente: Cargar imágenes", exact: true })
    .click();
  await page
    .getByLabel("Archivos Sentinel-2 GeoTIFF")
    .setInputFiles(join(process.env.FG_TEST_FILES, "scene_2024_03_01.tif"));
  await page
    .getByRole("button", { name: "Cargar pendientes", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", {
      name: "Siguiente: Revisar escenas seleccionadas",
      exact: true,
    })
    .click();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page
    .getByRole("button", {
      name: "Siguiente: Configurar análisis",
      exact: true,
    })
    .click();
  await create("Comparación controlada");
  await expect(page.getByText(/Clasificación: ejecutada/)).toBeVisible();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/integration-results.png",
    fullPage: true,
  });
  await pick("Sección", "comparisons");
  await expect(
    page.getByRole("heading", {
      name: "Lámina de cambios entre fechas en PNG",
    }),
  ).toBeVisible();
  await pick("Índice / lámina", "NDVI");
  await expect(
    page.getByRole("button", { name: "Descargar GeoTIFF", exact: true }),
  ).toHaveCount(1);
  await page.goto("/dashboard/history");
  await expect(page.getByRole("table")).toBeVisible();
  await capture("history");
  await expect(
    page.getByText("Comparación controlada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Abrir análisis" }).last().click();
  expect(page.url()).toBe(individualUrl);
  await page.goto("/dashboard/new");
  await pick("Área de estudio", { label: "Área controlada" });
  await page
    .getByRole("button", { name: "Siguiente: Cargar imágenes", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Siguiente: Seleccionar escenas del área",
      exact: true,
    })
    .click();
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button", {
      name: "Siguiente: Configurar análisis",
      exact: true,
    })
    .click();
  await page.getByLabel("Nombre del análisis").fill("Controlled failure");
  await page
    .getByRole("button", { name: "Crear análisis", exact: true })
    .click();
  await expect(page.getByText("Estado: Falló", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: "Descargar ZIP completo" }),
  ).toHaveCount(0);
  await page.goto("/study-areas");
  let row = page.getByRole("row").filter({ hasText: "Área controlada" });
  await row.getByRole("button", { name: "Ver detalle", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Descripción del área").fill("Descripción revisada");
  await page.getByRole("button", { name: "Guardar área", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await row.getByRole("button", { name: "Eliminar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "imágenes",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Nueva área" }).click();
  await page.getByLabel("Nombre del área").fill("Área temporal CRUD");
  await page.getByRole("button", { name: "Crear área", exact: true }).click();
  row = page.getByRole("row").filter({ hasText: "Área temporal CRUD" });
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nombre del área").fill("Área temporal editada");
  await page.getByRole("button", { name: "Guardar área", exact: true }).click();
  row = page.getByRole("row").filter({ hasText: "Área temporal editada" });
  await row.getByRole("button", { name: "Eliminar", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Eliminar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(row).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "Área controlada" }),
  ).toBeVisible();
  await capture("areas-crud");
  await page.goto("/images");
  await page
    .getByRole("button", { name: "Filtrar por área", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Área controlada", exact: true })
    .click();
  await page.getByRole("button", { name: "Ver metadatos" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Dimensiones");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Eliminar", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "análisis",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await capture("images-module");
  await page.goto("/dashboard/new");
  await pick("Área de estudio", { label: "Área controlada" });
  await page
    .getByRole("button", { name: "Siguiente: Cargar imágenes", exact: true })
    .click();
  await page.getByLabel("Archivos Sentinel-2 GeoTIFF").setInputFiles({
    name: "unused_2024_02_01.tif",
    mimeType: "image/tiff",
    buffer: await readFile(
      join(process.env.FG_TEST_FILES, "scene_2024_01_01.tif"),
    ),
  });
  await page
    .getByRole("button", { name: "Cargar pendientes", exact: true })
    .first()
    .click();
  await expect(
    page
      .locator(".fg-upload-item")
      .filter({ hasText: "unused_2024_02_01.tif" })
      .getByText("Cargada", { exact: true }),
  ).toBeVisible();
  await page.goto("/images");
  await page
    .getByRole("button", { name: "Filtrar por área", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Área controlada", exact: true })
    .click();
  const unusedRow = page
    .getByRole("row")
    .filter({ hasText: "unused_2024_02_01" });
  await unusedRow
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(unusedRow).toHaveCount(0);
  await page.goto("/dashboard/history");
  await page
    .getByRole("row")
    .filter({ hasText: "Controlled failure" })
    .getByRole("button", { name: "Eliminar análisis" })
    .click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Controlled failure" }),
  ).toBeVisible();

  await logout();
  await login("integration_admin");
  await page.goto(individualUrl);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar ZIP completo" }),
  ).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "Usuarios", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar integration_analyst" })
    .click();
  await capture("users");
  await page.getByRole("combobox", { name: "Estado", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await pick("Estado", "false");
  await page.getByRole("button", { name: "Guardar usuario" }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "integration_analyst" })
      .getByText("Inactivo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Usuario guardado.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nuevo usuario", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Crear usuario", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Usuario", { exact: true }).fill("created_by_admin");
  await page.getByLabel("Correo", { exact: true }).fill("created@example.test");
  await page.getByLabel("Contraseña inicial").fill(password);
  await expect(page.getByLabel("Usuario", { exact: true })).toHaveValue(
    "created_by_admin",
  );
  await expect(page.getByLabel("Correo", { exact: true })).toHaveValue(
    "created@example.test",
  );
  await page.getByRole("button", { name: "Guardar usuario" }).click();
  await expect(
    page.getByRole("button", { name: "Editar created_by_admin" }),
  ).toBeVisible();
  await page.goto("/admin/roles");
  await page.getByRole("button", { name: "Crear rol", exact: true }).click();
  await page.getByLabel("Nombre del rol", { exact: true }).fill("reviewer");
  await page
    .getByRole("group", { name: "Áreas de estudio", exact: true })
    .getByRole("checkbox", { name: "Consultar", exact: true })
    .check();
  await page.getByRole("button", { name: "Guardar rol", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/admin/users");
  await page
    .getByRole("button", { name: "Editar created_by_admin", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "analyst", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "reviewer", exact: true }).check();
  await page
    .getByRole("button", { name: "Guardar usuario", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await logout();
  await login("created_by_admin");
  await page.goto("/study-areas");
  await expect(
    page.getByRole("button", { name: "Nueva área", exact: true }),
  ).toBeDisabled();
  await page.goto("/dashboard/new");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/admin/roles");
  await expect(page).toHaveURL(/\/dashboard$/);
  await logout();
  await login("integration_admin");
  await page.goto("/admin/users");
  await page
    .getByRole("button", { name: "Editar created_by_admin", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "reviewer", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "analyst", exact: true }).check();
  await page
    .getByRole("button", { name: "Guardar usuario", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/admin/roles");
  await page
    .getByRole("button", { name: "Ver / editar reviewer", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Consultar", exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Eliminar rol reviewer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ver / editar reviewer", exact: true }),
  ).toHaveCount(0);
  await page.goto("/models");
  await expect(
    page.getByRole("heading", { name: "ForestGuard · v9" }),
  ).toBeVisible();
  await capture("models");
  await page.goto("/profile");
  await page.getByRole("button", { name: "Configurar", exact: true }).click();
  await page.getByLabel("Contraseña actual").fill(password);
  await page.getByLabel("Nueva contraseña").fill("ChangedBrowser123!");
  await page
    .getByRole("button", { name: "Actualizar contraseña", exact: true })
    .click();
  await expect(page).toHaveURL(/auth\/login/);
  await login("integration_admin", "ChangedBrowser123!");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "ForestGuard · Panel de trabajo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir navegación", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tu cuenta aún no tiene análisis.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/integration-mobile.png",
    fullPage: true,
  });
  await capture("mobile");
  await page.setViewportSize({ width: 768, height: 1024 });
  await capture("tablet");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture("desktop");
  await page.goto("/study-areas");
  await expect(
    page.getByRole("heading", { name: "Áreas de estudio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No hay áreas que mostrar" }),
  ).toBeVisible();
  await capture("areas");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Nueva área" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Crear área", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Cerrar ventana" }),
  ).toBeFocused();
  await capture("area-form-mobile");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/help");
  await expect(
    page.getByRole("heading", { name: "Ayuda", exact: true }),
  ).toBeVisible();
  await capture("help");
  await page.getByRole("link", { name: "Saltar al contenido" }).focus();
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Abrir navegación", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Browser flow passed: auth, reload, roles, profile, area, valid/invalid TIFF, single, v9 comparison, history, private PNG/PDF/JSON/TIFF/ZIP, failure, admin, mobile.",
  );
} finally {
  await browser.close();
}
