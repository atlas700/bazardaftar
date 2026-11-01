"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { T, Var, useGT } from "gt-next";
import { Check, Plus } from "lucide-react";
import type { getSupplier } from "@/db/suppliers";
import { supplierTypes } from "@/domain/supplier";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Input, inputClass } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateSupplier } from "../actions";
import { SupplierType } from "./supplier-type";

export function SupplierForm({ supplier }: { supplier?: Awaited<ReturnType<typeof getSupplier>> }) {
  const gt = useGT();
  const id = useId();
  const summary = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState({ name: supplier?.name ?? "", phone: supplier?.phone ?? "", location: supplier?.location ?? "",
    type: supplier?.type ?? "unspecified", notes: supplier?.notes ?? "", paymentTerms: supplier?.paymentTerms ?? "" });
  const [state, action, pending] = useActionState(updateSupplier, { status: "idle" });
  const invalid = state.status === "invalid" ? state.fields : [];
  useEffect(() => { if (state.status === "invalid") summary.current?.focus(); }, [state]);
  const fields = [
    { key: "name", label: gt("Supplier name"), max: 80, error: gt("Enter a supplier name of 1–80 characters.") },
    { key: "phone", label: gt("Phone (optional)"), max: 40, error: gt("Use 3–40 characters: digits, spaces, +, -, parentheses, or periods.") },
    { key: "location", label: gt("Location (optional)"), max: 200, error: gt("Use a location of at most 200 characters.") },
    { key: "type", label: gt("Supplier type (optional)"), max: 0, error: gt("Choose Individual, Business, or Not specified.") },
    { key: "paymentTerms", label: gt("Payment terms (optional)"), max: 500, error: gt("Use payment terms of at most 500 characters.") },
    { key: "notes", label: gt("Notes (optional)"), max: 2000, error: gt("Use notes of at most 2,000 characters.") },
  ] as const;
  return <form action={action} aria-busy={pending} aria-describedby={`${id}-feedback`} className="space-y-5">
    {state.status === "invalid" && <div ref={summary} tabIndex={-1} role="alert" aria-labelledby={`${id}-error-title`} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm outline-offset-4">
      <p id={`${id}-error-title`} className="font-medium"><T>Check the highlighted fields.</T></p>
      <ul className="mt-2 list-inside list-disc space-y-1">{fields.filter(({ key }) => invalid.includes(key)).map(({ key, error }) =>
        <li key={key}><a href={`#${id}-${key}`} className="underline underline-offset-2">{error}</a></li>)}</ul>
    </div>}
    <fieldset disabled={pending} className="grid min-w-0 gap-5 sm:grid-cols-2 disabled:opacity-60">
      {/* A control named id shadows form.id and drops React's named submitter. */}
      {supplier && <input type="hidden" name="supplierId" value={supplier.id} />}
      {fields.map(({ key, label, max, error }) => <Field key={key} data-invalid={invalid.includes(key)}>
        <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
        {key === "type" ? <Select name="type" value={values.type} onValueChange={(type) => setValues({ ...values, type })} disabled={pending}>
          <SelectTrigger id={`${id}-type`} aria-invalid={invalid.includes(key)} aria-describedby={invalid.includes(key) ? `${id}-${key}-error` : undefined}>
            <SelectValue><SupplierType type={values.type === "individual" || values.type === "business" ? values.type : null} /></SelectValue>
          </SelectTrigger>
          <SelectContent><SelectItem value="unspecified"><T>Not specified</T></SelectItem>
            {supplierTypes.map((type) => <SelectItem key={type} value={type}><SupplierType type={type} /></SelectItem>)}
          </SelectContent>
        </Select> : key === "notes" || key === "paymentTerms" ? <textarea
          id={`${id}-${key}`} name={key} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })}
          maxLength={max} rows={3} dir="auto" className={`${inputClass} resize-y`}
          aria-invalid={invalid.includes(key)} aria-describedby={invalid.includes(key) ? `${id}-${key}-error` : key === "paymentTerms" ? `${id}-terms-hint` : undefined} /> : <Input
          id={`${id}-${key}`} name={key} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })}
          required={key === "name"} maxLength={max} type={key === "phone" ? "tel" : "text"} dir="auto"
          autoComplete={key === "phone" ? "tel" : "off"}
          aria-invalid={invalid.includes(key)} aria-describedby={invalid.includes(key) ? `${id}-${key}-error` : undefined} />}
        {invalid.includes(key) && <FieldError id={`${id}-${key}-error`}>{error}</FieldError>}
        {key === "paymentTerms" && <FieldDescription id={`${id}-terms-hint`}><T>Record the agreement in words, such as payment on delivery.</T></FieldDescription>}
      </Field>)}
      <div className="flex flex-wrap gap-3 border-t border-border/70 pt-5 sm:col-span-2">
        <Button type="submit" name="operation" value={supplier ? "update-supplier" : "create-supplier"}>
          {supplier ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{supplier ? <T>Save changes</T> : <T>Add supplier</T>}
        </Button>
        {supplier && <ConfirmSubmit formNoValidate name="operation" value="deactivate-supplier"
          confirmation={gt("Deactivate {name}? Its record will be kept and it cannot be reactivated.", { name: supplier.name })}><T>Deactivate supplier</T></ConfirmSubmit>}
      </div>
    </fieldset>
    <div id={`${id}-feedback`} className="text-sm leading-6 [&_[role=alert]]:text-destructive [&_[role=status]]:text-success">
      {pending && <p role="status"><T>Saving…</T></p>}
      {state.status === "success" && !pending && <p role="status"><T>Saved.</T></p>}
      {state.status === "duplicate" && <p role="alert"><T>This supplier name is already used in this business, including inactive suppliers. Use a distinguishing name.</T></p>}
      {state.status === "conflict" && <p role="alert"><T>This supplier is unavailable or inactive. Reload the directory before trying again.</T></p>}
      {state.status === "error" && <p role="alert"><T>The change could not be confirmed. Reload the directory before retrying. Reference: <Var>{state.correlationId}</Var></T></p>}
    </div>
  </form>;
}
