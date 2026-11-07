"use server";

import { actionFailure } from "@/diagnostics/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/auth/server";
import { acceptReceipt, type ReceiptState } from "@/db/receipts";

function receiptFields(data: FormData) {
  const scalars = ["purchaseId", "requestId", "revision", "complete", "approveVariance", "reason"];
  if (!(data instanceof FormData) || scalars.some((key) => data.getAll(key).length > 1)) return null;
  const keys = ["purchaseItemId", "quantity", "quantityUnitId", "bagWeightKg"];
  const columns = keys.map((key) => data.getAll(key));
  const count = columns[0].length;
  if (!count || count > 100 || !columns.every((column) => column.length === count && column.every((value) => typeof value === "string"))) return null;
  return { purchaseId: data.get("purchaseId"), requestId: data.get("requestId"), revision: Number(data.get("revision")),
    complete: data.get("complete") === "on", approveVariance: data.get("approveVariance") === "on", reason: data.get("reason") ?? "",
    items: Array.from({ length: count }, (_, index) => ({ purchaseItemId: columns[0][index], quantity: columns[1][index],
      quantityUnitId: columns[2][index], bagWeightKg: columns[3][index] || null })).filter((item) => item.quantity !== ""),
  };
}

export async function receivePurchase(_previous: ReceiptState, formData: FormData): Promise<ReceiptState> {
  let stage = "authentication";
  let result: ReceiptState;
  try {
    await requireSession();
    stage = "receipt-posting";
    result = await acceptReceipt(receiptFields(formData));
    if (result.status === "success") {
      stage = "refresh";
      revalidatePath("/purchases");
      revalidatePath("/inventory");
      revalidatePath(`/purchases/${result.purchaseId}`);
      revalidatePath(`/purchases/${result.purchaseId}/receive`);
    }
  } catch (error) {
    return actionFailure("receipt_acceptance_failed", stage, error);
  }
  if (result.status === "success") redirect(`/purchases/${result.purchaseId}#receipt-${result.receiptId}`);
  return result;
}
