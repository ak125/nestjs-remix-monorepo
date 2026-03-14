import {
  RoleId,
  FORBIDDEN_ROLE_IDS,
  LEGACY_ROLE_ALIASES,
  normalizeRoleId,
  assertCanonicalRole,
} from './role-ids';

describe('normalizeRoleId', () => {
  describe('canonical passthrough', () => {
    it('should return R3_CONSEILS for canonical input', () => {
      expect(normalizeRoleId('R3_CONSEILS')).toBe(RoleId.R3_CONSEILS);
    });

    it('should return R6_GUIDE_ACHAT for canonical input', () => {
      expect(normalizeRoleId('R6_GUIDE_ACHAT')).toBe(RoleId.R6_GUIDE_ACHAT);
    });

    it('should return R1_ROUTER for canonical input', () => {
      expect(normalizeRoleId('R1_ROUTER')).toBe(RoleId.R1_ROUTER);
    });
  });

  describe('legacy alias mapping', () => {
    it('should map R3_guide → R6_GUIDE_ACHAT', () => {
      expect(normalizeRoleId('R3_guide')).toBe(RoleId.R6_GUIDE_ACHAT);
    });

    it('should map R3_guide_achat → R6_GUIDE_ACHAT', () => {
      expect(normalizeRoleId('R3_guide_achat')).toBe(RoleId.R6_GUIDE_ACHAT);
    });

    it('should map R3_BLOG → R3_CONSEILS', () => {
      expect(normalizeRoleId('R3_BLOG')).toBe(RoleId.R3_CONSEILS);
    });

    it('should map R1_pieces → R1_ROUTER', () => {
      expect(normalizeRoleId('R1_pieces')).toBe(RoleId.R1_ROUTER);
    });

    it('should map R4_GLOSSARY → R4_REFERENCE', () => {
      expect(normalizeRoleId('R4_GLOSSARY')).toBe(RoleId.R4_REFERENCE);
    });

    it('should map R6_BUYING_GUIDE → R6_GUIDE_ACHAT', () => {
      expect(normalizeRoleId('R6_BUYING_GUIDE')).toBe(RoleId.R6_GUIDE_ACHAT);
    });
  });

  describe('worker page types', () => {
    it('should map R3_guide_howto → R3_GUIDE', () => {
      expect(normalizeRoleId('R3_guide_howto')).toBe(RoleId.R3_GUIDE);
    });

    it('should map R5_diagnostic → R5_DIAGNOSTIC', () => {
      expect(normalizeRoleId('R5_diagnostic')).toBe(RoleId.R5_DIAGNOSTIC);
    });

    it('should map R6_guide_achat → R6_GUIDE_ACHAT', () => {
      expect(normalizeRoleId('R6_guide_achat')).toBe(RoleId.R6_GUIDE_ACHAT);
    });
  });

  describe('rejection of ambiguous / unknown', () => {
    it('should reject bare R3', () => {
      expect(normalizeRoleId('R3')).toBeNull();
    });

    it('should reject bare R6', () => {
      expect(normalizeRoleId('R6')).toBeNull();
    });

    it('should reject bare R9', () => {
      expect(normalizeRoleId('R9')).toBeNull();
    });

    it('should reject unknown string', () => {
      expect(normalizeRoleId('NONSENSE')).toBeNull();
    });

    it('should reject empty string', () => {
      expect(normalizeRoleId('')).toBeNull();
    });

    it.each(FORBIDDEN_ROLE_IDS)(
      'should reject forbidden role ID "%s"',
      (id) => {
        expect(normalizeRoleId(id)).toBeNull();
      },
    );
  });
});

describe('assertCanonicalRole', () => {
  it('should return canonical role for valid input', () => {
    expect(assertCanonicalRole('R3_CONSEILS')).toBe(RoleId.R3_CONSEILS);
  });

  it('should throw for legacy alias', () => {
    expect(() => assertCanonicalRole('R3_guide')).toThrow(
      'Non-canonical role in output',
    );
  });

  it('should throw for ambiguous role', () => {
    expect(() => assertCanonicalRole('R3')).toThrow(
      'Non-canonical role in output',
    );
  });

  it('should throw for deprecated R9_GOVERNANCE in output', () => {
    expect(() => assertCanonicalRole('R9_GOVERNANCE')).toThrow(
      'Deprecated role in output',
    );
  });
});

describe('anti-regression: no forbidden roles in enum output path', () => {
  const outputSafeRoles = Object.values(RoleId).filter(
    (r) => r !== RoleId.R9_GOVERNANCE,
  );

  it.each(outputSafeRoles)('assertCanonicalRole should accept %s', (role) => {
    expect(assertCanonicalRole(role)).toBe(role);
  });

  it('FORBIDDEN_ROLE_IDS should all be rejected by normalizeRoleId', () => {
    for (const forbidden of FORBIDDEN_ROLE_IDS) {
      expect(normalizeRoleId(forbidden)).toBeNull();
    }
  });

  it('every LEGACY_ROLE_ALIASES target should pass assertCanonicalRole', () => {
    for (const target of Object.values(LEGACY_ROLE_ALIASES)) {
      expect(() => assertCanonicalRole(target)).not.toThrow();
    }
  });
});

describe('LEGACY_ROLE_ALIASES', () => {
  it('should have all values be valid RoleId members', () => {
    const validRoleIds = new Set(Object.values(RoleId));
    for (const [_alias, target] of Object.entries(LEGACY_ROLE_ALIASES)) {
      expect(validRoleIds.has(target)).toBe(true);
    }
  });
});
