"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { T, Var, useGT } from "gt-next";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordAdjustment } from "../../adjustment-actions";

export function AdjustmentForm({ products, warehouse, requestId }: {
  products: { id: string; name: string }[]; warehouse: { id: string; name: string }; requestId: string;
}) {
  const gt = useGT();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const [retryId] = useState(requestId);
  const [values, setValues] = useState({ productId: products[0]?.id ?? "", quantityKg: "", reasonCode: "count_correction", reason: "", reference: "", approved: false });
  const [state, action, pending] = useActionState(recordAdjustment, { status: "idle" });
  useEffect(() => {
    const element = form.current;
    // Retain controlled fields and Radix selections after a rejected action's native reset.
    const retain = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    element?.addEventListener("reset", retain, true);
    return () => element?.removeEventListener("reset", retain, true);
  }, []);
  useEffect(() => { if (state.status !== "idle" && state.status !== "success") feedback.current?.focus(); }, [state]);
  const invalid = (field: string) => state.status === "invalid" && state.fields.includes(field);
  const labels = { productId: gt("Product"), quantityKg: gt("Change in kg"), reasonCode: gt("Adjustment type"), reason: gt("Reason"), reference: gt("Reference"), approved: gt("Owner approval") };
  const reasonTypes = [{ value: "opening_stock", label: gt("Opening stock") }, { value: "loss", label: gt("Loss") },
    { value: "spoilage", label: gt("Spoilage") }, { value: "count_correction", label: gt("Count correction") }];
  return <form ref={form} action={action} aria-busy={pending} className="space-y-6" onSubmit={(event) => {
    if (!window.confirm(gt("Record this stock adjustment? Review the product, signed weight and reason before confirming."))) event.preventDefault();
  }}>
    <input type="hidden" name="requestId" value={retryId} /><input type="hidden" name="warehouseId" value={warehouse.id} />
    {state.status !== "idle" && state.status !== "success" && <div ref={feedback} tabIndex={-1} role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 outline-offset-4">
      {state.status === "invalid" && <><p><T>Check the marked fields and confirm the product and warehouse are still active.</T></p>
        {Object.entries(labels).filter(([field]) => invalid(field)).map(([field, label]) => <a key={field} href={`#${id}-${field}`} className="flex min-h-11 items-center underline underline-offset-2">{label}</a>)}
        {state.fields.includes("references") && <a href="/inventory/adjust" className="flex min-h-11 items-center underline"><T>Reload active products and warehouse.</T></a>}
      </>}
      {state.status === "insufficient_stock" && <p><T>This deduction exceeds recorded stock. Check the physical count and missing receipts, then correct the quantity. Negative stock is never allowed.</T></p>}
      {state.status === "conflict" && <p><T>This request was already used with different details. Check inventory before starting a new adjustment.</T></p>}
      {state.status === "error" && <p><T>Recording could not be confirmed. Retry with the same details or check inventory before starting again. Reference: <Var>{state.correlationId}</Var></T></p>}
      <a href="/inventory" className="inline-flex min-h-11 items-center text-primary underline"><T>Check inventory</T></a>
    </div>}
    <p className="text-sm leading-6 text-ink-muted [overflow-wrap:anywhere]"><T>Warehouse:</T> <bdi dir="auto">{warehouse.name}</bdi></p>
    <fieldset disabled={pending} className="min-w-0 space-y-5 disabled:opacity-60">
      <legend className="sr-only"><T>Stock adjustment details</T></legend>
      <Field data-invalid={invalid("productId")}><FieldLabel htmlFor={`${id}-productId`}><T>Product</T> *</FieldLabel>
        <input type="hidden" name="productId" value={values.productId} />
        <Select value={values.productId} disabled={pending} onValueChange={(productId) => setValues((v) => ({ ...v, productId }))}>
          <SelectTrigger id={`${id}-productId`} className="[&>span]:min-w-0 [&>span]:whitespace-normal [&>span]:[overflow-wrap:anywhere]" aria-invalid={invalid("productId")} aria-describedby={invalid("productId") ? `${id}-product-error` : undefined}><SelectValue><bdi dir="auto">{products.find((product) => product.id === values.productId)?.name}</bdi></SelectValue></SelectTrigger>
          <SelectContent className="max-w-[calc(100vw-2rem)]">{products.map((product) => <SelectItem key={product.id} value={product.id} className="[&>span]:min-w-0 [&>span]:[overflow-wrap:anywhere]">{product.name}</SelectItem>)}</SelectContent>
        </Select>
        {invalid("productId") && <FieldError id={`${id}-product-error`}><T>Select an active product.</T></FieldError>}
      </Field>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <Field data-invalid={invalid("reasonCode")}><FieldLabel htmlFor={`${id}-reasonCode`}><T>Adjustment type</T> *</FieldLabel>
          <input type="hidden" name="reasonCode" value={values.reasonCode} />
          <Select value={values.reasonCode} disabled={pending} onValueChange={(reasonCode) => setValues((v) => ({ ...v, reasonCode }))}>
            <SelectTrigger id={`${id}-reasonCode`} aria-invalid={invalid("reasonCode")} aria-describedby={invalid("reasonCode") ? `${id}-type-error` : undefined}><SelectValue>{reasonTypes.find((type) => type.value === values.reasonCode)?.label}</SelectValue></SelectTrigger>
            <SelectContent>{reasonTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
          </Select>
          {invalid("reasonCode") && <FieldError id={`${id}-type-error`}><T>Select an adjustment type.</T></FieldError>}
        </Field>
        <Field data-invalid={invalid("quantityKg") || state.status === "insufficient_stock"}><FieldLabel htmlFor={`${id}-quantityKg`}><T>Change in kg</T> *</FieldLabel>
          <Input id={`${id}-quantityKg`} name="quantityKg" dir="ltr" required maxLength={23} value={values.quantityKg} onChange={(e) => setValues((v) => ({ ...v, quantityKg: e.target.value }))}
            aria-invalid={invalid("quantityKg") || state.status === "insufficient_stock"} aria-describedby={`${id}-quantity-help${invalid("quantityKg") ? ` ${id}-quantity-error` : ""}`} />
          <p id={`${id}-quantity-help`} className="text-sm leading-6 text-ink-muted"><T>Use a minus sign for loss or spoilage, for example -1.250. Opening stock must be positive. Count corrections may add or deduct. Use at most three decimals; zero is not accepted.</T></p>
          {invalid("quantityKg") && <FieldError id={`${id}-quantity-error`}><T>Check the sign, gram precision and supported weight.</T></FieldError>}
        </Field>
      </div>
      <Field data-invalid={invalid("reason")}><FieldLabel htmlFor={`${id}-reason`}><T>Reason</T> *</FieldLabel>
        <Input id={`${id}-reason`} name="reason" required maxLength={500} value={values.reason} onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))}
          aria-invalid={invalid("reason")} aria-describedby={invalid("reason") ? `${id}-reason-error` : undefined} />
        {invalid("reason") && <FieldError id={`${id}-reason-error`}><T>Enter a reason using 1–500 characters.</T></FieldError>}
      </Field>
      <Field data-invalid={invalid("reference")}><FieldLabel htmlFor={`${id}-reference`}><T>Reference (optional)</T></FieldLabel>
        <Input id={`${id}-reference`} name="reference" maxLength={100} value={values.reference} onChange={(e) => setValues((v) => ({ ...v, reference: e.target.value }))}
          aria-invalid={invalid("reference")} aria-describedby={invalid("reference") ? `${id}-reference-error` : undefined} />
        {invalid("reference") && <FieldError id={`${id}-reference-error`}><T>Use at most 100 characters.</T></FieldError>}
      </Field>
      <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input id={`${id}-approved`} type="checkbox" name="approved" required checked={values.approved} onChange={(e) => setValues((v) => ({ ...v, approved: e.target.checked }))}
        aria-invalid={invalid("approved")} aria-describedby={invalid("approved") ? `${id}-approval-error` : undefined} className="mt-1 size-5 accent-primary" /><span><T>As owner, I approve this stock adjustment.</T></span></label>
      {invalid("approved") && <FieldError id={`${id}-approval-error`}><T>Explicit owner approval is required.</T></FieldError>}
      <p className="text-sm leading-6 text-ink-muted"><T>Negative stock is never allowed. Saved movements remain in history; check every detail before recording.</T></p>
      <Button type="submit">{pending ? <T>Recording adjustment…</T> : <T>Record stock adjustment</T>}</Button>
      {pending && <p role="status" className="text-sm text-ink-muted"><T>Recording the owner-approved stock change…</T></p>}
    </fieldset>
  </form>;
}
