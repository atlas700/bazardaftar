"use client";

import { useGT, useLocaleSelector } from "gt-next";
import { Globe2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LocalePicker() {
  const gt = useGT();
  const { locale, locales, setLocale, getLocaleProperties } = useLocaleSelector();
  if (!locales.length) return null;

  return (
    <Select value={locale || ""} onValueChange={setLocale}>
      <SelectTrigger aria-label={gt("Language")} className="w-auto max-w-44 [&>span]:min-w-0 [&>span]:truncate">
        <Globe2 className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <SelectValue placeholder={gt("Language")}>
          {locale && <bdi dir="auto" lang={locale}>{getLocaleProperties(locale).nativeNameWithRegionCode}</bdi>}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {locales.map((value) => <SelectItem key={value} value={value}>
          <bdi dir="auto" lang={value}>{getLocaleProperties(value).nativeNameWithRegionCode}</bdi>
        </SelectItem>)}
      </SelectContent>
    </Select>
  );
}
