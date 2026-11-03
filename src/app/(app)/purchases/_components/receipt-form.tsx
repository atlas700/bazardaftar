"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { T, Var, useGT } from "gt-next";
import type { getPurchase } from "@/db/purchases";
import type { getReceiptUnits } from "@/db/receipts";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { receivePurchase } from "../receipt-actions";
import { PurchaseNumber } from "./purchase-number";

type Purchase = Pick<Awaited<ReturnType<typeof getPurchase>>, "id" | "revision" | "canApproveVariance"> & {
  items: Pick<Awaited<ReturnType<typeof getPurchase>>["items"][number], "id" | "productName" | "quantityKg" | "receivedQuantityKg" | "quantityUnitId" | "quantityUnitName" | "quantityUnitKind" | "quantityMeasureKg">[];
};

export function ReceiptForm({ purchase, units, requestId }: { purchase: Purchase; units: Awaited<ReturnType<typeof getReceiptUnits>>; requestId: string }) {
  const gt = useGT();
  const id = useId();
  const feedback = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [retryId] = useState(requestId);
  const [rows, setRows] = useState(purchase.items.map((item) => ({ purchaseItemId: item.id, quantity: "", quantityUnitId: item.quantityUnitId, bagWeightKg: item.quantityUnitKind === "bag" ? item.quantityMeasureKg : "" })));
  const [complete, setComplete] = useState(false);
  const [approval, setApproval] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(receivePurchase, { status: "idle" });
  useEffect(() => {
    const element = form.current;
    // React's action reset runs with synthetic events disabled; retain controlled Radix selections natively.
    const retain = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    element?.addEventListener("reset", retain, true);
    return () => element?.removeEventListener("reset", retain, true);
  }, []);
  useEffect(() => { if (["invalid", "conflict", "error"].includes(state.status)) feedback.current?.focus(); }, [state]);
  const update = (index: number, changes: Partial<typeof rows[number]>) => setRows((previous) => previous.map((row, position) => position === index ? { ...row, ...changes } : row));
  const fieldError = (index: number, field: string) => {
    if (state.status !== "invalid") return false;
    const sentIndex = rows.filter((row) => row.quantity !== "").findIndex((row) => row.purchaseItemId === rows[index].purchaseItemId);
    return state.fields.includes(`items.${sentIndex}.${field}`);
  };
  const reasonInvalid = state.status === "invalid" && state.fields.includes("reason");
  return <form ref={form} action={action} onSubmit={(event) => {
    if (!window.confirm(gt("Accept this delivery? Stock and supplier debt will be recorded together."))) event.preventDefault();
  }} aria-busy={pending} className="space-y-7">
    <input type="hidden" name="purchaseId" value={purchase.id} /><input type="hidden" name="revision" value={purchase.revision} /><input type="hidden" name="requestId" value={retryId} />
    {state.status !== "idle" && state.status !== "success" && <div ref={feedback} tabIndex={-1} role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 outline-offset-4">
      {state.status === "invalid" && <>
        <p><T>Check the delivery quantities and active references. Excess quantities or a final short delivery require explicit owner approval and a reason.</T></p>
        {rows.map((row, index) => ["quantity", "quantityUnitId", "bagWeightKg"].filter((field) => fieldError(index, field)).map((field) => <a key={`${row.purchaseItemId}-${field}`} className="block underline underline-offset-2" href={`#${id}-${index}-${field}`}><bdi dir="auto">{purchase.items[index].productName}</bdi>: <T>Check this delivery field.</T></a>))}
        {reasonInvalid && <a className="block underline" href={`#${id}-reason`}><T>Enter the owner approval reason.</T></a>}
      </>}
      {state.status === "conflict" && <p><T>This purchase changed or no longer accepts receipts. Reload to review accepted deliveries before submitting again.</T></p>}
      {state.status === "error" && <p><T>Acceptance could not be confirmed. Retry with the same details or reload to check accepted deliveries. Reference: <Var>{state.correlationId}</Var></T></p>}
      <a href={`/purchases/${purchase.id}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-2"><T>Reload purchase</T></a>
    </div>}
    <p className="text-sm leading-6 text-ink-muted"><T>Enter only goods accepted now. Leave other lines blank. Saved purchase prices determine supplier debt; measure changes never reprice the agreement.</T></p>
    <fieldset disabled={pending} className="min-w-0 space-y-7 disabled:opacity-60">
      <legend className="sr-only"><T>Accepted goods</T></legend>
      {rows.map((row, index) => {
        const item = purchase.items[index];
        const selected = units.find((unit) => unit.id === row.quantityUnitId);
        const saved = row.quantityUnitId === item.quantityUnitId;
        const bag = (saved ? item.quantityUnitKind : selected?.kind) === "bag";
        const weight = saved ? item.quantityMeasureKg : selected?.kilogramsPerUnit;
        return <div key={item.id} className="min-w-0 space-y-4 border-b border-border/70 pb-6">
          <h2 className="break-words font-semibold"><bdi dir="auto">{item.productName}</bdi></h2>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div><dt className="text-ink-muted"><T>Ordered weight</T></dt><dd className="mt-1"><PurchaseNumber value={item.quantityKg} /> <T>kg</T></dd></div>
            <div><dt className="text-ink-muted"><T>Already accepted</T></dt><dd className="mt-1"><PurchaseNumber value={item.receivedQuantityKg} /> <T>kg</T></dd></div>
          </dl>
          <input type="hidden" name="purchaseItemId" value={item.id} />
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field data-invalid={fieldError(index, "quantity")}><FieldLabel htmlFor={`${id}-${index}-quantity`}><T>Quantity received</T></FieldLabel>
              <Input id={`${id}-${index}-quantity`} name="quantity" inputMode="decimal" value={row.quantity} maxLength={38} onChange={(event) => update(index, { quantity: event.target.value })}
                aria-invalid={fieldError(index, "quantity")} aria-describedby={`${id}-${index}-quantity-help`} />
              <p id={`${id}-${index}-quantity-help`} className="text-sm text-ink-muted">{fieldError(index, "quantity") ? <T>Use a positive quantity that converts to whole grams and stays within the supported amount.</T> : <T>Leave blank when none of this line arrived.</T>}</p>
            </Field>
            <Field data-invalid={fieldError(index, "quantityUnitId")}><FieldLabel htmlFor={`${id}-${index}-quantityUnitId`}><T>Received measure</T></FieldLabel>
              <input type="hidden" name="quantityUnitId" value={row.quantityUnitId} />
              <Select value={row.quantityUnitId} disabled={pending} onValueChange={(value) => update(index, { quantityUnitId: value, bagWeightKg: value === item.quantityUnitId && item.quantityUnitKind === "bag" ? item.quantityMeasureKg : "" })}>
                <SelectTrigger id={`${id}-${index}-quantityUnitId`} aria-invalid={fieldError(index, "quantityUnitId")} aria-describedby={fieldError(index, "quantityUnitId") ? `${id}-${index}-unit-error` : undefined}><SelectValue><bdi dir="auto" className="min-w-0 truncate">{saved ? item.quantityUnitName : selected?.name}{!selected && <> — {gt("Unavailable")}</>}</bdi></SelectValue></SelectTrigger>
                <SelectContent>
                  {!units.some((unit) => unit.id === item.quantityUnitId) && <SelectItem value={item.quantityUnitId}>{item.quantityUnitName} — {gt("Unavailable")}</SelectItem>}
                  {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.id === item.quantityUnitId ? item.quantityUnitName : unit.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {fieldError(index, "quantityUnitId") && <FieldError id={`${id}-${index}-unit-error`}><T>Select an active measure.</T></FieldError>}
              {!bag && weight && <p className="text-sm text-ink-muted"><PurchaseNumber value={weight} /> <T>kg per measure</T></p>}
            </Field>
            {bag ? <Field data-invalid={fieldError(index, "bagWeightKg")}><FieldLabel htmlFor={`${id}-${index}-bagWeightKg`}><T>Actual kg per bag</T></FieldLabel>
              <Input id={`${id}-${index}-bagWeightKg`} name="bagWeightKg" inputMode="decimal" value={row.bagWeightKg} onChange={(event) => update(index, { bagWeightKg: event.target.value })} maxLength={22} required={row.quantity !== ""}
                aria-invalid={fieldError(index, "bagWeightKg")} aria-describedby={fieldError(index, "bagWeightKg") ? `${id}-${index}-bag-error` : undefined} />
              {fieldError(index, "bagWeightKg") && <FieldError id={`${id}-${index}-bag-error`}><T>Enter positive kg per bag, accurate to one gram.</T></FieldError>}
            </Field> : <input type="hidden" name="bagWeightKg" value="" />}
          </div>
        </div>;
      })}
      <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" name="complete" checked={complete} onChange={(event) => setComplete(event.target.checked)} className="mt-1 size-5 accent-primary" /><span><T>This is the final delivery; close any remaining ordered quantity.</T></span></label>
      {purchase.canApproveVariance ? <div className="space-y-4">
        <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" name="approveVariance" checked={approval} onChange={(event) => setApproval(event.target.checked)} className="mt-1 size-5 accent-primary" /><span><T>As owner, I explicitly approve any excess or final short quantity in this delivery.</T></span></label>
        <Field data-invalid={reasonInvalid}><FieldLabel htmlFor={`${id}-reason`}><T>Owner approval reason</T></FieldLabel><Input id={`${id}-reason`} name="reason" value={reason} maxLength={500} required={approval} onChange={(event) => setReason(event.target.value)} aria-invalid={reasonInvalid} aria-describedby={reasonInvalid ? `${id}-reason-error` : undefined} />
          {reasonInvalid && <FieldError id={`${id}-reason-error`}><T>Enter a reason using 1–500 characters.</T></FieldError>}
        </Field>
      </div> : <p className="text-sm leading-6 text-ink-muted"><T>An owner must accept a delivery with excess quantities or approve a final short delivery.</T></p>}
      <Button type="submit">{pending ? <T>Accepting delivery…</T> : <T>Accept delivery</T>}</Button>
      {pending && <p role="status" className="text-sm text-ink-muted"><T>Recording receipt, stock, and supplier debt…</T></p>}
    </fieldset>
  </form>;
}
