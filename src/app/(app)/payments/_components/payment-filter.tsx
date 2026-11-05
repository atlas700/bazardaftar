"use client";

import { T } from "gt-next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PaymentFilter({ suppliers, supplierId, currency, action = "/payments" }: {
  suppliers: { id: string; name: string; isActive: boolean }[]; supplierId?: string; currency: string; action?: string;
}) {
  const [selection, setSelection] = useState({ supplierId: supplierId ?? "", currency });
  const selected = suppliers.find((supplier) => supplier.id === selection.supplierId);
  return <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-end">
    <Field className="sm:min-w-0 sm:flex-1"><FieldLabel htmlFor="payment-supplier"><T>Supplier</T></FieldLabel>
      <Select name="supplierId" value={selection.supplierId} onValueChange={(supplierId) => setSelection((value) => ({ ...value, supplierId }))} required>
        <SelectTrigger id="payment-supplier" className="[&>span]:min-w-0 [&>span]:whitespace-normal [&>span]:[overflow-wrap:anywhere]"><SelectValue placeholder={<T>Select a supplier</T>}>{selected && <bdi dir="auto">{selected.name}</bdi>}</SelectValue></SelectTrigger>
        <SelectContent className="max-w-[calc(100vw-2rem)]">{suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id} className="[&>span]:[overflow-wrap:anywhere]"><bdi dir="auto">{supplier.name}</bdi>{!supplier.isActive && <> — <T>Inactive</T></>}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <Field><FieldLabel htmlFor="payment-currency"><T>Debt currency</T></FieldLabel>
      <Select name="currency" value={selection.currency} onValueChange={(currency) => setSelection((value) => ({ ...value, currency }))}><SelectTrigger id="payment-currency"><SelectValue>{selection.currency}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value="AFN">AFN</SelectItem><SelectItem value="PKR">PKR</SelectItem></SelectContent>
      </Select>
    </Field>
    <Button type="submit" variant="outline"><T>Show supplier</T></Button>
  </form>;
}
