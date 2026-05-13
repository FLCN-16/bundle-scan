import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Package } from "lucide-react";
import { VscodeBanner } from "@/app/components/VscodeBanner";
import { ServiceWorker } from "@/app/components/ServiceWorker";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bundle Scan — Package size & security scanner",
  description: "Analyze bundle size, security vulnerabilities, and dependency composition for npm, PyPI, and Maven packages.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bundle Scan",
  },
  openGraph: {
    title: "Bundle Scan",
    description: "Bundle size + security scanning for npm, PyPI & Maven",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased text-slate-900 dark:text-surface-text">

        <ServiceWorker />
        <VscodeBanner />

        {/* Ambient background */}
        <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-surface-base dark:bg-surface-dark" />
          <div className="absolute -top-[30%] left-1/2 -translate-x-[60%] w-[900px] h-[600px] rounded-full bg-gradient-to-b from-indigo-300/25 via-violet-200/15 to-transparent dark:from-indigo-700/20 dark:via-violet-700/10 dark:to-transparent blur-[140px]" />
          <div className="absolute top-[60%] -right-[10%] w-[500px] h-[500px] rounded-full bg-violet-200/20 dark:bg-violet-900/10 blur-[100px]" />
          <div className="absolute top-[30%] -left-[5%] w-[300px] h-[300px] rounded-full bg-sky-200/15 dark:bg-sky-900/8 blur-[80px]" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-black/3 dark:border-white/3 bg-white/20 dark:bg-surface-dark/30 backdrop-blur-3xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between">

            <a href="/" className="flex items-center gap-2.5 group">
              <div className="size-7 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25 flex-shrink-0">
                <Package className="size-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-body-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight group-hover:opacity-70 transition-opacity">
                Bundle Scan
              </span>
            </a>

            <nav className="flex items-center">
              <a
                href="https://github.com/FLCN-16/bundle-scan"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center size-8 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
                aria-label="GitHub repository"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
                </svg>
              </a>
            </nav>

          </div>
        </header>

        {children}

      </body>
    </html>
  );
}
