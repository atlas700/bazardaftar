"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireSession } from "@/auth/server";
import { createPurchaseDraft, mutatePurchase, type PurchaseState } from "@/db/purchases";

function draftFields(formData: FormData, editing = false) {
  const keys = [...(editing ? ["savedItemId"] : []), "productId", "quantity", "quantityUnitId", "quantityBagWeightKg", "unitPrice", "priceUnitId", "priceBagWeightKg"];
  if (!(formData instanceof FormData)) return null;
  const columns = keys.map((key) => formData.getAll(key));
  const count = columns[0]?.length ?? 0;
  if (count === 0 || count > 100 || !columns.every((column) => column.length === count && column.every((value) => typeof value === "string"))) return null;
  return { supplierId: formData.get("supplierId"), warehouseId: formData.get("warehouseId"), currency: formData.get("currency"),
    items: Array.from({ length: count }, (_, index) => Object.fromEntries(keys.map((key, column) => [key,
      ["savedItemId", "quantityBagWeightKg", "priceBagWeightKg"].includes(key) ? columns[column][index] || null : columns[column][index],
    ]))),
  };
}

export async function createPurchase(_previous: PurchaseState, formData: FormData): Promise<PurchaseState> {
  let stage = "authentication";
  let result: PurchaseState;
  try {
    await requireSession();
    stage = "draft-creation";
    const draft = draftFields(formData);
    result = await createPurchaseDraft(draft ? { requestId: formData.get("requestId"), ...draft } : null);
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

export async function changePurchase(_previous: PurchaseState, formData: FormData): Promise<PurchaseState> {
  let stage = "authentication";
  let result: PurchaseState;
  try {
    await requireSession();
    stage = "lifecycle-mutation";
    const valid = formData instanceof FormData;
    const action = valid ? formData.get("action") : null;
    const draft = action === "edit" ? draftFields(formData, true) : null;
    result = await mutatePurchase(valid && (action !== "edit" || draft) ? { action, id: formData.get("id"), requestId: formData.get("requestId"),
      revision: Number(formData.get("revision")), ...(action === "edit" ? draft : { reason: formData.get("reason") }),
    } : null);
    if (result.status === "success") {
      stage = "refresh";
      revalidatePath("/purchases");
      revalidatePath(`/purchases/${result.purchaseId}`);
      revalidatePath(`/purchases/${result.purchaseId}/edit`);
    }
  } catch (error) {
    unstable_rethrow(error);
    const correlationId = randomUUID();
    console.error({ event: "purchase_mutation_failed", stage, correlationId });
    return { status: "error", correlationId };
  }
  if (result.status === "success") redirect(`/purchases/${result.purchaseId}`);
  return result;
}
