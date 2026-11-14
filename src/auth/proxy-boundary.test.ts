import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("keeps PostgreSQL out of the complete proxy import graph", () => {
  const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const visited = new Set<string>();
  const imports = new Set<string>();
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    for (const dependency of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
      imports.add(dependency.fileName);
      const resolved = ts.resolveModuleName(dependency.fileName, file, options, ts.sys).resolvedModule;
      if (resolved && !resolved.isExternalLibraryImport) visit(resolved.resolvedFileName);
    }
  }
  visit(path.resolve("src/proxy.ts"));
  expect([...imports]).not.toContain("pg");
  expect([...imports]).not.toContain("drizzle-orm/node-postgres");
});
