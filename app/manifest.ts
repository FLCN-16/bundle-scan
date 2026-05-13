import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bundle Scan",
    short_name: "BundleScan",
    description: "Analyze bundle size, security vulnerabilities, and dependency composition for npm, PyPI, and Maven packages.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#6366f1",
    categories: ["developer tools", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/desktop.png",
        sizes: "1280x720",
        type: "image/png",
        // @ts-ignore — form_factor is valid in the manifest spec
        form_factor: "wide",
      },
    ],
  };
}
