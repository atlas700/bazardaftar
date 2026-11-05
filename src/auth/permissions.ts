export const businessRoles = ["owner", "admin", "manager", "warehouse", "sales", "accountant", "viewer"] as const;
export type BusinessRole = typeof businessRoles[number];

// ADR 0016: every permission names its roles explicitly, including owner.
const permissionRoles = {
  "organization.read": ["owner", "admin", "manager", "warehouse", "sales", "accountant", "viewer"],
  "organization.manage": ["owner", "admin"],
  "staff.read": ["owner", "admin"],
  "staff.manage": ["owner", "admin"],
  "ownership.manage": ["owner"],
  "catalog.read": ["owner", "admin", "manager", "warehouse", "sales", "accountant", "viewer"],
  "catalog.manage": ["owner", "admin", "manager"],
  "suppliers.read": ["owner", "admin", "manager", "warehouse", "accountant", "viewer"],
  "suppliers.manage": ["owner", "admin", "manager"],
  "purchases.read": ["owner", "admin", "manager", "warehouse", "accountant", "viewer"],
  "purchases.manage": ["owner", "admin", "manager"],
  "receipts.accept": ["owner", "admin", "manager", "warehouse"],
  "receipts.approve_variance": ["owner"],
  "inventory.read": ["owner", "admin", "manager", "warehouse", "sales", "accountant", "viewer"],
  "inventory.correct": ["owner"],
  "transactions.cancel": ["owner"],
  "supplier_balances.read": ["owner", "admin", "manager", "accountant", "viewer"],
  "supplier_payments.read": ["owner", "admin", "manager", "accountant", "viewer"],
  "supplier_payments.record": ["owner", "admin", "accountant"],
  "supplier_payments.adjust_rounding": ["owner"],
  "audit.read": ["owner", "admin", "accountant"],
} as const satisfies Record<string, readonly BusinessRole[]>;

export type Permission = keyof typeof permissionRoles;

export function hasPermission(role: string, permission: Permission): boolean {
  if (!Object.hasOwn(permissionRoles, permission)) return false;
  const allowedRoles: readonly string[] = permissionRoles[permission];
  return allowedRoles.includes(role);
}
