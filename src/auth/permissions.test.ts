import { describe, expect, it } from "vitest";
import { businessRoles, hasPermission } from "./permissions";

describe("ADR 0016 role defaults", () => {
  it("grants the approved rounding-reduction permission only to owners", () => {
    expect(businessRoles.filter((role) => Reflect.apply(hasPermission, undefined, [role, "supplier_payments.adjust_rounding"]))).toEqual(["owner"]);
  });
  it.each(["ownership.manage", "receipts.approve_variance", "inventory.correct", "transactions.cancel"] as const)(
    "reserves %s for owners, including when the caller is an admin", (permission) => {
      expect(businessRoles.filter((role) => hasPermission(role, permission))).toEqual(["owner"]);
    },
  );

  it.each([
    ["admin", "staff.manage", true], ["manager", "staff.manage", false],
    ["manager", "purchases.manage", true], ["manager", "supplier_payments.record", false],
    ["warehouse", "receipts.accept", true], ["warehouse", "purchases.read", true],
    ["warehouse", "supplier_balances.read", false], ["sales", "catalog.read", true],
    ["sales", "inventory.read", true], ["sales", "purchases.read", false],
    ["accountant", "supplier_payments.record", true], ["accountant", "catalog.manage", false],
    ["viewer", "supplier_payments.read", true], ["viewer", "supplier_balances.read", true],
    ["viewer", "supplier_payments.record", false], ["viewer", "receipts.accept", false],
    ["org:admin", "organization.read", false], ["unknown", "inventory.read", false],
  ] as const)("%s permission %s is %s", (role, permission, allowed) => {
    expect(hasPermission(role, permission)).toBe(allowed);
  });

  it.each(["constructor", "__proto__", "toString", "unlisted.action"])("denies unknown runtime permission %s", (permission) => {
    expect(Reflect.apply(hasPermission, undefined, ["owner", permission])).toBe(false);
  });
});
