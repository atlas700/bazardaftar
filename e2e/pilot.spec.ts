import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test, expect } from "./fixture";

test.beforeAll(async () => { await clerkSetup(); });

test("authenticate, receive once, and pay a supplier without changing stock", async ({ page, pilot }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: pilot.email });
  await page.evaluate(async (organization) => { await window.Clerk.setActive({ organization }); }, pilot.clerkOrganizationId);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await page.goto("/products");
  await expect(page.getByRole("link", { name: "E2E Wheat", exact: true })).toBeVisible();
  await page.goto("/suppliers");
  await expect(page.getByRole("link", { name: "E2E Supplier", exact: true })).toBeVisible();
  await page.goto("/settings/warehouse");
  await expect(page.getByLabel("Warehouse name")).toHaveValue("E2E Warehouse");

  await page.goto("/purchases/new");
  await page.getByRole("combobox", { name: "Supplier", exact: true }).click();
  await page.getByRole("option", { name: "E2E Supplier", exact: true }).click();
  await page.getByRole("combobox", { name: "Product", exact: true }).click();
  await page.getByRole("option", { name: "E2E Wheat", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("10");
  await page.getByLabel("Agreed unit price", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save purchase draft", exact: true }).click();
  await expect(page).toHaveURL(/\/purchases\/[0-9a-f-]{36}$/);
  const purchaseId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("button", { name: "Mark as ordered", exact: true }).click();
  await page.getByRole("link", { name: "Accept delivery", exact: true }).click();
  await page.getByLabel("Quantity received", { exact: true }).fill("4");
  const actionPromise = page.waitForRequest((request) => request.method() === "POST" && request.url().includes(`/purchases/${purchaseId}/receive`) && !!request.headers()["next-action"]);
  await page.getByRole("button", { name: "Accept delivery", exact: true }).click();
  const action = await actionPromise;
  await expect(page).toHaveURL(new RegExp(`/purchases/${purchaseId}#receipt-`));
  const receiptId = new URL(page.url()).hash.replace("#receipt-", "");
  await expect(page.getByText("Partially received", { exact: true })).toBeVisible();

  // Replay the actual submitted action, preserving its request UUID and payload.
  const headers = action.headers();
  const replay = await page.request.post(action.url(), {
    headers: { "content-type": headers["content-type"], "next-action": headers["next-action"], origin: new URL(action.url()).origin },
    data: action.postDataBuffer()!, maxRedirects: 0,
  });
  expect([200, 303]).toContain(replay.status());
  expect(replay.headers()["x-action-redirect"] ?? replay.headers().location).toContain(receiptId);
  const receipts = await pilot.client.query("select id from goods_receipts where organization_id=$1", [pilot.organizationId]);
  expect(receipts.rows).toEqual([{ id: receiptId }]);
  const stock = async () => (await pilot.client.query("select sum(quantity_kg)::text as quantity from inventory_movements where organization_id=$1 and product_id=$2", [pilot.organizationId, pilot.productId])).rows[0].quantity;
  expect(await stock()).toBe("4.000");
  await page.goto(`/inventory?productId=${pilot.productId}`);
  await expect(page.getByText("4.000", { exact: true })).toBeVisible();
  await page.goto(`/suppliers/${pilot.supplierId}/statement`);
  await expect(page.getByText("40.00 AFN", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Record supplier payment", exact: true }).click();
  await page.getByLabel("Payment date", { exact: false }).fill("2026-11-09");
  await page.getByLabel("AFN cash paid", { exact: false }).fill("25");
  await page.getByRole("button", { name: "Record supplier payment", exact: true }).click();
  await expect(page).toHaveURL(/\/payments\?/);
  await page.goto(`/suppliers/${pilot.supplierId}/statement`);
  await expect(page.getByText("15.00 AFN", { exact: true }).first()).toBeVisible();
  expect(await stock()).toBe("4.000");
  const balances = await pilot.client.query("select p.amount::text as debt, a.amount::text as paid from supplier_payables p join supplier_payment_allocations a on a.payable_id=p.id where p.organization_id=$1", [pilot.organizationId]);
  expect(balances.rows).toEqual([{ debt: "40.00", paid: "25.00" }]);
  await page.goto(`/inventory?productId=${pilot.productId}`);
  await expect(page.getByText("4.000", { exact: true })).toBeVisible();
});
