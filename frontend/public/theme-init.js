// Apply the saved preference before the stylesheet paints, including on reload.
(() => {
  let theme = "dark";
  try {
    if (localStorage.getItem("forestguard-theme") === "light") theme = "light";
  } catch {
    /* The default remains usable when storage is unavailable. */
  }
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#f3f6f4" : "#0b1728");
})();
