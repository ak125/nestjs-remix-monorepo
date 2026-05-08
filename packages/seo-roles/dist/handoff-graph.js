"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_HANDOFF_GRAPH_VERSION = exports.ROLE_HANDOFF_GRAPH = void 0;
exports.getHandoffTargets = getHandoffTargets;
exports.isHandoffAllowed = isHandoffAllowed;
const canonical_1 = require("./canonical");
exports.ROLE_HANDOFF_GRAPH = Object.freeze({
    [canonical_1.RoleId.R0_HOME]: Object.freeze([
        { target: canonical_1.RoleId.R1_ROUTER, condition: "besoin gamme" },
        { target: canonical_1.RoleId.R7_BRAND, condition: "besoin marque" },
        { target: canonical_1.RoleId.R8_VEHICLE, condition: "besoin vehicule" },
        { target: canonical_1.RoleId.R5_DIAGNOSTIC, condition: "besoin symptome" },
        { target: canonical_1.RoleId.R6_GUIDE_ACHAT, condition: "besoin guide achat" },
    ]),
    [canonical_1.RoleId.R1_ROUTER]: Object.freeze([
        { target: canonical_1.RoleId.R2_PRODUCT, condition: "besoin transactionnel exact" },
        { target: canonical_1.RoleId.R4_REFERENCE, condition: "besoin definition" },
        { target: canonical_1.RoleId.R5_DIAGNOSTIC, condition: "besoin symptome" },
        { target: canonical_1.RoleId.R3_CONSEILS, condition: "besoin comment remplacer" },
        { target: canonical_1.RoleId.R6_GUIDE_ACHAT, condition: "besoin comment choisir" },
    ]),
    [canonical_1.RoleId.R2_PRODUCT]: Object.freeze([
        { target: canonical_1.RoleId.R1_ROUTER, condition: "besoin navigation gamme" },
        { target: canonical_1.RoleId.R3_CONSEILS, condition: "besoin tutoriel" },
        { target: canonical_1.RoleId.R4_REFERENCE, condition: "besoin definition" },
        { target: canonical_1.RoleId.R6_GUIDE_ACHAT, condition: "besoin guide achat" },
    ]),
    [canonical_1.RoleId.R3_CONSEILS]: Object.freeze([
        {
            target: canonical_1.RoleId.R6_GUIDE_ACHAT,
            condition: "besoin principal = choix avant achat",
        },
        {
            target: canonical_1.RoleId.R5_DIAGNOSTIC,
            condition: "besoin principal = interpretation symptome",
        },
        {
            target: canonical_1.RoleId.R4_REFERENCE,
            condition: "besoin principal = comprehension definitionnelle",
        },
    ]),
    [canonical_1.RoleId.R4_REFERENCE]: Object.freeze([
        { target: canonical_1.RoleId.R3_CONSEILS, condition: "besoin = comment intervenir" },
        {
            target: canonical_1.RoleId.R5_DIAGNOSTIC,
            condition: "besoin = interpreter un symptome",
        },
        { target: canonical_1.RoleId.R1_ROUTER, condition: "besoin = trouver la bonne gamme" },
        { target: canonical_1.RoleId.R6_GUIDE_ACHAT, condition: "besoin = choisir avant achat" },
    ]),
    [canonical_1.RoleId.R5_DIAGNOSTIC]: Object.freeze([
        { target: canonical_1.RoleId.R3_CONSEILS, condition: "besoin = comment intervenir" },
        {
            target: canonical_1.RoleId.R4_REFERENCE,
            condition: "besoin = comprendre ce que c'est",
        },
        { target: canonical_1.RoleId.R1_ROUTER, condition: "besoin = trouver la bonne gamme" },
    ]),
    [canonical_1.RoleId.R6_GUIDE_ACHAT]: Object.freeze([
        {
            target: canonical_1.RoleId.R1_ROUTER,
            condition: "besoin = verifier compatibilite avant commande",
        },
        { target: canonical_1.RoleId.R2_PRODUCT, condition: "decision prise, pret a acheter" },
        { target: canonical_1.RoleId.R3_CONSEILS, condition: "besoin = comment remplacer" },
        {
            target: canonical_1.RoleId.R5_DIAGNOSTIC,
            condition: "besoin = comprendre un symptome",
        },
        { target: canonical_1.RoleId.R4_REFERENCE, condition: "besoin = definition technique" },
    ]),
    [canonical_1.RoleId.R7_BRAND]: Object.freeze([
        { target: canonical_1.RoleId.R8_VEHICLE, condition: "besoin = fiche vehicule precise" },
        {
            target: canonical_1.RoleId.R1_ROUTER,
            condition: "besoin = trouver gamme compatible",
        },
        { target: canonical_1.RoleId.R2_PRODUCT, condition: "besoin = acheter reference" },
    ]),
    [canonical_1.RoleId.R8_VEHICLE]: Object.freeze([
        { target: canonical_1.RoleId.R1_ROUTER, condition: "besoin = trouver gamme" },
        { target: canonical_1.RoleId.R3_CONSEILS, condition: "besoin = comment intervenir" },
        {
            target: canonical_1.RoleId.R5_DIAGNOSTIC,
            condition: "besoin = interpreter symptome",
        },
        { target: canonical_1.RoleId.R7_BRAND, condition: "besoin = explorer marque" },
    ]),
    [canonical_1.RoleId.R6_SUPPORT]: Object.freeze([]),
    [canonical_1.RoleId.R3_GUIDE]: Object.freeze([]),
    [canonical_1.RoleId.R9_GOVERNANCE]: Object.freeze([]),
    [canonical_1.RoleId.AGENTIC_ENGINE]: Object.freeze([]),
    [canonical_1.RoleId.FOUNDATION]: Object.freeze([]),
});
exports.ROLE_HANDOFF_GRAPH_VERSION = "1.0.0";
function getHandoffTargets(role) {
    return exports.ROLE_HANDOFF_GRAPH[role].map((edge) => edge.target);
}
function isHandoffAllowed(source, target) {
    return exports.ROLE_HANDOFF_GRAPH[source].some((edge) => edge.target === target);
}
//# sourceMappingURL=handoff-graph.js.map