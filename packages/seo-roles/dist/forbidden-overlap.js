"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getForbiddenOverlap = getForbiddenOverlap;
const canonical_1 = require("./canonical");
const FORBIDDEN_TERMS = {
    [canonical_1.RoleId.R0_HOME]: Object.freeze([]),
    [canonical_1.RoleId.R1_ROUTER]: Object.freeze([
        "bruit", "use", "casse", "probleme", "symptome", "panne", "defaillance",
        "vibration", "claquement",
        "quand", "pourquoi", "comment diagnostiquer",
        "definition", "qu'est-ce que", "compose de", "glossaire",
        "demontage", "remontage", "etapes de remplacement",
        "guide d'achat",
        "prix", "euro", "en stock", "livraison", "ajouter au panier",
    ]),
    [canonical_1.RoleId.R2_PRODUCT]: Object.freeze([]),
    [canonical_1.RoleId.R3_CONSEILS]: Object.freeze([
        "selectionnez votre vehicule", "filtrer par", "tous les vehicules compatibles",
        "definition", "qu'est-ce que", "compose de", "au sens strict", "glossaire",
        "diagnostiquer", "bruit anormal", "code dtc", "code obd",
        "guide d'achat",
        "commander", "ajouter au panier", "prix", "euro", "en stock", "livraison",
        "promotion",
    ]),
    [canonical_1.RoleId.R4_REFERENCE]: Object.freeze([
        "prix", "euro", "acheter", "commander", "ajouter au panier", "livraison",
        "en stock", "promotion",
        "selectionnez votre vehicule", "filtrer par", "tous les vehicules compatibles",
        "demontage", "remontage", "etapes de remplacement",
        "symptome", "bruit anormal", "panne", "diagnostic",
    ]),
    [canonical_1.RoleId.R5_DIAGNOSTIC]: Object.freeze([
        "prix", "euro", "acheter", "commander", "ajouter au panier", "livraison",
        "en stock", "promotion",
        "guide d'achat",
        "definition", "compose de", "glossaire",
        "selectionnez votre vehicule",
    ]),
    [canonical_1.RoleId.R6_GUIDE_ACHAT]: Object.freeze([
        "selectionnez votre vehicule", "filtrer par", "tous les vehicules compatibles",
        "demontage", "remontage", "etapes de remplacement", "couple de serrage",
        "symptome", "bruit anormal", "panne", "diagnostic", "code dtc", "code obd",
        "definition", "qu'est-ce que", "compose de", "glossaire",
        "ajouter au panier", "commander", "en stock", "livraison", "promotion",
    ]),
    [canonical_1.RoleId.R6_SUPPORT]: Object.freeze([
        "prix", "euro", "acheter", "commander", "ajouter au panier", "promotion",
        "selectionnez votre vehicule", "filtrer par",
    ]),
    [canonical_1.RoleId.R7_BRAND]: Object.freeze([
        "prix", "euro", "acheter", "commander", "ajouter au panier", "promotion",
        "demontage", "remontage", "etapes de remplacement",
        "symptome", "bruit anormal", "panne",
    ]),
    [canonical_1.RoleId.R8_VEHICLE]: Object.freeze([
        "demontage", "remontage", "etapes de remplacement", "couple de serrage",
        "definition", "qu'est-ce que", "compose de", "glossaire",
    ]),
    [canonical_1.RoleId.R3_GUIDE]: Object.freeze([]),
    [canonical_1.RoleId.R9_GOVERNANCE]: Object.freeze([]),
    [canonical_1.RoleId.AGENTIC_ENGINE]: Object.freeze([]),
    [canonical_1.RoleId.FOUNDATION]: Object.freeze([]),
};
function getForbiddenOverlap(role) {
    return FORBIDDEN_TERMS[role] ?? [];
}
//# sourceMappingURL=forbidden-overlap.js.map