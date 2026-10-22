import test from "node:test";
import assert from "node:assert/strict";
const storage = new Map();
globalThis.sessionStorage = {
  getItem: (k) => storage.get(k),
  setItem: (k, v) => storage.set(k, v),
  removeItem: (k) => storage.delete(k),
};
globalThis.window = { location: { origin: "http://localhost:5173" } };
const { login, request, clearSession, refreshSession, apiUrl } =
  await import("../src/shared/api/client.js");
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status });
test("normalizes artifact links without forwarding credentials to foreign origin", () => {
  assert.equal(
    apiUrl("http://127.0.0.1:8000/api/v1/artifacts/9/download/"),
    "http://localhost:5173/api/v1/artifacts/9/download/",
  );
  assert.throws(() => apiUrl("https://external.test/private"));
});
test("concurrent expired requests rotate refresh only once and retry", async () => {
  clearSession();
  let rotations = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/token/")) return json({ access: "old", refresh: "r1" });
    if (url.endsWith("/refresh/")) {
      rotations++;
      await new Promise((r) => setTimeout(r, 20));
      return json({ access: "new", refresh: "r2" });
    }
    return options.headers.get("Authorization") === "Bearer new"
      ? json({ id: 1 })
      : json({ detail: "expired" }, 401);
  };
  await login({ username: "test", password: "test" });
  assert.deepEqual(
    await Promise.all([request("auth/me/"), request("auth/me/")]),
    [{ id: 1 }, { id: 1 }],
  );
  assert.equal(rotations, 1);
  assert.equal(storage.get("forestguard.refresh"), "r2");
});
test("failed refresh clears persisted credentials", async () => {
  globalThis.fetch = async () => json({ detail: "invalid" }, 401);
  await assert.rejects(refreshSession());
  assert.equal(storage.size, 0);
});
test("logout/session clear during rotation cannot restore a stale session", async () => {
  storage.set("forestguard.refresh", "r1");
  let finish;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = refreshSession();
  clearSession();
  finish(json({ access: "old", refresh: "old" }));
  assert.equal(await pending, false);
  assert.equal(storage.size, 0);
});
