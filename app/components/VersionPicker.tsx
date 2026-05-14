"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export function VersionPicker({
  registry,
  name,
  currentVersion,
  allVersions: initialVersions,
}: {
  registry: string;
  name: string;
  currentVersion: string;
  allVersions: string[];
}) {
  const router = useRouter();
  const [versions, setVersions] = useState<string[]>(
    initialVersions.length ? initialVersions : [currentVersion]
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (initialVersions.length > 1) return;
    if (registry !== "npm" && registry !== "pypi") return;
    const encoded = encodeURIComponent(name).replace(/%40/g, "@").replace(/%2F/g, "/");
    fetch(`/api/versions/${registry}?name=${encoded}`)
      .then((r) => r.json())
      .then((data: { versions: string[] }) => {
        if (data.versions.length) setVersions(data.versions);
      })
      .catch(() => {});
  }, [registry, name, initialVersions]);

  const encoded = encodeURIComponent(name).replace(/%40/g, "@").replace(/%2F/g, "/");

  const filtered = query
    ? versions.filter((v) => v.includes(query))
    : versions;

  function pick(value: string | null) {
    if (!value) return;
    setQuery("");
    router.push(`/${registry}/${encoded}@${value}`);
  }

  return (
    <div className="flex items-center gap-2.5">
      <label className="text-xs text-slate-400 dark:text-slate-500 shrink-0 select-none font-medium">
        Version
      </label>

      <Combobox
        value={currentVersion}
        onValueChange={pick}
        modal={false}
      >
        <ComboboxInput
          placeholder="Search versions…"
          showTrigger
          showClear={false}
          className="h-8 w-44 font-mono text-body-sm"
          value={query}
          onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <ComboboxContent align="end" sideOffset={6}>
          <ComboboxList>
            {filtered.map((item) => (
              <ComboboxItem key={item} value={item} className="font-mono text-xs">
                {item}
              </ComboboxItem>
            ))}
          </ComboboxList>
          {filtered.length === 0 && <ComboboxEmpty>No versions found</ComboboxEmpty>}
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
