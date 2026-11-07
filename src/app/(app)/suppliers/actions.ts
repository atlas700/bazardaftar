"use server";

import { actionFailure } from "@/diagnostics/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/auth/server";
import { manageSupplier, type SupplierState } from "@/db/suppliers";

export async function updateSupplier(_previous: SupplierState, formData: FormData): Promise<SupplierState> {
  let stage = "authentication";
  try {
    await requireSession();
    stage = "supplier-mutation";
    const operation = formData instanceof FormData ? formData.get("operation") : null;
    const result = await manageSupplier(operation === "create-supplier" || operation === "update-supplier" || operation === "deactivate-supplier" ? {
      operation, id: formData.get("supplierId"), name: formData.get("name"), phone: formData.get("phone"),
      location: formData.get("location"), type: ["", "unspecified"].includes(String(formData.get("type") ?? "")) ? null : formData.get("type"),
      notes: formData.get("notes"), paymentTerms: formData.get("paymentTerms"),
    } : null);
    if (result.status === "success") {
      stage = "refresh";
      revalidatePath("/suppliers");
      revalidatePath("/suppliers/[id]", "page");
    }
    return result;
  } catch (error) {
    return actionFailure("supplier_management_failed", stage, error);
  }
}
