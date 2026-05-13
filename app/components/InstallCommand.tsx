"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Tab = { label: string; command: string };

function mavenXml(groupId: string, artifactId: string, version: string) {
  return `<dependency>
  <groupId>${groupId}</groupId>
  <artifactId>${artifactId}</artifactId>
  <version>${version}</version>
</dependency>`;
}

function gradleKts(groupId: string, artifactId: string, version: string) {
  return `implementation("${groupId}:${artifactId}:${version}")`;
}

function getTabs(
  registry: "npm" | "pypi" | "maven",
  name: string,
  version: string,
): Tab[] {
  if (registry === "npm") {
    return [
      { label: "npm", command: `npm install ${name}@${version}` },
      { label: "pnpm", command: `pnpm add ${name}@${version}` },
      { label: "yarn", command: `yarn add ${name}@${version}` },
      { label: "bun", command: `bun add ${name}@${version}` },
    ];
  }
  if (registry === "pypi") {
    return [
      { label: "pip", command: `pip install ${name}==${version}` },
      { label: "uv", command: `uv add ${name}==${version}` },
    ];
  }
  // maven — name is "groupId:artifactId"
  const [groupId = name, artifactId = name] = name.split(":");
  return [
    { label: "Maven", command: mavenXml(groupId, artifactId, version) },
    { label: "Gradle (KTS)", command: gradleKts(groupId, artifactId, version) },
  ];
}

export function InstallCommand({
  registry,
  name,
  version,
}: {
  registry: "npm" | "pypi" | "maven";
  name: string;
  version: string;
}) {
  const tabs = getTabs(registry, name, version);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const current = tabs[active]!;
  const isMultiline = current.command.includes("\n");

  function copy() {
    navigator.clipboard.writeText(current.command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="rounded-xl border border-black/7 dark:border-white/8 overflow-hidden bg-slate-950/[0.03] dark:bg-black/30">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-2 pt-2 border-b border-black/6 dark:border-white/7 bg-white/60 dark:bg-white/3">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors select-none ${
              i === active
                ? "bg-slate-900 dark:bg-white/10 text-white dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Command area */}
      <div className="relative group px-4 py-3">
        <pre className={`font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all leading-relaxed ${isMultiline ? "pr-8" : "pr-8 truncate"}`}>
          {current.command}
        </pre>
        <button
          onClick={copy}
          aria-label="Copy"
          className="absolute top-2.5 right-2.5 p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/8 transition-all"
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
