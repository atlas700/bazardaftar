import { T } from "gt-next";
import type { supplierTypes } from "@/domain/supplier";

export function SupplierType({ type }: { type: typeof supplierTypes[number] | null }) {
  return type === "individual" ? <T>Individual</T> : type === "business" ? <T>Business</T> : <T>Not specified</T>;
}
