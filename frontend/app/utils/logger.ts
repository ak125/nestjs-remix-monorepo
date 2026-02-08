/**
 * Centralized logger for the Remix frontend.
 * - In production: suppresses debug/log, keeps warn/error
 * - In development: logs everything
 */
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug("[DEBUG]", ...args);
  },
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
