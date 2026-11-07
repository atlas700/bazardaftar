"use server";

import { actionFailure } from "@/diagnostics/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/auth/server";
import { manageWarehouse, type WarehouseState } from "@/db/warehouses";

export async function updateWarehouse(_previous: WarehouseState, formData: FormData): Promise<WarehouseState> {
  let stage = "authentication";
  try {
    await requireSession();
    stage = "warehouse-mutation";
    const operation = formData instanceof FormData ? formData.get("operation") : null;
    const result = await manageWarehouse(operation === "create-warehouse" || operation === "update-warehouse" ||
      operation === "deactivate-warehouse" || operation === "activate-warehouse" ? {
        operation, id: formData.get("warehouseId"), name: formData.get("name"), location: formData.get("location"),
      } : null);
    if (result.status === "success") {
      stage = "refresh";
      revalidatePath("/settings/warehouse");
    }
    return result;
  } catch (error) {
    return actionFailure("warehouse_management_failed", stage, error);
  }
}
