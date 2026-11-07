"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { T, useGT } from "gt-next";
import { Brand } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { AppNavigation } from "./app-navigation";

export function MobileNavigation({ role, children }: { role: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const gt = useGT();
  const pathname = usePathname();

  useEffect(() => { dialog.current?.close(); }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const drawer = dialog.current;
    function closeOnDesktop() { if (desktop.matches) drawer?.close(); }
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      drawer?.close();
    };
  }, []);

  return <>
    <Button
      ref={trigger}
      type="button"
      variant="ghost"
      className="size-11 p-0 lg:hidden"
      aria-label={gt("Open navigation")}
      aria-haspopup="dialog"
      aria-controls={id}
      aria-expanded={open}
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}
    >
      <Menu aria-hidden="true" />
    </Button>
    <dialog
      ref={dialog}
      id={id}
      aria-labelledby={`${id}-title`}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-black/40 open:flex"
      onClose={() => {
        setOpen(false);
        if (trigger.current?.getClientRects().length) trigger.current.focus();
      }}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
    >
      <div className="flex h-full w-80 max-w-[calc(100%-3rem)] flex-col border-e border-border bg-sidebar shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-4">
          <Brand compact />
          <Button type="button" variant="ghost" className="size-11 p-0" aria-label={gt("Close navigation")} onClick={() => dialog.current?.close()}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
          <h2 id={`${id}-title`} className="mb-3 px-3 text-xs font-medium text-ink-muted"><T>Your business</T></h2>
          <AppNavigation role={role} onNavigate={() => dialog.current?.close()} />
        </div>
        <div className="shrink-0 border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </dialog>
  </>;
}
