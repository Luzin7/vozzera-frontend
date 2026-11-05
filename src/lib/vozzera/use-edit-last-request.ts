import { useCallback, useState } from "react";

export function useEditLastRequest() {
  const [request, setRequest] = useState(0);
  const requestEditLast = useCallback(() => setRequest((current) => current + 1), []);

  return { request, requestEditLast };
}
