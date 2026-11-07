"use server";

import { actionFailure } from "@/diagnostics/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/auth/server";
import { manageCatalog, type CatalogState } from "@/db/catalog";

export async function updateCatalog(_previous: CatalogState, formData: FormData): Promise<CatalogState> {
  let stage = "authentication";
  try {
    await requireSession();
    stage = "catalogue-mutation";
    const operation = formData instanceof FormData ? formData.get("operation") : null;
    const result = await manageCatalog(typeof operation === "string" && ["seed-units", "create-unit", "update-unit",
      "deactivate-unit", "create-category", "update-category", "deactivate-category"].includes(operation) ? {
      operation, id: formData.get("id"), name: formData.get("name"),
      unit: { kind: formData.get("kind"), kilogramsPerUnit: formData.get("kind") === "bag" ? null : formData.get("kilogramsPerUnit") },
    } : null);
    if (result.status === "success") {
      stage = "refresh";
      revalidatePath("/settings/catalog");
      revalidatePath("/products");
      revalidatePath("/products/[id]", "page");
    }
    return result;
  } catch (error) {
    return actionFailure("catalogue_management_failed", stage, error);
  }
}
