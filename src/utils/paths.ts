import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);

export const rootDir = path.resolve(path.dirname(currentFile), "..", "..");

export function resolveFromRoot(relativePath: string) {
  return path.join(rootDir, relativePath);
}
