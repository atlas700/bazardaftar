import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), manageWarehouse: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/db/warehouses", () => mocks);
vi.mock("next/cache", () => mocks);
import { updateWarehouse } from "./actions";
beforeEach(() => { mocks.requireSession.mockResolvedValue({ userId: "user_a" }); mocks.manageWarehouse.mockResolvedValue({ status: "success" }); });
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

describe("warehouse Server Action", () => {
  it("authenticates and forwards only setup fields before refreshing", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ operation: "update-warehouse", warehouseId: "warehouse", name: "Main", location: "Helmand", organizationId: "attacker", isActive: "true", id: "spoofed" })) form.set(key, value);
    expect(await updateWarehouse({ status: "idle" }, form)).toEqual({ status: "success" });
    expect(mocks.requireSession).toHaveBeenCalledOnce();
    expect(mocks.manageWarehouse).toHaveBeenCalledWith({ operation: "update-warehouse", id: "warehouse", name: "Main", location: "Helmand" });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/settings/warehouse"]]);
  });
  it("preserves sign-in redirects and permission denials", async () => {
    mocks.requireSession.mockImplementation(() => redirect("/sign-in"));
    await expect(updateWarehouse({ status: "idle" }, new FormData())).rejects.toHaveProperty("digest", expect.stringContaining("NEXT_REDIRECT"));
    expect(mocks.manageWarehouse).not.toHaveBeenCalled();
    mocks.requireSession.mockResolvedValue({ userId: "user_a" });
    mocks.manageWarehouse.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(updateWarehouse({ status: "idle" }, new FormData())).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("reports sanitized errors when saving or refreshing fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.revalidatePath.mockImplementation(() => { throw new Error("private SQL password"); });
    const form = new FormData(); form.set("operation", "create-warehouse");
    expect(await updateWarehouse({ status: "idle" }, form)).toEqual({ status: "error", correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ stage: "refresh" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|SQL|password/);
  });
  it("validates foreign operations and malformed transport through the guarded service", async () => {
    mocks.manageWarehouse.mockResolvedValue({ status: "invalid", fields: ["operation"] });
    const form = new FormData(); form.set("operation", "create-supplier");
    await updateWarehouse({ status: "idle" }, form);
    expect(mocks.manageWarehouse).toHaveBeenCalledWith(null);
    // @ts-expect-error Exercise untrusted Server Action transport.
    await updateWarehouse({ status: "idle" }, null);
    expect(mocks.manageWarehouse).toHaveBeenLastCalledWith(null);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it.each(["invalid", "exists", "conflict"])("keeps %s outcomes without refreshing", async (status) => {
    mocks.manageWarehouse.mockResolvedValue({ status });
    await updateWarehouse({ status: "idle" }, new FormData());
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
