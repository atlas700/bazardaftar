"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { T, Var, useGT } from "gt-next";
import type { getPurchase } from "@/db/purchases";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changePurchase } from "../actions";

type Purchase = Pick<Awaited<ReturnType<typeof getPurchase>>, "id" | "revision" | "status" | "canManage" | "canCancel">;

export function PurchaseLifecycle({ purchase, requestId }: { purchase: Purchase; requestId: string }) {
  const gt = useGT();
  const id = useId();
  const feedback = useRef<HTMLDivElement>(null);
  const [retryId] = useState(requestId);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(changePurchase, { status: "idle" });
  useEffect(() => { if (state.status === "invalid" || state.status === "conflict" || state.status === "error") feedback.current?.focus(); }, [state]);
  const order = purchase.status === "draft" && purchase.canManage;
  const cancel = (purchase.status === "draft" || purchase.status === "ordered") && purchase.canCancel;
  if (!order && !cancel) return null;
  const reasonInvalid = state.status === "invalid" && state.fields.includes("reason");
  const identity = <><input type="hidden" name="id" value={purchase.id} /><input type="hidden" name="revision" value={purchase.revision} /><input type="hidden" name="requestId" value={retryId} /></>;
  return <div aria-busy={pending} className="space-y-5">
    <h2 className="font-semibold"><T>Purchase actions</T></h2>
    {order && <form action={action}><fieldset disabled={pending} className="space-y-2 disabled:opacity-60">
      {identity}<input type="hidden" name="action" value="order" />
      <Button type="submit"><T>Mark as ordered</T></Button>
      <p className="text-sm leading-6 text-ink-muted"><T>Confirm the agreement with the supplier. Ordered purchases cannot be edited.</T></p>
    </fieldset></form>}
    {cancel && <form action={action} onSubmit={(event) => {
      if (!window.confirm(gt("Cancel this purchase? It will remain in history and cannot be reopened."))) event.preventDefault();
    }}><fieldset disabled={pending} className="min-w-0 space-y-4 border-t border-border/70 pt-5 disabled:opacity-60">
        {identity}<input type="hidden" name="action" value="cancel" />
        <Field data-invalid={reasonInvalid}><FieldLabel htmlFor={`${id}-reason`}><T>Cancellation reason</T></FieldLabel>
          <Input id={`${id}-reason`} name="reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={500}
            aria-invalid={reasonInvalid} aria-describedby={reasonInvalid ? `${id}-reason-error` : `${id}-approval`} />
          {reasonInvalid && <FieldError id={`${id}-reason-error`}><T>Enter a reason using 1–500 characters.</T></FieldError>}
        </Field>
        <p id={`${id}-approval`} className="text-sm leading-6 text-ink-muted"><T>Your owner approval and reason will be recorded. The purchase stays in history.</T></p>
        <Button type="submit" variant="destructive"><T>Cancel purchase</T></Button>
    </fieldset></form>}
    {pending && <p role="status" className="text-sm text-ink-muted"><T>Updating purchase…</T></p>}
    {(state.status === "invalid" || state.status === "conflict" || state.status === "error") && <div ref={feedback} tabIndex={-1} role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 outline-offset-4">
      {state.status === "invalid" && (reasonInvalid ? <a className="underline underline-offset-2" href={`#${id}-reason`}><T>Enter a cancellation reason using 1–500 characters.</T></a>
        : <p><T>The purchase could not be updated. Check that its supplier, warehouse, products, and measures are active, then reload.</T></p>)}
      {state.status === "conflict" && <p><T>This purchase changed or the action is no longer allowed. Reload to review its current agreement and status.</T></p>}
      {state.status === "error" && <p><T>The change could not be confirmed. Retry the same action with unchanged details, or reload to check the purchase. Reference: <Var>{state.correlationId}</Var></T></p>}
      <a className="inline-flex min-h-11 items-center text-primary underline underline-offset-2" href={`/purchases/${purchase.id}`}><T>Reload purchase</T></a>
    </div>}
  </div>;
}
