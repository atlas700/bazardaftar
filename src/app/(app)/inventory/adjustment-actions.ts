"use server";

import { actionFailure } from "@/diagnostics/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/auth/server";
import { adjustInventory, type AdjustmentState } from "@/db/inventory-adjustments";

function adjustmentFields(data: FormData) {
  const keys = ["requestId", "productId", "warehouseId", "quantityKg", "reasonCode", "reason", "reference", "approved"];
  if (!(data instanceof FormData) || keys.some((key) => data.getAll(key).length > 1)) return null;
  return { requestId: data.get("requestId"), productId: data.get("productId"), warehouseId: data.get("warehouseId"), quantityKg: data.get("quantityKg"),
    reasonCode: data.get("reasonCode"), reason: data.get("reason"), reference: data.get("reference") ?? "", approved: data.get("approved") === "on" };
}

export async function recordAdjustment(_previous: AdjustmentState, formData: FormData): Promise<AdjustmentState> {
  let result: AdjustmentState;
  let stage = "authentication";
  try {
    await requireSession(); stage = "inventory-adjustment";
    result = await adjustInventory(adjustmentFields(formData));
    if (result.status === "success") { stage = "refresh"; revalidatePath("/inventory"); }
  } catch (error) {
    return actionFailure("inventory_adjustment_failed", stage, error);
  }
  if (result.status === "success") redirect(`/inventory?productId=${result.productId}#movement-${result.movementId}`);
  return result;
}
