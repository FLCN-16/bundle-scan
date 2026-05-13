"use server";

import { aggregateSecurity } from "@/lib/security/aggregate";
import type { SecurityResult } from "@/lib/types";

export async function fetchSecurity(
  name: string,
  ecosystem: string,
  version: string
): Promise<SecurityResult> {
  return aggregateSecurity(name, ecosystem, version);
}
