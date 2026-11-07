"use server";

import { actionFailure } from "@/diagnostics/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/auth/server";
import { manageCatalog, type CatalogState } from "@/db/catalog";
import { NO_CATEGORY_VALUE } from "./no-category";

export async function updateProduct(_previous: CatalogState, formData: FormData): Promise<CatalogState> {
  let stage = "authentication";
  try {
    await requireSession();
    stage = "product-mutation";
    const operation = formData instanceof FormData ? formData.get("operation") : null;
    const result = await manageCatalog(operation === "create-product" || operation === "update-product" || operation === "deactivate-product" ? {
      operation, id: formData.get("id"), name: formData.get("name"), sku: formData.get("sku"),
      unitId: formData.get("unitId"), categoryId: ["", NO_CATEGORY_VALUE].includes(String(formData.get("categoryId") ?? "")) ? null : formData.get("categoryId"),
    } : null);
    if (result.status === "success") {
      stage = "refresh";
      revalidatePath("/products");
      revalidatePath("/products/[id]", "page");
    }
    return result;
  } catch (error) {
    return actionFailure("product_management_failed", stage, error);
  }
}
