# policies/maintenance/no-programmatic-seo-pages.rego
#
# Anti-SEO-farm invariant for the Maintenance domain (D16).
#
# Canon : feedback_opa_rego_invariants_only.md — Rego MUST express
# invariants, never scoring or thresholds. This file refuses to admit
# programmatic /entretien/* routes unless an explicit ADR override is
# present in the input.
#
# Why : D16 risk is duplicating the SEO-farm pattern already burned in
# the gamme-keyword space (R-SEO-09 hard-block). Maintenance content
# must be authored / curated, not generated per-vehicle / per-mileage.
#
# Severity : L3 (protected-branch hard block) per
# .claude/governance/guard-hierarchy.yaml.
#
# Input contract :
#   input.routes : list of { path: string, source: string, mtime?: string }
#   input.adr_overrides : object keyed by route path → { adr_id: string,
#                          approved_at: string, reviewer: string }
#
# Executed in CI via : conftest test --policy policies/maintenance \
#                       <input-manifest-routes.json>

package maintenance.no_programmatic_seo_pages

import rego.v1

# Default decision : empty deny set ⇒ pass.
default allow := true

# Any /entretien/<slug> route without a matching ADR override = violation.
deny contains msg if {
	route := input.routes[_]
	startswith(route.path, "/entretien/")
	not has_adr_override(route.path)
	msg := sprintf(
		"route %s requires ADR override (anti-SEO-farm). Add entry to input.adr_overrides keyed by this path with adr_id + approved_at + reviewer.",
		[route.path],
	)
}

# Programmatic suffix patterns explicitly forbidden even with an override.
# These shapes are SEO-farm signatures we never want to ship under D16.
deny contains msg if {
	route := input.routes[_]
	startswith(route.path, "/entretien/")
	contains(route.path, "-{")
	msg := sprintf(
		"route %s contains a template placeholder — programmatic generation refused (canon: feedback_no_url_changes_ever + R-SEO-09).",
		[route.path],
	)
}

# Helper : ADR override present and well-formed.
has_adr_override(path) if {
	override := input.adr_overrides[path]
	is_string(override.adr_id)
	is_string(override.approved_at)
	is_string(override.reviewer)
}
