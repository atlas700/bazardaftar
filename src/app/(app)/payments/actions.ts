"use server";

import { actionFailure } from "@/diagnostics/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/auth/server";
import { recordSupplierPayment, reduceSupplierPayable, type PaymentState } from "@/db/supplier-payments";

async function postSettlement(data: FormData, reduction: boolean): Promise<PaymentState> {
  let result: PaymentState;
  let stage = "authentication";
  try {
    await requireSession(); stage = reduction ? "rounding-reduction" : "supplier-payment";
    const keys = reduction ? ["requestId", "paymentId", "payableId", "amount", "reason", "approved"]
      : ["requestId", "supplierId", "debtCurrency", "paidOn", "afnCash", "pkrCash", "pkrPerAfn", "reference", "note"];
    const fields = data instanceof FormData && keys.every((key) => data.getAll(key).length <= 1)
      ? Object.fromEntries(keys.map((key) => [key, key === "approved" ? data.get(key) === "on" : ["pkrPerAfn", "reference", "note"].includes(key) ? data.get(key) ?? "" : data.get(key)])) : null;
    result = await (reduction ? reduceSupplierPayable(fields) : recordSupplierPayment(fields));
    if (result.status === "success") {
      stage = "refresh";
      for (const path of ["/payments", "/payments/new", "/payments/rounding", "/suppliers", `/suppliers/${result.supplierId}`]) revalidatePath(path);
    }
  } catch (error) {
    return actionFailure("supplier_settlement_failed", stage, error);
  }
  if (result.status === "success") redirect(`/payments?supplierId=${result.supplierId}&currency=${result.currency}#payment-${result.paymentId}`);
  return result;
}

export async function recordSupplierCash(_previous: PaymentState, data: FormData): Promise<PaymentState> { return postSettlement(data, false); }
export async function approveSupplierRounding(_previous: PaymentState, data: FormData): Promise<PaymentState> { return postSettlement(data, true); }
