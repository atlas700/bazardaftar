export function trimDecimal(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

export function ExactNumber({ value, currency }: { value: string; currency?: string }) {
  const [whole, fraction] = value.split(".");
  return <bdi dir="ltr" className="tabular-nums [overflow-wrap:anywhere]">{whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}{fraction === undefined ? "" : `.${fraction}`}{currency && <> {currency}</>}</bdi>;
}
