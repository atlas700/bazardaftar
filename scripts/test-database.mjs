/** @param {string | undefined} value */
export function requireTestDatabaseUrl(value) {
  const database = URL.parse(value ?? "");
  if (!database || !["postgres:", "postgresql:"].includes(database.protocol) || database.pathname !== "/afcs_task07_verify" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || database.search || database.hash) {
    throw new Error("Set AFCS_TEST_DATABASE_URL to the isolated afcs_task07_verify database.");
  }
  return database.href;
}
