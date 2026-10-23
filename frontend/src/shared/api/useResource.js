import { useEffect, useState } from "react";
import { request } from "./client";

// Each mounted view owns its query. Keyed results never show another resource's data.
export function useResource(path, { poll = false } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({});
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let timer;
    async function load() {
      try {
        const data = await request(path, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({ path, revision, data });
        if (poll && ["queued", "running"].includes(data.status))
          timer = setTimeout(load, 5000);
      } catch (error) {
        if (!controller.signal.aborted) setState({ path, revision, error });
      }
    }
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, revision, poll]);
  const current = state.path === path && state.revision === revision;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    loading: !!path && !current,
    reload: () => setRevision((v) => v + 1),
  };
}
export async function allPages(path, signal) {
  const rows = [];
  while (path) {
    const data = await request(path, { signal });
    rows.push(...data.results);
    path = data.next;
  }
  return rows;
}
