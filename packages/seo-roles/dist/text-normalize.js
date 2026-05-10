"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSeoText = normalizeSeoText;
exports.normalizePhrase = normalizePhrase;
exports.tokenize = tokenize;
exports.stem = stem;
exports.tokenizeAndStem = tokenizeAndStem;
const FR_STOPWORDS = new Set([
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou",
    "a", "au", "aux", "en", "sur", "pour", "par", "avec", "sans",
    "ce", "cet", "cette", "ces", "ma", "mon", "mes", "ta", "ton", "tes",
    "sa", "son", "ses", "qui", "que", "quoi", "dont", "ne", "pas",
    "qu", "j",
]);
const MIN_TOKEN_LEN = 2;
const MIN_STEM_LEN = 4;
function normalizeSeoText(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u2018\u2019\u02bc\x60]/g, "'")
        .replace(/[^\p{L}\p{N}'\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizePhrase(text) {
    return normalizeSeoText(text).replace(/'/g, " ").replace(/\s+/g, " ").trim();
}
function tokenize(text, locale = "fr-FR") {
    void locale;
    return normalizeSeoText(text)
        .replace(/'/g, " ")
        .split(" ")
        .filter((t) => t.length >= MIN_TOKEN_LEN && !FR_STOPWORDS.has(t));
}
const FR_LIGHT_SUFFIXES = [
    "issement", "issements",
    "iquement", "iquer", "iques", "ique",
    "ements", "ement",
    "ables", "able",
    "istes", "iste",
    "ation", "ations", "ition", "itions",
    "aient", "ions", "iez", "ait", "ais",
    "ant", "ent", "ons",
    "eaux", "aux",
    "eux", "euse", "euses",
    "ees", "ee",
    "er", "ir", "re", "ez",
    "es", "x", "s", "e",
];
function lightStemFr(token) {
    let t = token;
    if (t.length <= MIN_STEM_LEN)
        return t;
    for (const suffix of FR_LIGHT_SUFFIXES) {
        if (t.length - suffix.length >= MIN_STEM_LEN && t.endsWith(suffix)) {
            t = t.slice(0, -suffix.length);
            break;
        }
    }
    return t;
}
function stem(token, locale = "fr-FR") {
    if (locale !== "fr-FR") {
        throw new Error(`Stemmer locale "${locale}" not supported. Add an explicit branch in stem() before use.`);
    }
    return lightStemFr(token);
}
function tokenizeAndStem(text, locale = "fr-FR") {
    return new Set(tokenize(text, locale).map((t) => stem(t, locale)));
}
//# sourceMappingURL=text-normalize.js.map