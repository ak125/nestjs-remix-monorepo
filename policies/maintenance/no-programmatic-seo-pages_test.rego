# policies/maintenance/no-programmatic-seo-pages_test.rego
#
# Unit tests for the Maintenance anti-SEO-farm invariant.
# Run : conftest verify --policy policies/maintenance

package maintenance.no_programmatic_seo_pages

import rego.v1

test_no_entretien_routes_passes if {
	count(deny) == 0 with input as {
		"routes": [
			{"path": "/", "source": "remix"},
			{"path": "/diagnostic-auto/freinage", "source": "remix"},
		],
		"adr_overrides": {},
	}
}

test_entretien_without_override_fails if {
	count(deny) > 0 with input as {
		"routes": [{"path": "/entretien/vidange", "source": "remix"}],
		"adr_overrides": {},
	}
}

test_entretien_with_valid_override_passes if {
	count(deny) == 0 with input as {
		"routes": [{"path": "/entretien/vidange", "source": "remix"}],
		"adr_overrides": {
			"/entretien/vidange": {
				"adr_id": "ADR-079",
				"approved_at": "2026-06-01",
				"reviewer": "@architects",
			},
		},
	}
}

test_template_placeholder_rejected_even_with_override if {
	count(deny) > 0 with input as {
		"routes": [{"path": "/entretien/vidange-{vehicle-slug}", "source": "remix"}],
		"adr_overrides": {
			"/entretien/vidange-{vehicle-slug}": {
				"adr_id": "ADR-079",
				"approved_at": "2026-06-01",
				"reviewer": "@architects",
			},
		},
	}
}

test_malformed_override_rejected if {
	count(deny) > 0 with input as {
		"routes": [{"path": "/entretien/vidange", "source": "remix"}],
		"adr_overrides": {
			"/entretien/vidange": {"adr_id": "ADR-079"},
		},
	}
}
