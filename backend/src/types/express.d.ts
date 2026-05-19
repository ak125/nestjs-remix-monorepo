/**
 * Extension TypeScript pour Express Request
 * Ajoute les propriétés Passport.js et session personnalisées
 *
 * Auth metadata fields (_authPath, _authClaims) added by sitemap OIDC auth
 * Phase 0 — cf. docs/superpowers/plans/2026-05-16-sitemap-regen-auth-impl.md.
 * Each guard writes _authPath on success ; GithubOidcGuard also writes
 * _authClaims with the validated JWT payload.
 *
 * `vehicleContext` is hydrated by VehicleContextMiddleware (PR-B.2) on the
 * narrow surfaces that need it. Always optional — anonymous browsing must
 * keep working.
 */

import 'express-session';
import type { VehicleContext } from '@repo/registry';

declare module 'express-session' {
  interface SessionData {
    googleNonce?: string;
  }
}

// Forward declaration to avoid circular import. The concrete claims interface
// lives in github-oidc.service.ts (Phase 1) and is imported there for real use.
interface GithubOidcClaimsLike {
  repository?: string;
  event_name?: string;
  ref?: string;
  workflow_ref?: string;
  job_workflow_ref?: string;
  sub?: string;
  run_id?: string;
  actor?: string;
  sha?: string;
  jti?: string;
}

declare global {
  namespace Express {
    interface User {
      id_utilisateur: number;
      email: string;
      nom?: string;
      prenom?: string;
      telephone?: string;
      societe?: string;
      id_role?: number;
      date_creation?: Date;
      [key: string]: any;
    }

    interface Request {
      user?: User;
      isAuthenticated(): boolean;
      logIn(user: User, done: (err: any) => void): void;
      logOut(done: (err: any) => void): void;
      _authPath?: 'admin-session' | 'github-oidc' | 'internal-key-legacy';
      _authClaims?: GithubOidcClaimsLike;
      vehicleContext?: VehicleContext;
    }
  }
}

export {};
