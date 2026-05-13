import { z } from "zod";

/**
 * Operational risk of an entry (file / table / RPC).
 *
 * Used to inform CI gate strictness and review requirements. `critical` implies
 * `deletePolicy: LOCKED` (V1-4 invariant relationnel is V1.5 ; V1 invariant is
 * weaker — just `LOCKED ⇒ critical` ; no reverse implication yet).
 */
export const RiskSchema = z.enum(["low", "medium", "high", "critical"]);

export type Risk = z.infer<typeof RiskSchema>;
