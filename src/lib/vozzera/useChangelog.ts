import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import {
  changelogSchema,
  readSeenRelease,
  shouldShowChangelog,
  writeSeenRelease,
} from "@/lib/vozzera/changelog";
import type { Changelog } from "@/lib/vozzera/changelog";

const CHANGELOG_PATH = "/changelog.json";

function changelogStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

async function fetchChangelog(): Promise<Changelog | null> {
  const res = await fetch(CHANGELOG_PATH);

  if (!res.ok) return null;

  const parsed = changelogSchema.safeParse(await res.json().catch(() => null));

  return parsed.success ? parsed.data : null;
}

export function useChangelog(enabled: boolean) {
  const [seen, setSeen] = useState<string | null>(null);

  useEffect(() => {
    setSeen(readSeenRelease(changelogStorage()));
  }, []);

  const query = useQuery({
    queryKey: ["changelog"],
    queryFn: fetchChangelog,
    staleTime: Infinity,
    retry: false,
    enabled,
  });

  const dismiss = useCallback(() => {
    const changelog = query.data ?? null;

    if (changelog === null) return;

    writeSeenRelease(changelogStorage(), changelog.version);
    setSeen(changelog.version);
  }, [query.data]);

  return {
    changelog: query.data ?? null,
    shouldShow: shouldShowChangelog(query.data ?? null, seen),
    dismiss,
  };
}
