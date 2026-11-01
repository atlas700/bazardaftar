"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { T, Var, useGT } from "gt-next";
import type { Warehouse } from "@/db/warehouses";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { updateWarehouse } from "../actions";

export function WarehouseForm({ warehouse }: { warehouse: Warehouse | null }) {
  const gt = useGT();
  const id = useId();
  const summary = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState({ name: warehouse?.name ?? "", location: warehouse?.location ?? "" });
  const [state, action, pending] = useActionState(updateWarehouse, { status: "idle" });
  const invalid = state.status === "invalid" ? state.fields : [];
  useEffect(() => { if (state.status === "invalid") summary.current?.focus(); }, [state]);
  const fields = [
    { key: "name", label: gt("Warehouse name"), max: 80, error: gt("Enter a warehouse name of 1–80 characters.") },
    { key: "location", label: gt("Location (optional)"), max: 200, error: gt("Use a location of at most 200 characters.") },
  ] as const;
  return <form action={action} aria-busy={pending} aria-describedby={`${id}-feedback`} className="space-y-5">
    {state.status === "invalid" && <div ref={summary} tabIndex={-1} role="alert" aria-labelledby={`${id}-error-title`} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm outline-offset-4">
      <p id={`${id}-error-title`} className="font-medium"><T>Check the highlighted fields.</T></p>
      <ul className="mt-2 list-inside list-disc space-y-1">{fields.filter(({ key }) => invalid.includes(key)).map(({ key, error }) =>
        <li key={key}><a href={`#${id}-${key}`} className="underline underline-offset-2">{error}</a></li>)}</ul>
    </div>}
    <fieldset disabled={pending} className="grid min-w-0 gap-5 disabled:opacity-60">
      {warehouse && <input type="hidden" name="warehouseId" value={warehouse.id} />}
      {fields.map(({ key, label, max, error }) => <Field key={key} data-invalid={invalid.includes(key)}>
        <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
        <Input id={`${id}-${key}`} name={key} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })}
          required={key === "name"} maxLength={max} dir="auto" autoComplete="off"
          aria-invalid={invalid.includes(key)} aria-describedby={invalid.includes(key) ? `${id}-${key}-error` : undefined} />
        {invalid.includes(key) && <FieldError id={`${id}-${key}-error`}>{error}</FieldError>}
      </Field>)}
      <div className="flex flex-wrap gap-3 border-t border-border/70 pt-5">
        <Button type="submit" name="operation" value={warehouse ? "update-warehouse" : "create-warehouse"}>
          {warehouse ? <T>Save changes</T> : <T>Set up warehouse</T>}
        </Button>
        {warehouse?.isActive && <ConfirmSubmit formNoValidate name="operation" value="deactivate-warehouse"
          confirmation={gt("Deactivate {name}? It will be unavailable for new purchases and receipts until reactivated.", { name: warehouse.name })}><T>Deactivate warehouse</T></ConfirmSubmit>}
        {warehouse && !warehouse.isActive && <Button type="submit" variant="secondary" formNoValidate name="operation" value="activate-warehouse"><T>Reactivate warehouse</T></Button>}
      </div>
    </fieldset>
    <div id={`${id}-feedback`} className="text-sm leading-6 [&_[role=alert]]:text-destructive [&_[role=status]]:text-success">
      {pending && <p role="status"><T>Saving…</T></p>}
      {state.status === "success" && !pending && <p role="status"><T>Saved.</T></p>}
      {state.status === "exists" && <p role="alert"><T>This business already has a warehouse. Reload to view or edit it.</T></p>}
      {state.status === "conflict" && <p role="alert"><T>The warehouse has changed or is unavailable. Reload before trying again.</T></p>}
      {state.status === "error" && <p role="alert"><T>We could not confirm the change. Reload before trying again. Reference: <Var><bdi dir="ltr" className="break-all">{state.correlationId}</bdi></Var></T></p>}
    </div>
  </form>;
}
