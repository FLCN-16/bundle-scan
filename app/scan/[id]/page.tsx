import { Suspense } from "react";
import { ScanPageClient } from "@/app/components/ScanPageClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan results — Bundle Scan",
  description: "Vulnerability scan results for your dependency file.",
};

async function ScanClientWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScanPageClient id={id} />;
}

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="flex-1">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Suspense>
          <ScanClientWrapper params={params} />
        </Suspense>
      </div>
    </main>
  );
}
