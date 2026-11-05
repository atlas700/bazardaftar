"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { T, Var, useGT } from "gt-next";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { PaymentState } from "@/db/supplier-payments";
import { approveSupplierRounding, recordSupplierCash } from "../actions";

type Props = { requestId: string } & (
  | { kind: "cash"; supplierId: string; currency: string; paidOn: string }
  | { kind: "reduction"; paymentId: string; payableId: string }
);

export function SettlementForm(props: Props) {
  const gt = useGT(); const id = useId();
  const form = useRef<HTMLFormElement>(null); const feedback = useRef<HTMLDivElement>(null);
  const [retryId] = useState(props.requestId);
  const cash = props.kind === "cash";
  const [values, setValues] = useState({ paidOn: cash ? props.paidOn : "", afnCash: "0", pkrCash: "0", pkrPerAfn: "", reference: "", note: "", amount: "", reason: "", approved: false });
  const [state, action, pending] = useActionState<PaymentState, FormData>(cash ? recordSupplierCash : approveSupplierRounding, { status: "idle" });
  useEffect(() => {
    const element = form.current;
    const retain = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    element?.addEventListener("reset", retain, true);
    return () => element?.removeEventListener("reset", retain, true);
  }, []);
  useEffect(() => { if (state.status !== "idle" && state.status !== "success") feedback.current?.focus(); }, [state]);
  const invalid = (field: string) => state.status === "invalid" && state.fields.includes(field);
  const fields = cash ? [
    { name: "paidOn", label: gt("Payment date"), hint: gt("Date the cash was paid."), type: "date", maxLength: 10 },
    { name: "afnCash", label: gt("AFN cash paid"), hint: gt("Whole AFN actually paid; enter 0 if none."), inputMode: "numeric", maxLength: 18 },
    { name: "pkrCash", label: gt("PKR cash paid"), hint: gt("Whole PKR actually paid; enter 0 if none."), inputMode: "numeric", maxLength: 18 },
    { name: "pkrPerAfn", label: gt("Agreed exchange rate (1 AFN = PKR)"), hint: gt("Required when paying in another currency. Use a positive rate with at most six decimals. The recorded rate stays with this payment."), inputMode: "decimal", maxLength: 25 },
    { name: "reference", label: gt("Reference (optional)"), hint: gt("For example, a cash-book entry."), maxLength: 100 },
    { name: "note", label: gt("Note (optional)"), maxLength: 500 },
  ] as const : [
    { name: "amount", label: gt("Reduction amount"), hint: gt("Enter the agreed reduction in the payable's currency, up to its remaining balance and lifetime allowance."), inputMode: "decimal", maxLength: 21 },
    { name: "reason", label: gt("Reason"), hint: gt("Record the supplier's agreement using 1–500 characters."), maxLength: 500 },
  ] as const;
  const labels = [...fields.map((field) => ({ name: field.name, label: field.label })), { name: "approved", label: gt("Owner approval") }];
  return <form ref={form} action={action} aria-busy={pending} className="space-y-6" onSubmit={(event) => {
    if (!window.confirm(cash ? gt("Record this supplier payment? Check the cash, debt currency, date and agreed rate before confirming.") : gt("Approve this rounding reduction? This permanently reduces the receipt's debt without recording cash."))) event.preventDefault();
  }}>
    <input type="hidden" name="requestId" value={retryId} />
    {props.kind === "cash" ? <><input type="hidden" name="supplierId" value={props.supplierId} /><input type="hidden" name="debtCurrency" value={props.currency} /></>
      : <><input type="hidden" name="paymentId" value={props.paymentId} /><input type="hidden" name="payableId" value={props.payableId} /></>}
    {state.status !== "idle" && state.status !== "success" && <div ref={feedback} role="alert" tabIndex={-1} className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 outline-offset-4">
      {state.status === "invalid" && <><p><T>Check the marked fields. The remaining debt and rounding allowance may have changed.</T></p>
        {labels.filter((field) => invalid(field.name)).map((field) => <a key={field.name} href={`#${id}-${field.name}`} className="flex min-h-11 items-center underline underline-offset-2">{field.label}</a>)}
        {state.fields.some((field) => ["references", "requestId", "supplierId", "debtCurrency", "paymentId", "payableId"].includes(field)) && <p><T>Reopen this entry from supplier payments to check its supplier, currency and receipt.</T></p>}
      </>}
      {state.status === "insufficient_balance" && <p><T>The payment exceeds this supplier’s outstanding debt in the selected currency, or the balance is zero. Check the balance and record only cash actually retained.</T></p>}
      {state.status === "conflict" && <p><T>This request was already used with different details. Check recorded payments before starting a new entry.</T></p>}
      {state.status === "error" && <p><T>Recording could not be confirmed. Retry with the same details or check recorded payments before starting again. Reference: <Var>{state.correlationId}</Var></T></p>}
      <a href="/payments" className="inline-flex min-h-11 items-center text-primary underline"><T>Check recorded payments</T></a>
    </div>}
    <fieldset disabled={pending} className="min-w-0 space-y-5">
      <legend className="sr-only">{cash ? <T>Cash payment details</T> : <T>Owner-approved rounding reduction</T>}</legend>
      {fields.map((field) => {
        const optional = ["reference", "note", "pkrPerAfn"].includes(field.name);
        return <Field key={field.name} data-invalid={invalid(field.name)}><FieldLabel htmlFor={`${id}-${field.name}`}>{field.label}{!optional && " *"}</FieldLabel>
          <Input id={`${id}-${field.name}`} name={field.name} type={"type" in field ? field.type : "text"} inputMode={"inputMode" in field ? field.inputMode : undefined}
            dir={["paidOn", "afnCash", "pkrCash", "pkrPerAfn", "amount"].includes(field.name) ? "ltr" : "auto"}
            required={!optional} maxLength={field.maxLength} value={values[field.name]} onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
            aria-invalid={invalid(field.name)} aria-describedby={`${id}-${field.name}-help${invalid(field.name) ? ` ${id}-${field.name}-error` : ""}`} />
          <p id={`${id}-${field.name}-help`} className="text-sm leading-6 text-ink-muted">{"hint" in field ? field.hint : <T>Use at most 500 characters.</T>}</p>
          {invalid(field.name) && <FieldError id={`${id}-${field.name}-error`}><T>Check this value and the supported limits before retrying.</T></FieldError>}
        </Field>;
      })}
      {!cash && <><label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input id={`${id}-approved`} type="checkbox" name="approved" required checked={values.approved}
        onChange={(event) => setValues((v) => ({ ...v, approved: event.target.checked }))} aria-invalid={invalid("approved")} aria-describedby={invalid("approved") ? `${id}-approved-error` : undefined}
        className="mt-1 size-5 accent-primary" /><span><T>As owner, I approve this reduction and have recorded the supplier’s agreement.</T></span></label>
        {invalid("approved") && <FieldError id={`${id}-approved-error`}><T>Explicit owner approval is required.</T></FieldError>}</>}
      {cash && <p className="text-sm leading-6 text-ink-muted"><T>The combined cash is converted once and allocated to the oldest unpaid receipts. Any fractional balance stays outstanding until the owner approves a separate reduction.</T></p>}
      <Button type="submit">{pending ? <T>Recording…</T> : cash ? <T>Record supplier payment</T> : <T>Approve rounding reduction</T>}</Button>
      {pending && <p role="status" className="text-sm text-ink-muted"><T>Recording this supplier settlement…</T></p>}
    </fieldset>
  </form>;
}
