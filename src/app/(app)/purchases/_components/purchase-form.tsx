"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { T, Var, useGT } from "gt-next";
import { Plus, Save } from "lucide-react";
import type { getPurchasesWorkspace } from "@/db/purchases";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPurchase } from "../actions";

type Workspace = Pick<Awaited<ReturnType<typeof getPurchasesWorkspace>>, "warehouse" | "suppliers" | "products" | "units">;
type Line = { key: number; productId: string; quantity: string; quantityUnitId: string; quantityBagWeightKg: string; unitPrice: string; priceUnitId: string; priceBagWeightKg: string };
const blankLine = (key: number): Line => ({ key, productId: "", quantity: "", quantityUnitId: "", quantityBagWeightKg: "", unitPrice: "", priceUnitId: "", priceBagWeightKg: "" });

export function PurchaseForm({ workspace, requestId }: { workspace: Workspace; requestId: string }) {
  const gt = useGT();
  const id = useId();
  const summary = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const nextKey = useRef(2);
  const [retryId] = useState(requestId);
  const [lines, setLines] = useState<Line[]>([blankLine(1)]);
  const [supplierId, setSupplierId] = useState("");
  const [currency, setCurrency] = useState("AFN");
  const [structureChanged, setStructureChanged] = useState(false);
  const [state, action, pending] = useActionState(createPurchase, { status: "idle" });
  const invalid = state.status === "invalid" && !structureChanged ? state.fields : [];
  useEffect(() => { if (state.status === "invalid") summary.current?.focus(); }, [state]);
  const fieldId = (key: string) => `${id}-${key.replaceAll(".", "-")}`;
  const errors: { key: string; message: string }[] = [];
  const options = (key: string, label: string, value: string, choices: { id: string; name: string }[], change: (value: string) => void) => {
    const message = gt("Choose an active {field} in this business.", { field: label });
    if (invalid.includes(key)) errors.push({ key, message });
    return <Field data-invalid={invalid.includes(key)}><FieldLabel htmlFor={fieldId(key)}>{label}</FieldLabel>
      <Select name={key.split(".").at(-1)} value={value} onValueChange={change} disabled={pending} required>
        <SelectTrigger id={fieldId(key)} aria-invalid={invalid.includes(key)} aria-describedby={invalid.includes(key) ? `${fieldId(key)}-error` : undefined}>
          <SelectValue placeholder={gt("Choose…")}><bdi dir="auto" className="min-w-0 truncate">{choices.find((choice) => choice.id === value)?.name}</bdi></SelectValue>
        </SelectTrigger>
        <SelectContent>{choices.map((choice) => <SelectItem key={choice.id} value={choice.id}><bdi dir="auto">{choice.name}</bdi></SelectItem>)}</SelectContent>
      </Select>
      {invalid.includes(key) && <FieldError id={`${fieldId(key)}-error`}>{message}</FieldError>}
    </Field>;
  };
  const number = (key: string, label: string, value: string, message: string, change: (value: string) => void) => {
    if (invalid.includes(key)) errors.push({ key, message });
    return <Field data-invalid={invalid.includes(key)}><FieldLabel htmlFor={fieldId(key)}>{label}</FieldLabel>
      <Input id={fieldId(key)} name={key.split(".").at(-1)} value={value} onChange={(event) => change(event.target.value)}
        inputMode="decimal" dir="ltr" required maxLength={38} autoComplete="off" aria-invalid={invalid.includes(key)} aria-describedby={invalid.includes(key) ? `${fieldId(key)}-error` : undefined} />
      {invalid.includes(key) && <FieldError id={`${fieldId(key)}-error`}>{message}</FieldError>}
    </Field>;
  };
  const update = (key: number, changes: Partial<Line>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line));
  const fields = <fieldset disabled={pending} className="min-w-0 space-y-7 disabled:opacity-60">
    <input type="hidden" name="requestId" value={retryId} />
    <input type="hidden" name="warehouseId" value={workspace.warehouse?.id ?? ""} />
    <div className="grid min-w-0 gap-5 sm:grid-cols-2">
      {options("supplierId", gt("Supplier"), supplierId, workspace.suppliers, setSupplierId)}
      {options("currency", gt("Purchase currency"), currency, [{ id: "AFN", name: "AFN" }, { id: "PKR", name: "PKR" }], setCurrency)}
    </div>
    <div id={fieldId("warehouseId")} tabIndex={-1} className="text-sm"><span className="text-ink-muted"><T>Warehouse:</T> </span><bdi dir="auto">{workspace.warehouse?.name}</bdi>
      {invalid.includes("warehouseId") && <p className="mt-2 text-destructive"><T>The warehouse is unavailable or inactive. Ask an owner or admin to check its setup, then reload.</T></p>}
    </div>
    <div className="space-y-6">{lines.map((line, index) => {
      const prefix = `items.${index}.`;
      const quantityBag = workspace.units.find((unit) => unit.id === line.quantityUnitId)?.kind === "bag";
      const priceBag = workspace.units.find((unit) => unit.id === line.priceUnitId)?.kind === "bag";
      return <fieldset key={line.key} className="min-w-0 space-y-5 border-t border-border/70 pt-5">
        <legend className="pe-3 text-base font-semibold"><T>Purchase line <Var>{index + 1}</Var></T></legend>
        <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {options(`${prefix}productId`, gt("Product"), line.productId, workspace.products, (productId) => {
            const unitId = workspace.products.find((product) => product.id === productId)?.unitId ?? "";
            update(line.key, { productId, quantityUnitId: unitId, priceUnitId: unitId, quantityBagWeightKg: "", priceBagWeightKg: "" });
          })}
          {number(`${prefix}quantity`, gt("Quantity"), line.quantity, gt("Enter a positive quantity that converts to whole grams and fits the purchase limits."), (quantity) => update(line.key, { quantity }))}
          {options(`${prefix}quantityUnitId`, gt("Quantity measure"), line.quantityUnitId, workspace.units, (quantityUnitId) => update(line.key, { quantityUnitId, quantityBagWeightKg: "" }))}
          {quantityBag ? number(`${prefix}quantityBagWeightKg`, gt("Actual bag weight (kg)"), line.quantityBagWeightKg, gt("Enter the actual weight of one bag in kg, with at most three decimal places."), (quantityBagWeightKg) => update(line.key, { quantityBagWeightKg }))
            : <input type="hidden" name="quantityBagWeightKg" value="" />}
          {number(`${prefix}unitPrice`, gt("Agreed unit price"), line.unitPrice, gt("Enter a non-negative price with at most two decimal places that fits the purchase limits."), (unitPrice) => update(line.key, { unitPrice }))}
          {options(`${prefix}priceUnitId`, gt("Price per measure"), line.priceUnitId, workspace.units, (priceUnitId) => update(line.key, { priceUnitId, priceBagWeightKg: "" }))}
          {priceBag ? number(`${prefix}priceBagWeightKg`, gt("Price bag weight (kg)"), line.priceBagWeightKg, gt("Enter the actual kg weight covered by one bag price, with at most three decimal places."), (priceBagWeightKg) => update(line.key, { priceBagWeightKg }))
            : <input type="hidden" name="priceBagWeightKg" value="" />}
        </div>
        {lines.length > 1 && <Button type="button" variant="ghost" onClick={() => { setStructureChanged(true); setLines((current) => current.filter((item) => item.key !== line.key)); addButton.current?.focus(); }}><T>Remove line <Var>{index + 1}</Var></T></Button>}
      </fieldset>;
    })}</div>
    <div className="flex flex-wrap gap-3 border-t border-border/70 pt-5">
      <Button type="button" ref={addButton} variant="outline" disabled={lines.length >= 100} onClick={() => { const key = nextKey.current++; setStructureChanged(true); setLines((current) => [...current, blankLine(key)]); }}><Plus aria-hidden="true" /><T>Add purchase line</T></Button>
      <Button type="submit"><Save aria-hidden="true" /><T>Save purchase draft</T></Button>
    </div>
    <FieldDescription><T>Choose the measure used for the quantity and the measure used for the price. They can differ. Each line is rounded to two decimals before the purchase total is calculated.</T></FieldDescription>
  </fieldset>;
  return <form action={action} onSubmit={() => setStructureChanged(false)} aria-busy={pending} className="space-y-6">
    {state.status === "invalid" && !structureChanged && <div ref={summary} tabIndex={-1} role="alert" aria-labelledby={`${id}-error-title`} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm outline-offset-4">
      <p id={`${id}-error-title`} className="font-medium"><T>Check the highlighted fields.</T></p>
      <ul className="mt-2 list-inside list-disc space-y-1">{errors.map(({ key, message }) => <li key={key}><a className="underline underline-offset-2" href={`#${fieldId(key)}`}>{message}</a></li>)}</ul>
      {invalid.includes("items") && <p className="mt-2"><T>Use 1–100 lines and amounts below 18 integer digits. Check the quantities, prices, and total.</T></p>}
      {invalid.includes("warehouseId") && <a className="mt-2 inline-block underline" href={`#${fieldId("warehouseId")}`}><T>Check the warehouse.</T></a>}
      {invalid.includes("requestId") && <p className="mt-2"><T>Reload this page to start a new purchase draft.</T></p>}
    </div>}
    {fields}
    {pending && <p role="status" className="text-sm text-ink-muted"><T>Saving purchase draft…</T></p>}
    {state.status === "conflict" && <p role="alert" className="text-sm leading-6 text-destructive"><T>This submission already saved different purchase details. Open the purchase register to check it, then start a new draft if needed.</T></p>}
    {state.status === "error" && <p role="alert" className="text-sm leading-6 text-destructive"><T>The save could not be confirmed. Keep these details unchanged and retry, or check the purchase register before starting another draft. Reference: <Var>{state.correlationId}</Var></T></p>}
  </form>;
}
