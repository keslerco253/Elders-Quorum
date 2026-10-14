import fs from "fs";
import path from "path";
import { DATA_DIR } from "./db";

const norm = (s: string) => s.trim().replace(/^["']|["']$/g, "").trim().toLowerCase();

/**
 * The setup code from the server's settings. Spaces at the ends, quotes and
 * capital letters don't matter (phones capitalize the first letter).
 */
export function setupCodeMatches(typed: string): boolean {
  const code = process.env.SETUP_CODE;
  return !!code && norm(code) !== "" && norm(typed) === norm(code);
}

/**
 * Whether the data folder is its own disk (a Docker or Northflank volume).
 * If not, everything is erased each time the app is rebuilt. Only checked on
 * Linux servers; elsewhere this says true.
 */
export function dataOnVolume(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  let info: string;
  try {
    info = fs.readFileSync("/proc/self/mountinfo", "utf8");
  } catch {
    return true;
  }
  const dir = path.resolve(DATA_DIR);
  const mounts = info.split("\n").map((l) => l.split(" ")[4]).filter((m) => m && m !== "/");
  return mounts.some((m) => dir === m || dir.startsWith(m + "/"));
}
