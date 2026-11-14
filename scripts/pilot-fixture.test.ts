import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extend: vi.fn(),
  createOrganization: vi.fn(),
  createUser: vi.fn(),
  getUser: vi.fn(),
  deleteUser: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}));
vi.mock("@playwright/test", () => ({ test: { extend: mocks.extend } }));
vi.mock("@clerk/nextjs/server", () => ({ createClerkClient: () => ({
  users: { createUser: mocks.createUser, getUser: mocks.getUser, deleteUser: mocks.deleteUser },
  organizations: { createOrganization: mocks.createOrganization },
}) }));
vi.mock("pg", () => ({ Client: class {
  connect = mocks.connect;
  query = mocks.query;
  end = mocks.end;
} }));
import "../e2e/fixture";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("keeps the run UUID out of Clerk's organization name and cleans up a setup failure", async () => {
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("AFCS_TEST_DATABASE_URL", "postgresql://test:test@localhost:5432/afcs_task07_verify");
  mocks.query.mockResolvedValue({ rows: [{ name: "afcs_task07_verify" }] });
  mocks.createUser.mockResolvedValue({ id: "user_fixture" });
  mocks.getUser.mockImplementation(async () => ({ privateMetadata: mocks.createUser.mock.calls[0][0].privateMetadata }));
  const stop = new Error("stop before seeding");
  mocks.createOrganization.mockRejectedValue(stop);
  const runScenario = vi.fn();
  const fixture = mocks.extend.mock.calls[0][0].pilot;

  await expect(fixture({}, runScenario)).rejects.toBe(stop);

  const params = mocks.createOrganization.mock.calls[0][0];
  expect(params.name).toMatch(/^[A-Za-z ]+$/);
  expect(params.privateMetadata).toEqual(mocks.createUser.mock.calls[0][0].privateMetadata);
  expect(params.createdBy).toBe("user_fixture");
  expect(mocks.deleteUser).toHaveBeenCalledWith("user_fixture");
  expect(mocks.end).toHaveBeenCalledOnce();
  expect(runScenario).not.toHaveBeenCalled();
});
