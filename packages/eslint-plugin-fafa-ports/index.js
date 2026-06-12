/**
 * @fileoverview ESLint plugin shipping the Diagnostic Control Plane port guards
 * (`fafa-ports`). Loaded by `backend/.eslintrc.js` via `plugins: ['fafa-ports']`.
 *
 * Rules :
 *   - port-method-cap : Port interfaces ≤ 5 methods
 *   - port-dto-shape  : Port DTO interfaces ≤ 8 fields + ≤ 3 nesting
 *
 * Severity tier in `.claude/governance/guard-hierarchy.yaml` :
 *   eslint:fafa-ports/port-method-cap = L2
 *   eslint:fafa-ports/port-dto-shape  = L2
 */

"use strict";

const portMethodCap = require("./rules/port-method-cap");
const portDtoShape = require("./rules/port-dto-shape");

module.exports = {
  meta: {
    name: "fafa-ports",
    version: "0.1.0",
  },
  rules: {
    "port-method-cap": portMethodCap,
    "port-dto-shape": portDtoShape,
  },
};
