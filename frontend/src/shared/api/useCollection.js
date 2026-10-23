import { useEffect, useState } from "react";
import { allPages } from "./useResource";
// Small reference catalogs (areas and active models), not images or analyses.
export function useCollection(path) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    allPages(path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, path, revision });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ error, path, revision });
      });
    return () => controller.abort();
  }, [path, revision]);
  const current = state.path === path && state.revision === revision;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    reload: () => setRevision((v) => v + 1),
  };
}
