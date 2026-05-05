"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPRECATED_OUTPUT_ROLES = exports.FORBIDDEN_ROLE_IDS = exports.ROLE_TO_PAGE_TYPE = exports.PAGE_TYPE_TO_ROLE = exports.LEGACY_ROLE_ALIASES = void 0;
const canonical_1 = require("./canonical");
exports.LEGACY_ROLE_ALIASES = {
    R3_guide: canonical_1.RoleId.R6_GUIDE_ACHAT,
    R3_guide_achat: canonical_1.RoleId.R6_GUIDE_ACHAT,
    R3_BLOG: canonical_1.RoleId.R3_CONSEILS,
    R1_pieces: canonical_1.RoleId.R1_ROUTER,
    R4_reference: canonical_1.RoleId.R4_REFERENCE,
    R4_GLOSSARY: canonical_1.RoleId.R4_REFERENCE,
    R5_diagnostic: canonical_1.RoleId.R5_DIAGNOSTIC,
    R6_BUYING_GUIDE: canonical_1.RoleId.R6_GUIDE_ACHAT,
};
exports.PAGE_TYPE_TO_ROLE = {
    R1_pieces: canonical_1.RoleId.R1_ROUTER,
    R2_product: canonical_1.RoleId.R2_PRODUCT,
    R3_conseils: canonical_1.RoleId.R3_CONSEILS,
    R3_guide_howto: canonical_1.RoleId.R3_CONSEILS,
    R4_reference: canonical_1.RoleId.R4_REFERENCE,
    R5_diagnostic: canonical_1.RoleId.R5_DIAGNOSTIC,
    R6_guide_achat: canonical_1.RoleId.R6_GUIDE_ACHAT,
    R7_brand: canonical_1.RoleId.R7_BRAND,
    R8_vehicle: canonical_1.RoleId.R8_VEHICLE,
};
exports.ROLE_TO_PAGE_TYPE = {
    [canonical_1.RoleId.R1_ROUTER]: "R1_pieces",
    [canonical_1.RoleId.R2_PRODUCT]: "R2_product",
    [canonical_1.RoleId.R3_GUIDE]: "R3_guide_howto",
    [canonical_1.RoleId.R3_CONSEILS]: "R3_conseils",
    [canonical_1.RoleId.R4_REFERENCE]: "R4_reference",
    [canonical_1.RoleId.R5_DIAGNOSTIC]: "R5_diagnostic",
    [canonical_1.RoleId.R6_GUIDE_ACHAT]: "R6_guide_achat",
    [canonical_1.RoleId.R7_BRAND]: "R7_brand",
    [canonical_1.RoleId.R8_VEHICLE]: "R8_vehicle",
};
exports.FORBIDDEN_ROLE_IDS = ["R3", "R6", "R9", "R3_GUIDE"];
exports.DEPRECATED_OUTPUT_ROLES = new Set([
    canonical_1.RoleId.R9_GOVERNANCE,
    canonical_1.RoleId.R3_GUIDE,
]);
//# sourceMappingURL=legacy.js.map