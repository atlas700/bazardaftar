"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireSession } from "@/auth/server";
import { createPurchaseDraft, type PurchaseState } from "@/db/purchases";

export async function createPurchase(_previous: PurchaseState, formData: FormData): Promise<PurchaseState> {
  let stage = "authentication";
  let result: PurchaseState;
  try {
    await requireSession();
    stage = "draft-creation";
    const keys = ["productId", "quantity", "quantityUnitId", "quantityBagWeightKg", "unitPrice", "priceUnitId", "priceBagWeightKg"] as const;
    const columns = formData instanceof FormData ? keys.map((key) => formData.getAll(key)) : [];
    const count = columns[0]?.length ?? 0;
    const valid = count > 0 && count <= 100 && columns.every((column) => column.length === count && column.every((value) => typeof value === "string"));
    result = await createPurchaseDraft(valid ? {
      requestId: formData.get("requestId"), supplierId: formData.get("supplierId"), warehouseId: formData.get("warehouseId"), currency: formData.get("currency"),
      items: Array.from({ length: count }, (_, index) => Object.fromEntries(keys.map((key, column) => [key,
        key === "quantityBagWeightKg" || key === "priceBagWeightKg" ? columns[column][index] || null : columns[column][index],
      ]))),
    } : null);
    if (result.status === "success") { stage = "refresh"; revalidatePath("/purchases"); }
  } catch (error) {
    unstable_rethrow(error);
    const correlationId = randomUUID();
    console.error({ event: "purchase_draft_failed", stage, correlationId });
    return { status: "error", correlationId };
  }
  if (result.status === "success") redirect(`/purchases/${result.purchaseId}`);
  return result;
}
