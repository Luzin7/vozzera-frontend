import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ChangelogLoadError,
  changelogSchema,
  readSeenRelease,
  unseenReleases,
  writeSeenRelease,
} from "@/lib/vozzera/changelog";
import type { Changelog } from "@/lib/vozzera/changelog";

const CHANGELOG_PATH = "/changelog.json";

function changelogStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

async function fetchChangelog(): Promise<Changelog> {
  const res = await fetch(CHANGELOG_PATH);

  if (!res.ok) throw new ChangelogLoadError();

  const parsed = changelogSchema.safeParse(await res.json().catch(() => null));

  if (!parsed.success) throw new ChangelogLoadError();

  return parsed.data;
}

export function useChangelogQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["changelog"],
    queryFn: fetchChangelog,
    staleTime: Infinity,
    retry: false,
    enabled,
  });
}

export function useChangelog(enabled: boolean) {
  const [seen, setSeen] = useState<string | null>(null);

  useEffect(() => {
    setSeen(readSeenRelease(changelogStorage()));
  }, []);

  const query = useChangelogQuery(enabled);

  const dismiss = useCallback(() => {
    const changelog = query.data ?? null;

    if (changelog === null) return;

    writeSeenRelease(changelogStorage(), changelog.version);
    setSeen(changelog.version);
  }, [query.data]);

  const releases = useMemo(() => unseenReleases(query.data ?? null, seen), [query.data, seen]);

  return {
    changelog: query.data ?? null,
    releases,
    shouldShow: releases.length > 0,
    dismiss,
  };
}
