"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchIntentSchema = void 0;
exports.classifyKeywordToRole = classifyKeywordToRole;
const zod_1 = require("zod");
const branded_1 = require("./branded");
const canonical_1 = require("./canonical");
exports.SearchIntentSchema = zod_1.z.enum([
    "transactionnelle",
    "informationnelle",
    "navigationnelle",
    "diagnostique",
    "investigation_commerciale",
]);
const ROLE_KEYWORD_TRIGGERS = {
    [canonical_1.RoleId.R0_HOME]: /(?:^|\s)(accueil|home|automecanik)/i,
    [canonical_1.RoleId.R1_ROUTER]: /(?:^|\s)(compatibilite|compatible|gamme|vehicule|voiture|auto|modele|pour\s+(?:ma|mon|une|un|le|la)?\s*(?:voiture|vehicule)|selon\s+(?:modele|vehicule)|par\s+(?:modele|vehicule))/i,
    [canonical_1.RoleId.R2_PRODUCT]: /(?:^|\s)(acheter|achat|prix|tarif|pas\s*cher|commander|livraison|en\s*stock)/i,
    [canonical_1.RoleId.R3_CONSEILS]: /(?:^|\s)(quand\s+changer|quand\s+remplacer|entretien|remplacement|duree\s+de\s+vie|frequence|comment\s+remplacer|comment\s+changer|epaisseur\s+mini|usure)/i,
    [canonical_1.RoleId.R4_REFERENCE]: /(?:^|\s)(definition|c'est\s+quoi|qu'est|role\s|fonction\s|compose|glossaire)/i,
    [canonical_1.RoleId.R5_DIAGNOSTIC]: /(?:^|\s)(symptome|bruit|vibration|voyant|panne|probleme|claquement|sifflement|diagnostic)/i,
    [canonical_1.RoleId.R6_GUIDE_ACHAT]: /(?:^|\s)(versus|(?<!\w)vs(?!\w)|avis|review|reviews|teste|tests?\b|oem|adaptable|equivalen|alternatif|top\s*\d+|classement|ranking|rapport\s+qualite|prix.?performance|comment\s+choisir|guide|meilleur|comparatif|quel\s|quelle\s|critere|qualite|budget|purflux|mann[\s-]?filter|bosch|mahle|hengst|knecht|filtron|champion|wix|donaldson|fleetguard|meyle|febi[\s-]?bilstein|brembo|trw|ate\b|valeo|luk\b|sachs|nk\b|blue\s*print|japanparts|ashika|nipparts|herth|topran|swag|mapco|ridex|stark|metzger|optimal|skf\b|snr\b|ina\b|fag\b|gates\b|dayco|contitech|corteco|elring|ajusa|glaser|goetze|kolbenschmidt|nural|glyco)/i,
    [canonical_1.RoleId.R6_SUPPORT]: /(?:^|\s)(sav|service\s+apres\s*vente|garantie|retour|remboursement|reclamation)/i,
    [canonical_1.RoleId.R7_BRAND]: /(?:^|\s)(marque|constructeur)/i,
    [canonical_1.RoleId.R8_VEHICLE]: /(?:^|\s)(fiche\s+vehicule|generation|motorisation)/i,
};
function classifyKeywordToRole(rawKeyword) {
    const normalized = rawKeyword
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const orderedRoles = [
        canonical_1.RoleId.R2_PRODUCT,
        canonical_1.RoleId.R5_DIAGNOSTIC,
        canonical_1.RoleId.R3_CONSEILS,
        canonical_1.RoleId.R6_SUPPORT,
        canonical_1.RoleId.R6_GUIDE_ACHAT,
        canonical_1.RoleId.R4_REFERENCE,
        canonical_1.RoleId.R1_ROUTER,
        canonical_1.RoleId.R7_BRAND,
        canonical_1.RoleId.R8_VEHICLE,
        canonical_1.RoleId.R0_HOME,
    ];
    for (const role of orderedRoles) {
        const trigger = ROLE_KEYWORD_TRIGGERS[role];
        if (trigger && trigger.test(normalized)) {
            return { role: (0, branded_1.assertCanonicalRoleStrict)(role), matched: "regex" };
        }
    }
    return {
        role: (0, branded_1.assertCanonicalRoleStrict)(canonical_1.RoleId.R1_ROUTER),
        matched: "default-router",
    };
}
//# sourceMappingURL=keyword-intent.js.map