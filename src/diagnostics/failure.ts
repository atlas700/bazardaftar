export const REQUEST_ID_HEADER = "x-bazardaftar-request-id";

export type FailureState = { status: "error"; correlationId: string };

// Next generates numeric server-error digests. Never display arbitrary error text.
export function errorReference(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) return;
  return typeof error.digest === "string" && /^\d{1,20}$/.test(error.digest) ? error.digest : undefined;
}
