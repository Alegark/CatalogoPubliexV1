import { readFileSync } from "node:fs";
import path from "node:path";

function findLocalEnvFile(): string | null {
  let directory = process.cwd();

  while (true) {
    const candidate = path.join(directory, ".env.local");

    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      const parent = path.dirname(directory);
      if (parent === directory) return null;
      directory = parent;
    }
  }
}

function parseValue(rawValue: string): string {
  const value = rawValue.trim();
  if (
    value.length >= 2
    && ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function loadLocalEnv(): void {
  const envFile = findLocalEnvFile();
  if (!envFile) return;

  const contents = readFileSync(envFile, "utf8");
  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = parseValue(trimmed.slice(separator + 1));
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();
