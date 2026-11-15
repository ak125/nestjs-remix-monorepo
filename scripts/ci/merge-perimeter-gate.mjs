#!/usr/bin/env node
// Porte de périmètre de fusion automatique (ADR-123, ADR-124 et ADR-133 du vault).
//
//   node scripts/ci/merge-perimeter-gate.mjs <PR>                     évalue puis fusionne
//   node scripts/ci/merge-perimeter-gate.mjs <PR> --dry-run           évalue seulement
//   node scripts/ci/merge-perimeter-gate.mjs <PR> --dry-run --policy-file <f>
//
// La politique est lue sur `main` du vault et la classification sur la base de la PR :
// une PR ne peut donc ni s'autoriser ni se reclasser. Tout doute vaut refus. La fusion
// est épinglée à la tête nommée par l'enregistrement de revue (DoD2) : si `main` a bougé,
// la PR est refusée, à resynchroniser puis à faire réenregistrer. Code de sortie : 0 admise
// ou fusionnée, 1 refusée, 2 usage ou échec après l'acte.
//
// Niveau B (ADR-133) : il ne s'ouvre que par le bloc `level_b` de la politique, à l'état
// `active`. Il exige, en plus de l'enregistrement DoD2, une approbation GitHub d'une identité
// listée, distincte de l'auteur, sur la tête exacte, et un diff dans la liste fermée de la
// classe « faible risque » d'ADR-128 D5.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const micromatch = require("micromatch");
const yaml = require("js-yaml");
const ts = require("typescript");
const { findOwnershipMatch } = require("../registry/check-new-files.js");

const REPO = "ak125/nestjs-remix-monorepo";
const VAULT_REPO = "ak125/governance-vault";
const POLICY_PATH = "ledger/policies/merge-perimeter.v1.json";
const PAUSE_FILE = "/home/deploy/resync/merge-perimeter.pause";
const LOCK_FILE = "/home/deploy/resync/merge-perimeter.lock";

const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };
const CONFIDENCE_ORDER = { low: 0, medium: 1, high: 2 };
const PASSING_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const PROSE_FILE = /\.(?:md|markdown)$/i;
// Une revue COMMENTED ne change pas la décision d'un relecteur ; ces trois états la fixent.
const DECISIVE_REVIEW_STATES = new Set(["APPROVED", "CHANGES_REQUESTED", "DISMISSED"]);
// Déclarations de cas de test, lues par l'analyseur TypeScript sur le fichier entier (base et tête) :
// commentaires et chaînes, même sur plusieurs lignes, ne peuvent ni cacher ni simuler un test.
// Compte tout appel dont la chaîne d'appel part de `it`, `test` ou `describe` (`it(`, `test.each(t)(`),
// et tout appel qui nomme l'un d'eux plus loin et reçoit un rappel littéral (`suite.test("x", () => …)`) ;
// `/a/.test(v)` ou `motif.test(v)`, sans rappel, n'en est pas un.
const TEST_CALLEES = new Set(["it", "test", "describe"]);
// Modificateurs qui désactivent ou isolent un cas : ignorés pour reconnaître le même test, refusés à l'ajout.
const DISABLING_MODIFIERS = new Set(["skip", "only", "todo", "skipIf", "runIf"]);

function scriptKind(filename) {
  if (/\.[jt]sx$/.test(filename)) return ts.ScriptKind.TSX;
  if (/\.[cm]?js$/.test(filename)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** Segments de la chaîne d'appel (`describe.each(t)` → describe, each, ()), ou null si elle n'est pas nommée. */
function calleeSegments(expression) {
  const segments = [];
  let node = expression;
  for (;;) {
    if (ts.isIdentifier(node)) return [node.text, ...segments];
    if (ts.isPropertyAccessExpression(node)) {
      segments.unshift(node.name.text);
      node = node.expression;
    } else if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression;
      segments.unshift(ts.isStringLiteralLike(key) ? key.text : "[]");
      node = node.expression;
    } else if (ts.isCallExpression(node)) {
      segments.unshift("()");
      node = node.expression;
    } else if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isAsExpression(node)) {
      node = node.expression;
    } else {
      return segments.length ? ["?", ...segments] : null;
    }
  }
}

function isTestCall(node) {
  if (!ts.isCallExpression(node)) return false;
  const segments = calleeSegments(node.expression);
  if (!segments?.some((segment) => TEST_CALLEES.has(segment))) return false;
  return TEST_CALLEES.has(segments[0]) || node.arguments.some(isFunctionLiteral);
}

/** Appel de test sur un récepteur autre qu'un nom de test (`suite.test(…)`, `this.it(…)`) : la porte ne suit pas ce récepteur. */
function isQualifiedTestCall(node) {
  return isTestCall(node) && !TEST_CALLEES.has(calleeSegments(node.expression)[0]);
}

function isFunctionLiteral(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function isTestCallback(node) {
  return (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && isTestCall(node.parent) && node.parent.arguments.includes(node);
}

/** Appel sans modificateur et premier argument (titre littéral, sinon texte sans blancs) : `describe("A")`. */
function descriptorOf(call, source) {
  const first = call.arguments[0];
  const title = !first
    ? ""
    : ts.isStringLiteralLike(first)
      ? JSON.stringify(first.text)
      : first.getText(source).replace(/\s+/g, "");
  const callee = calleeSegments(call.expression)
    .filter((segment) => segment !== "()" && !DISABLING_MODIFIERS.has(segment))
    .join(".");
  return `${callee}(${title})`;
}

/**
 * Position syntaxique d'une déclaration : du fichier jusqu'à l'appel, chaque appel de test englobant par
 * son descripteur et chaque autre nœud par sa nature. Un test placé sous un `if`, un `&&`, un `?:`, une
 * boucle ou dans un nouvel appel englobant (`describe`, `registry.test`, `describe.each([])`) change de position.
 */
function positionOf(node, source) {
  const steps = [];
  for (let parent = node.parent; parent && !ts.isSourceFile(parent); parent = parent.parent) {
    if (isTestCallback(parent) || (ts.isBlock(parent) && isTestCallback(parent.parent))) continue;
    steps.unshift(isTestCall(parent) ? descriptorOf(parent, source) : ts.SyntaxKind[parent.kind]);
  }
  return steps.join(">");
}

/**
 * Vrai si le sous-arbre contient un appel (`f()`, `new F()`, gabarit étiqueté) hors fonctions imbriquées :
 * sans appel, rien n'est vérifié ; un appel dans une fonction jamais appelée (`const f = () => check()`) ne compte pas.
 */
function containsCall(node) {
  if (ts.isCallExpression(node) || ts.isNewExpression(node) || ts.isTaggedTemplateExpression(node)) return true;
  if (isFunctionLike(node)) return false;
  return Boolean(ts.forEachChild(node, (child) => (containsCall(child) ? true : undefined)));
}

/** Condition faite de littéraux et d'opérateurs seulement (`false`, `!0`, `1 === 2`, `false as const`, `[]`). */
function isConstant(expression) {
  const node = unwrap(expression);
  if (ts.isPrefixUnaryExpression(node)) return isConstant(node.operand);
  if (ts.isTypeOfExpression(node) || ts.isVoidExpression(node)) return ts.isVoidExpression(node) || isConstant(node.expression);
  if (ts.isBinaryExpression(node)) return isConstant(node.left) && isConstant(node.right);
  if (ts.isConditionalExpression(node)) return isConstant(node.condition) && isConstant(node.whenTrue) && isConstant(node.whenFalse);
  return (
    ts.isLiteralExpression(node) ||
    ts.isArrayLiteralExpression(node) ||
    ts.isObjectLiteralExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind) ||
    (ts.isIdentifier(node) && ["undefined", "NaN", "Infinity"].includes(node.text))
  );
}

/**
 * Condition d'un nœud qui peut sauter du code : `if`, `?:`, `while`, `for`, opérande gauche de `&&`, `||`, `??`.
 * Le corps d'un `do … while` s'exécute avant sa condition ; `while (true)` et `for (;; )` sont des boucles
 * ordinaires (le code qui les suit sans `break` est relevé inatteignable par l'analyse de flot).
 */
function conditionOf(node) {
  if (ts.isWhileStatement(node) || ts.isForStatement(node)) {
    return node.condition && unwrap(node.condition).kind !== ts.SyntaxKind.TrueKeyword ? node.condition : undefined;
  }
  if (ts.isIfStatement(node)) return node.expression;
  if (ts.isConditionalExpression(node)) return node.condition;
  if (
    ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken].includes(node.operatorToken.kind)
  ) {
    return node.left;
  }
  return undefined;
}

function isFunctionLike(node) {
  return ts.isFunctionLike(node) && !ts.isTypeNode(node);
}

/**
 * Programme TypeScript réduit au seul fichier (sans bibliothèque ni résolution de modules) : son analyse
 * de flot donne le code inatteignable, son vérificateur la portée des noms.
 */
function analysisProgram(source) {
  const host = ts.createCompilerHost({});
  host.getSourceFile = (name) => (name === source.fileName ? source : undefined);
  const options = { allowJs: true, checkJs: true, allowUnreachableCode: false, noLib: true, noResolve: true, types: [] };
  return ts.createProgram([source.fileName], options, host);
}

/**
 * Plages de code inatteignable selon l'analyse de flot de TypeScript (diagnostic 7027) :
 * instruction après un `return`, un `throw`, un `break` ou un `continue`, à toute profondeur,
 * branche `if (false)`, corps de boucle sortie aussitôt.
 */
function unreachableRanges(program, source) {
  return program
    .getSemanticDiagnostics(source)
    .filter((diagnostic) => diagnostic.code === 7027)
    .map((diagnostic) => [diagnostic.start, diagnostic.start + diagnostic.length]);
}

/**
 * Test qui ne vérifie plus rien : aucun rappel littéral, rappel sans aucun appel (`() => undefined`,
 * `() => void 0`, corps vide), corps ouvert par un `return` sans appel ; ou, dans le rappel hors
 * fonctions imbriquées : un `return` autre que la dernière instruction du corps (`if (x) return;`,
 * `{ return; }`), du code inatteignable, une condition faite de littéraux (`if (false as const)`, `false && …`).
 */
function isNeutralised(call, unreachable) {
  if (ts.isCallExpression(call.parent) && call.parent.expression === call) return false;
  const callback = [...call.arguments].reverse().find(isFunctionLiteral);
  if (!callback || !containsCall(callback.body)) return true;
  if (unreachable.some(([start, end]) => start >= callback.body.pos && end <= callback.body.end)) return true;
  if (!ts.isBlock(callback.body)) return Boolean(findInBody(callback.body, (node) => conditionOf(node) && isConstant(conditionOf(node))));
  const statements = callback.body.statements;
  const [first] = statements;
  if (ts.isReturnStatement(first) && !(first.expression && containsCall(first.expression))) return true;
  const last = statements.at(-1);
  return Boolean(
    findInBody(callback.body, (node) =>
      (ts.isReturnStatement(node) && node !== last) || (conditionOf(node) !== undefined && isConstant(conditionOf(node)))),
  );
}

/** Premier nœud du corps (fonctions imbriquées exclues) qui satisfait `predicate`. */
function findInBody(body, predicate) {
  const visit = (node) => {
    if (predicate(node)) return node;
    if (isFunctionLike(node)) return undefined;
    return ts.forEachChild(node, visit);
  };
  return predicate(body) ? body : ts.forEachChild(body, visit);
}

// Modules d'où un nom de test peut être importé sous son propre nom.
const TEST_FRAMEWORK_MODULES = new Set(["vitest", "@jest/globals", "node:test"]);

/** Vrai si `node` est la racine ou un segment de la chaîne appelée d'un appel (`describe` dans `describe.each(t)(…)`). */
function isInCallee(node) {
  let current = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node ? node.parent : node;
  for (;;) {
    const parent = current.parent;
    if (
      (ts.isPropertyAccessExpression(parent) ||
        ts.isElementAccessExpression(parent) ||
        ts.isNonNullExpression(parent) ||
        ts.isParenthesizedExpression(parent) ||
        ts.isAsExpression(parent)) &&
      parent.expression === current
    ) {
      current = parent;
    } else {
      return ts.isCallExpression(parent) && parent.expression === current;
    }
  }
}

/** Import d'un nom de test depuis un module de test, sous son propre nom (`import { it } from "vitest"`). */
function isFrameworkImport(node) {
  const specifier = node.parent;
  if (!ts.isImportSpecifier(specifier) || specifier.name !== node) return false;
  if (specifier.propertyName && specifier.propertyName.text !== node.text) return false;
  const declaration = specifier.parent.parent.parent;
  return ts.isStringLiteral(declaration.moduleSpecifier) && TEST_FRAMEWORK_MODULES.has(declaration.moduleSpecifier.text);
}

const GLOBAL_OBJECTS = new Set(["globalThis", "global", "window", "self"]);
// Appels qui modifient un objet ou un module par une clé : une clé de test y est une redéfinition.
const MUTATING_CALLS = new Set(["stubGlobal", "defineProperty", "defineProperties", "assign", "set", "setPrototypeOf", "spyOn", "mock", "doMock"]);
// Parmi eux, ceux qui modifient l'objet passé en premier argument, quelle que soit la clé.
const OBJECT_MUTATORS = new Set(["defineProperty", "defineProperties", "assign", "set", "setPrototypeOf"]);

function unwrap(node) {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current) || ts.isTypeAssertionExpression(current) || ts.isSatisfiesExpression(current)) {
    current = current.expression;
  }
  return current;
}

function isGlobalObject(node) {
  const inner = unwrap(node);
  return ts.isIdentifier(inner) && GLOBAL_OBJECTS.has(inner.text);
}

function lastSegment(call) {
  const segments = calleeSegments(call.expression);
  return segments ? segments.filter((segment) => segment !== "()").at(-1) : undefined;
}

function isAssignmentTarget(node) {
  for (let current = node; current.parent; current = current.parent) {
    const parent = current.parent;
    if (ts.isBinaryExpression(parent) && parent.left === current) {
      return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
    }
    if ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(parent.operator)) return true;
    if (!(ts.isObjectLiteralExpression(parent) || ts.isArrayLiteralExpression(parent) || ts.isPropertyAssignment(parent) || ts.isShorthandPropertyAssignment(parent) || ts.isSpreadElement(parent) || ts.isSpreadAssignment(parent) || ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent) || ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent))) return false;
  }
  return false;
}

/**
 * Modification d'un objet global à clés lisibles : `defineProperty(g, "clé", …)`, `Reflect.set(g, "clé", …)`,
 * `Object.assign(g, { clé: … })`, `defineProperties(g, { clé: … })` ; les clés de test y sont relevées à part.
 */
function hasLiteralKeys(call) {
  const name = lastSegment(call);
  const [, key, ...rest] = call.arguments;
  if (name === "defineProperty" || name === "set") return Boolean(key) && ts.isStringLiteralLike(unwrap(key));
  if (name === "assign" || name === "defineProperties") {
    return [key, ...rest].every((argument) => {
      const object = argument && unwrap(argument);
      return object && ts.isObjectLiteralExpression(object) && object.properties.every((property) => (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property) || ts.isMethodDeclaration(property)) && !ts.isComputedPropertyName(property.name));
    });
  }
  return false;
}

/** Argument (direct) d'un appel qui modifie par clé, ou d'un appel qui reçoit aussi un objet global. */
function isMutatingArgument(node) {
  let current = node;
  while (ts.isPropertyAssignment(current.parent) || ts.isObjectLiteralExpression(current.parent) || ts.isComputedPropertyName(current.parent) || ts.isArrayLiteralExpression(current.parent)) {
    current = current.parent;
  }
  const call = current.parent;
  if (!ts.isCallExpression(call) || !call.arguments.includes(current)) return false;
  return MUTATING_CALLS.has(lastSegment(call)) || call.arguments.some(isGlobalObject);
}

/** Les données (`{ test: 1 }`, `dept("test")`, `config.test`) ne sont pas des références. */
function isDataKey(node) {
  const parent = node.parent;
  return (
    ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) ||
    (ts.isPropertyAccessExpression(parent) && parent.name === node)
  );
}

/** Propriété du parent qui porte `node` (`name`, `initializer`, `arguments`…) : le rôle de la référence. */
function roleOf(node) {
  const parent = node.parent;
  for (const key of Object.keys(parent)) {
    if (key === "parent") continue;
    const value = parent[key];
    if (value === node || (Array.isArray(value) && value.includes(node))) return key;
  }
  return "?";
}

function isInType(node) {
  for (let current = node.parent; current && !ts.isSourceFile(current); current = current.parent) {
    if (ts.isTypeNode(current) && !ts.isExpressionWithTypeArguments(current)) return true;
  }
  return false;
}

/** Nom lié (déclaration, paramètre, import) ou affecté sous toute forme. */
function isBinding(node) {
  const parent = node.parent;
  return ((ts.isDeclaration(parent) || ts.isImportSpecifier(parent) || ts.isImportClause(parent)) && parent.name === node) || isAssignmentTarget(node);
}

/**
 * Lecture ordinaire d'un objet global, seul usage admis : propriété nommée (`window.location`), clé
 * littérale (`globalThis["fetch"]`), `typeof window`, position de type, nom local (`const { window } = dom`),
 * premier argument d'une modification à clés littérales (`Object.defineProperty(window, "location", …)`,
 * `vi.spyOn(window, "fetch")`).
 */
function isPlainGlobalUse(node) {
  let outer = node;
  while (ts.isParenthesizedExpression(outer.parent) || ts.isAsExpression(outer.parent) || ts.isNonNullExpression(outer.parent) || ts.isSatisfiesExpression(outer.parent)) outer = outer.parent;
  const parent = outer.parent;
  if (isInType(node) || isDataKey(node)) return true;
  if ((ts.isDeclaration(parent) || ts.isBindingElement(parent)) && !ts.isShorthandPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === outer) return parent.name.text !== "constructor";
  if (ts.isElementAccessExpression(parent) && parent.expression === outer) return ts.isStringLiteralLike(unwrap(parent.argumentExpression)) && unwrap(parent.argumentExpression).text !== "constructor";
  if (ts.isTypeOfExpression(parent)) return true;
  if (ts.isCallExpression(parent) && parent.arguments[0] === outer) {
    const name = lastSegment(parent);
    if (name === "assign" || name === "defineProperties") return hasLiteralKeys(parent);
    const key = parent.arguments[1] && unwrap(parent.arguments[1]);
    if (KEYED_CALLS.has(name)) return Boolean(key) && ts.isStringLiteralLike(key) && key.text !== "constructor";
  }
  return false;
}

// Appels qui lisent ou modifient un objet par une clé en second argument.
const KEYED_CALLS = new Set(["defineProperty", "set", "get", "has", "deleteProperty", "getOwnPropertyDescriptor", "hasOwn", "hasOwnProperty", "spyOn"]);

// Voies d'accès au code dynamique ou à l'objet global sans le nommer.
const DYNAMIC_CODE_NAMES = new Set(["eval", "Function"]);
const DYNAMIC_CODE_MODULES = new Set(["vm", "node:vm"]);

/**
 * `this` hors fonction fléchée et hors classe, dans un script non strict (ni import, ni export, ni
 * `"use strict"`) : il y vaut l'objet global. Un module est strict, son `this` de fonction vaut `undefined`.
 */
function isLooseThis(node, source) {
  if (source.externalModuleIndicator || source.statements.some((statement) => ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === "use strict")) return false;
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isArrowFunction(current)) continue;
    if (ts.isClassLike(current) || ts.isMethodDeclaration(current) || ts.isGetAccessorDeclaration(current) || ts.isSetAccessorDeclaration(current) || ts.isConstructorDeclaration(current)) return false;
    if (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) || ts.isSourceFile(current)) return true;
  }
  return true;
}

/**
 * Références qui peuvent faire disparaître des tests sans changer leur clé : nom de test (`it`, `test`,
 * `describe`) lié, paramètre, alias, import renommé ou hors module de test, affecté sous toute forme ;
 * clé de test écrite sur un objet global ou passée à un appel qui modifie par clé
 * (`vi.stubGlobal("it", …)`, `Object.defineProperty(globalThis, "it", …)`) ; tout usage d'un objet
 * global autre qu'une lecture ordinaire (`isPlainGlobalUse`) ; module de test cité hors d'un import
 * (`vi.mock("vitest", …)`) ; `eval`, `Function`, `.constructor`, module `vm`, `this` non strict.
 * À part, `qualified` : les appels de test sur un récepteur non suivi (`suite.test(…)`), refusés à la tête ;
 * et `aliases` : les références au nom de test lui-même (alias, import renommé, `cond ? describe : …`),
 * qui refusent le fichier dès la base, car les tests déclarés par un alias ne sont pas suivis.
 * Chacune par son nom, la nature et la propriété du parent qui la porte, et sa position : une référence
 * nouvelle à la tête est refusée. Les noms liés ou affectés sont en outre comptés par nom seul.
 */
function testNameReferences(source, checker) {
  // Nom déclaré dans le fichier (variable locale `window`, paramètre) : ce n'est pas l'objet global.
  const isLocal = (node) => {
    const symbol = ts.isShorthandPropertyAssignment(node.parent) ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
    return Boolean(symbol?.declarations?.some((declaration) => declaration.getSourceFile() === source));
  };
  // `expect.any(Function)`, `toBeInstanceOf(Function)`, `x instanceof Function` : le constructeur comme type attendu.
  const isExpectedType = (node) =>
    (ts.isCallExpression(node.parent) && node.parent.arguments.includes(node) && ["any", "toBeInstanceOf"].includes(lastSegment(node.parent))) ||
    (ts.isBinaryExpression(node.parent) && node.parent.right === node && node.parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword);
  const references = [];
  const bindings = [];
  const qualified = [];
  // Références à un nom de test hors appel direct (alias, import renommé, `cond ? describe : …`) :
  // présentes à la base, elles portent des tests que la porte ne suit pas.
  const aliases = [];
  const record = (label, node) => references.push(`${label} : ${ts.SyntaxKind[node.parent.kind]}.${roleOf(node)} @ ${positionOf(node, source)}`);
  const recordTestName = (label, node) => {
    record(label, node);
    aliases.push(references[references.length - 1]);
  };
  const visit = (node) => {
    if (ts.isIdentifier(node) && TEST_CALLEES.has(node.text) && !isInCallee(node) && !isFrameworkImport(node)) {
      const parent = node.parent;
      const globalProperty = ts.isPropertyAccessExpression(parent) && parent.name === node && isGlobalObject(parent.expression);
      if (!isDataKey(node) || globalProperty || isAssignmentTarget(node) || isMutatingArgument(node)) {
        recordTestName(node.text, node);
        if (isBinding(node) || globalProperty || isMutatingArgument(node)) bindings.push(node.text);
      }
    } else if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      const isModuleSpecifier = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node;
      const isKey = (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) || ts.isComputedPropertyName(parent);
      // `{ ["test"]: 1 }` est une donnée, comme `{ test: 1 }` ; passée à un appel qui modifie, elle reste refusée.
      const member = parent.parent;
      const isObjectDataKey =
        ts.isComputedPropertyName(parent) &&
        (ts.isPropertyAssignment(member) || ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) &&
        member.name === parent &&
        ts.isObjectLiteralExpression(member.parent);
      if (TEST_CALLEES.has(node.text) && ((isKey && !isObjectDataKey) || isMutatingArgument(node))) {
        recordTestName(node.text, node);
        bindings.push(node.text);
      }
      if (TEST_FRAMEWORK_MODULES.has(node.text) && !isModuleSpecifier) record(node.text, node);
      if (DYNAMIC_CODE_MODULES.has(node.text) || (node.text === "constructor" && isKey)) record(node.text, node);
    } else if (ts.isCallExpression(node) && lastSegment(node) === "stubGlobal" && node.arguments.length && !ts.isStringLiteralLike(unwrap(node.arguments[0]))) {
      record("stubGlobal à clé calculée", node);
    } else if (ts.isIdentifier(node) && GLOBAL_OBJECTS.has(node.text) && !isPlainGlobalUse(node) && !isLocal(node)) {
      record(`usage de ${node.text}`, node);
    } else if (ts.isIdentifier(node) && DYNAMIC_CODE_NAMES.has(node.text) && !isDataKey(node) && !isInType(node) && !isLocal(node) && !isExpectedType(node)) {
      record(node.text, node);
    } else if (ts.isIdentifier(node) && node.text === "constructor" && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) {
      record("constructor", node);
    } else if (node.kind === ts.SyntaxKind.ThisKeyword && isLooseThis(node, source)) {
      record("this", node);
    }
    if (isQualifiedTestCall(node)) qualified.push(descriptorOf(node, source));
    ts.forEachChild(node, visit);
  };
  visit(source);
  references.bindings = bindings;
  references.qualified = qualified;
  references.aliases = aliases;
  return references;
}

/**
 * Déclarations de test d'un fichier : pour chacune, sa clé (position, puis appel sans modificateur et
 * premier argument), si elle porte un modificateur désactivant et si son rappel est neutralisé ; et les
 * références aux noms de test hors appel. `null` si le fichier ne s'analyse pas sans erreur.
 */
export function testDeclarations(filename, text) {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, scriptKind(filename));
  if (source.parseDiagnostics?.length) return null;
  const declarations = [];
  const program = analysisProgram(source);
  const unreachable = unreachableRanges(program, source);
  const visit = (node) => {
    if (isTestCall(node)) {
      declarations.push({
        key: `${descriptorOf(node, source)} @ ${positionOf(node, source)}`,
        disabled: calleeSegments(node.expression).some((segment) => DISABLING_MODIFIERS.has(segment)),
        neutralised: isNeutralised(node, unreachable),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  declarations.references = testNameReferences(source, program.getTypeChecker());
  return declarations;
}

/** Éléments de `before` absents de `after`, en multiensemble. */
function missingFrom(before, after) {
  const remaining = [...after];
  return before.filter((item) => {
    const index = remaining.indexOf(item);
    if (index === -1) return true;
    remaining.splice(index, 1);
    return false;
  });
}

const LEVEL_B_ARRAYS = [
  "review_identities",
  "allowed_paths",
  "test_paths",
  "test_file_globs",
  "allowed_test_file_statuses",
  "deny_paths",
  "stop_zone_fragments",
  "deny_added_line_patterns",
];

// Format DoD2 (ADR-120 D2) :
//   - [x] Revue niveau <A|B|C> — tête <sha40>, base <sha40>
//         procédure : <…>, par <session, agent ou compte>
const RECORD_LINE =
  /^[ \t]*[-*+][ \t]+\[[xX]\][ \t]*Revue\s+niveau\s+([ABC])\b.*?t[êe]te\s+`?([0-9a-f]{40})`?.*?base\s+`?([0-9a-f]{40})`?/i;
const PROCEDURE_LINE = /^[ \t]*(?:[-*+][ \t]+)?proc[ée]dure[ \t]*:(.*)$/i;
const OUTSIDE_REVIEW = /^\s*revue\s+(?:ind[ée]pendante|humaine)\s*(?:[,;]\s*)?par(?![\p{L}\p{N}])/iu;

const refusal = (code, detail) => ({ code, detail });
const matches = (path, globs) => micromatch.isMatch(path, globs, { dot: true });
const levelBActive = (policy) => policy?.level_b?.status === "active";
// Zone STOP nommée dans le chemin d'un fichier de niveau B (dossier ou nom), Markdown compris, sans tenir compte de la casse.
const stopZoneFragment = (path, fragments) => fragments.find((f) => path.toLowerCase().includes(f.toLowerCase()));

/** Vérifie la forme de la politique, pour refuser au lieu d'évaluer à moitié. */
export function validatePolicy(policy) {
  const arrays = [
    "authorized_review_levels",
    "classification_exempt_paths",
    "generated_projections",
    "deny_paths",
    "deny_diff_patterns",
    "deny_head_branch_prefixes",
    "deny_title_patterns",
  ];
  const problems = arrays.filter((key) => !Array.isArray(policy?.[key])).map((key) => `${key} absent`);
  const c = policy?.classification;
  if (policy?.schema_version !== 1) problems.push("schema_version différent de 1");
  if (policy?.repo !== REPO) problems.push("repo différent du monorepo");
  if (policy?.base !== "main") problems.push("base différente de main");
  if (typeof c?.source_path !== "string") problems.push("classification.source_path absent");
  if (!Array.isArray(c?.allowed_domains)) problems.push("classification.allowed_domains absent");
  if (!(c?.max_risk in RISK_ORDER)) problems.push("classification.max_risk invalide");
  if (!(c?.min_source_confidence in CONFIDENCE_ORDER)) problems.push("classification.min_source_confidence invalide");
  // Le niveau B ne s'ouvre que par `level_b` (ADR-133) ; le niveau C n'est jamais automatique.
  if (Array.isArray(policy?.authorized_review_levels) && policy.authorized_review_levels.some((l) => l !== "A")) {
    problems.push("authorized_review_levels : seul A ; le niveau B s'ouvre par level_b");
  }
  const b = policy?.level_b;
  if (b !== undefined) {
    if (!["active", "inactive"].includes(b?.status)) problems.push("level_b.status invalide");
    for (const key of LEVEL_B_ARRAYS) if (!Array.isArray(b?.[key])) problems.push(`level_b.${key} absent`);
    const identities = Array.isArray(b?.review_identities) ? b.review_identities : [];
    if (identities.length === 0) problems.push("level_b.review_identities vide");
    if (identities.some((login) => typeof login !== "string" || !login.endsWith("[bot]"))) {
      problems.push("level_b.review_identities : identité d'App GitHub (…[bot]) seulement");
    }
    if (identities.includes(policy?.executor?.account)) {
      problems.push("level_b.review_identities : identité confondue avec le compte exécutant");
    }
  }
  return problems;
}

/** Une entrée de classification autorise-t-elle ce chemin ? Renvoie le refus, ou null. */
function classificationRefusal(path, entries, classification) {
  const entry = findOwnershipMatch(path, entries);
  if (!entry) return refusal("UNCLASSIFIED", path);
  const label = `${path} (${entry.domain}, ${entry.risk}, confiance ${entry.sourceConfidence})`;
  if (entry.owner === "__unassigned__" || entry.domain === "UNKNOWN") return refusal("UNCLASSIFIED", label);
  if (!classification.allowed_domains.includes(entry.domain)) return refusal("DOMAIN_REFUSED", label);
  if (!(RISK_ORDER[entry.risk] <= RISK_ORDER[classification.max_risk])) return refusal("RISK_TOO_HIGH", label);
  const confidence = CONFIDENCE_ORDER[entry.sourceConfidence];
  if (!(confidence >= CONFIDENCE_ORDER[classification.min_source_confidence])) {
    return refusal("CONFIDENCE_TOO_LOW", label);
  }
  return null;
}

/** Évalue chaque fichier du diff : `{filename, previous_filename?, patch?}`. */
export function evaluateFiles(policy, entries, files) {
  const refusals = [];
  const diffPatterns = policy.deny_diff_patterns.map((pattern) => new RegExp(pattern));
  for (const file of files) {
    const paths = [file.filename, file.previous_filename].filter(Boolean);
    const handwritten = paths.filter((path) => !matches(path, policy.generated_projections));
    if (handwritten.length === 0) continue;
    let refused = false;
    for (const path of handwritten) {
      let reason = matches(path, policy.deny_paths) ? refusal("DENY_PATH", path) : null;
      if (!reason && !matches(path, policy.classification_exempt_paths)) {
        reason = classificationRefusal(path, entries, policy.classification);
      }
      if (reason) {
        refusals.push(reason);
        refused = true;
      }
    }
    if (refused) continue;
    if (typeof file.patch !== "string") {
      // GitHub omet le patch des binaires et des très gros fichiers : contenu non vérifié.
      refusals.push(refusal("PATCH_UNAVAILABLE", file.filename));
      continue;
    }
    // L'API ne renvoie que les hunks, sans en-têtes de fichier : tout `+` ou `-` est un vrai changement.
    const changed = file.patch.split("\n").filter((line) => /^[+-]/.test(line));
    if (changed.some((line) => diffPatterns.some((pattern) => pattern.test(line)))) {
      refusals.push(refusal("DIFF_PATTERN", file.filename));
    }
  }
  return refusals;
}

/** Lit les enregistrements de revue du corps de la PR. */
export function parseReviewRecords(body) {
  const lines = String(body ?? "").split(/\r?\n/);
  const records = [];
  lines.forEach((line, index) => {
    const anchor = RECORD_LINE.exec(line);
    if (!anchor) return;
    let procedure = "";
    for (let i = index + 1; i < lines.length && lines[i].trim() !== "" && !/^\s*[-*+]\s+\[[ xX]\]/.test(lines[i]); i++) {
      const field = PROCEDURE_LINE.exec(lines[i]);
      if (field) procedure = field[1].trim();
    }
    records.push({ level: anchor[1].toUpperCase(), head: anchor[2], base: anchor[3], procedure });
  });
  return records;
}

/** Applique DoD2 sur la tête courante. Renvoie `{ refusals, level }`. */
export function evaluateReview(policy, body, head, files, base) {
  const records = parseReviewRecords(body);
  const atHead = records.filter((record) => record.head === head);
  if (atHead.length === 0) {
    return { refusals: [refusal(records.length ? "REVIEW_OTHER_HEAD" : "REVIEW_MISSING", head)], level: null };
  }
  const otherBase = atHead.find((record) => record.base !== base);
  if (otherBase) return { refusals: [refusal("REVIEW_OTHER_BASE", otherBase.base)], level: null };
  const levelC = atHead.find((record) => record.level === "C");
  if (levelC) return { refusals: [refusal("REVIEW_LEVEL_REFUSED", "C")], level: "C" };
  if (atHead.some((record) => record.level === "B") && !levelBActive(policy)) {
    return { refusals: [refusal("LEVEL_B_NOT_ACTIVE", String(policy.level_b?.status ?? "absent"))], level: "B" };
  }
  const refused = atHead.filter((record) => record.level === "A" && !policy.authorized_review_levels.includes("A"));
  if (refused.length) return { refusals: [refusal("REVIEW_LEVEL_REFUSED", "A")], level: "A" };
  const refusals = [];
  const level = atHead.some((record) => record.level === "B") ? "B" : "A";
  if (level === "B" && !atHead.some((record) => record.level === "B" && OUTSIDE_REVIEW.test(record.procedure))) {
    refusals.push(refusal("REVIEW_NOT_INDEPENDENT", "le niveau B exige une revue indépendante ou humaine"));
  }
  if (level === "A") {
    const code = files
      .flatMap((file) => [file.filename, file.previous_filename].filter(Boolean))
      .find((path) => !PROSE_FILE.test(path) && !matches(path, policy.generated_projections));
    if (code) refusals.push(refusal("REVIEW_LEVEL_TOO_LOW", code));
  }
  return { refusals, level };
}

/**
 * Niveau B : chaque fichier doit appartenir à la liste fermée de la classe « faible risque »
 * (ADR-128 D5). S'ajoute à `evaluateFiles`, qui reste appliquée.
 */
export function evaluateLevelBFiles(policy, files) {
  const b = policy.level_b;
  const refusals = [];
  const addedPatterns = b.deny_added_line_patterns.map((pattern) => new RegExp(pattern));
  for (const file of files) {
    const paths = [file.filename, file.previous_filename].filter(Boolean);
    let refused = false;
    for (const path of paths) {
      let reason = null;
      if (matches(path, b.deny_paths) || matches(path, policy.deny_paths) || matches(path, policy.generated_projections)) {
        reason = refusal("LEVEL_B_DENY_PATH", path);
      } else if (!matches(path, b.allowed_paths)) {
        reason = refusal("LEVEL_B_PATH_REFUSED", path);
      } else if (matches(path, b.test_paths) && !matches(path, b.test_file_globs)) {
        reason = refusal("LEVEL_B_NOT_TEST_FILE", path);
      } else if (stopZoneFragment(path, b.stop_zone_fragments)) {
        // Zones STOP exclues dans tous les cas (ADR-128 D5) : Markdown et rapports d'audit compris.
        reason = refusal("LEVEL_B_STOP_ZONE", `${path} (${stopZoneFragment(path, b.stop_zone_fragments)})`);
      }
      if (reason) {
        refusals.push(reason);
        refused = true;
      }
    }
    if (refused || !paths.some((path) => matches(path, b.test_paths))) continue;
    // Tests : ajout ou modification seulement, aucun cas retiré, aucun test désactivé.
    if (!b.allowed_test_file_statuses.includes(file.status) || file.previous_filename) {
      refusals.push(refusal("TEST_REMOVED", `${file.filename} (${file.status ?? "statut inconnu"})`));
      continue;
    }
    if (typeof file.patch !== "string") {
      refusals.push(refusal("PATCH_UNAVAILABLE", file.filename));
      continue;
    }
    const addedLines = file.patch
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.slice(1));
    // Le fichier entier à la base de fusion et à la tête : sans eux, rien n'est prouvé.
    if (typeof file.head_content !== "string" || (file.status !== "added" && typeof file.base_content !== "string")) {
      refusals.push(refusal("PATCH_UNAVAILABLE", `${file.filename} (contenu à la base ou à la tête indisponible)`));
      continue;
    }
    const before = file.status === "added" ? [] : testDeclarations(file.filename, file.base_content);
    const after = testDeclarations(file.filename, file.head_content);
    if (!before || !after) {
      refusals.push(refusal("TEST_REMOVED", `${file.filename} (fichier de test non analysable)`));
      continue;
    }
    // Chaque déclaration de la base se retrouve à la tête, même appel et même titre : un test retiré
    // ou mis en commentaire ne se compense pas par un autre ; un titre changé compte comme un retrait.
    const lost = missingFrom(
      before.map((declaration) => declaration.key),
      after.map((declaration) => declaration.key),
    );
    const disabled = missingFrom(
      after.filter((declaration) => declaration.disabled).map((declaration) => declaration.key),
      before.filter((declaration) => declaration.disabled).map((declaration) => declaration.key),
    );
    // Un test de la base vidé à la tête ; un test nouveau, vide, ne retire rien.
    const neutralised = missingFrom(
      after.filter((declaration) => declaration.neutralised).map((declaration) => declaration.key),
      before.filter((declaration) => declaration.neutralised).map((declaration) => declaration.key),
    ).filter((key) => before.some((declaration) => declaration.key === key));
    // Une référence nouvelle à un nom de test (redéfinition, alias, global modifié) peut vider les tests
    // sans changer leur clé : comparée par nature, rôle et position ; un nom lié ou affecté de plus
    // qu'à la base est en outre refusé, quelle que soit sa position.
    const references = [
      ...missingFrom(after.references, before.references ?? []),
      ...missingFrom(after.references.bindings, before.references?.bindings ?? []).map((name) => `${name} lié ou affecté`),
    ];
    // Le récepteur de `suite.test(…)` peut être remplacé sans changer la clé : la porte ne le suit pas.
    if (after.references.qualified.length) {
      refusals.push(refusal("TEST_REMOVED", `${file.filename} (appel de test sur un récepteur non suivi : ${after.references.qualified[0]})`));
    } else if (before.references?.aliases.length) {
      // Un test déclaré par un alias (`check = test`, `import { test as check }`) n'est pas suivi :
      // le retirer ne changerait aucune clé. Le fichier est refusé dès que la base en contient un.
      refusals.push(refusal("TEST_REMOVED", `${file.filename} (nom de test référencé hors appel à la base, alias non suivi : ${before.references.aliases[0]})`));
    } else if (references.length) {
      refusals.push(refusal("TEST_REMOVED", `${file.filename} (nom de test redéfini ou référencé hors appel : ${references[0]})`));
    } else if (lost.length) {
      refusals.push(refusal("TEST_REMOVED", `${file.filename} (déclaration retirée ou déplacée : ${lost[0]})`));
    } else if (neutralised.length) {
      refusals.push(refusal("TEST_REMOVED", `${file.filename} (test vidé ou neutralisé : ${neutralised[0]})`));
    }
    if (disabled.length) {
      refusals.push(refusal("LEVEL_B_DIFF_PATTERN", `${file.filename} (test désactivé ou isolé : ${disabled[0]})`));
    } else if (addedLines.some((line) => addedPatterns.some((pattern) => pattern.test(line)))) {
      refusals.push(refusal("LEVEL_B_DIFF_PATTERN", file.filename));
    }
  }
  return refusals;
}

/**
 * Niveau B : une approbation GitHub d'une identité listée dans `level_b.review_identities`,
 * distincte de l'auteur, sur la tête exacte (`commit_id`). Pour chaque identité listée, seule sa
 * dernière revue décisive compte (APPROVED, CHANGES_REQUESTED ou DISMISSED).
 */
export function evaluateApproval(policy, author, reviews, head) {
  if (!levelBActive(policy)) return [refusal("LEVEL_B_NOT_ACTIVE", String(policy.level_b?.status ?? "absent"))];
  const identities = policy.level_b.review_identities;
  // `gh pr view` nomme une App `app/<slug>`, l'API des revues `<slug>[bot]` : même identité.
  const authorLogin = /^app\//.test(author?.login ?? "") ? `${author.login.slice(4)}[bot]` : author?.login;
  if (!authorLogin) return [refusal("APPROVAL_BY_AUTHOR", "auteur de la PR illisible")];
  const stamp = (review) => Date.parse(review.submitted_at) || 0;
  const latest = new Map();
  for (const review of reviews ?? []) {
    const login = review.user?.login;
    if (!DECISIVE_REVIEW_STATES.has(review.state) || !login) continue;
    const current = latest.get(login);
    if (!current || stamp(review) >= stamp(current)) latest.set(login, review);
  }
  if (identities.includes(authorLogin) || latest.get(authorLogin)?.state === "APPROVED") {
    return [refusal("APPROVAL_BY_AUTHOR", authorLogin)];
  }
  const listed = [...latest.entries()].filter(([login]) => identities.includes(login));
  const withdrawn = listed.find(([, review]) => review.state !== "APPROVED");
  if (withdrawn) return [refusal("APPROVAL_WITHDRAWN", `${withdrawn[0]} : ${withdrawn[1].state}`)];
  if (listed.some(([, review]) => review.commit_id === head)) return [];
  if (listed.length) return [refusal("APPROVAL_OTHER_HEAD", `${listed[0][0]} sur ${listed[0][1].commit_id}`)];
  const unlisted = [...latest.entries()].find(([, review]) => review.state === "APPROVED");
  if (unlisted) return [refusal("APPROVAL_UNLISTED_IDENTITY", unlisted[0])];
  return [refusal("APPROVAL_MISSING", head)];
}

function checkName(check) {
  return check.name ?? check.context ?? "(sans nom)";
}

function checkPasses(check) {
  if (check.__typename === "StatusContext" || check.context) return check.state === "SUCCESS";
  return check.status === "COMPLETED" && PASSING_CONCLUSIONS.has(check.conclusion);
}

/**
 * Le rollup conserve les anciennes exécutions d'un contrôle relancé : seule la dernière
 * compte. Une exécution sans date valide (en file d'attente) est tenue pour la plus récente.
 */
function latestChecks(checks) {
  const stamp = (check) => {
    const time = Date.parse(check.completedAt ?? check.startedAt);
    return time > 0 ? time : Infinity;
  };
  const latest = new Map();
  for (const check of checks) {
    const key = `${check.workflowName ?? ""}\0${checkName(check)}`;
    const current = latest.get(key);
    const newer = current && stamp(check) > stamp(current);
    const tieNotPassing = current && stamp(check) === stamp(current) && !checkPasses(check);
    if (!current || newer || tieNotPassing) latest.set(key, check);
  }
  return [...latest.values()];
}

/** Évalue l'état de la PR et de ses contrôles. */
export function evaluatePullRequest(policy, pr, requiredContexts) {
  const refusals = [];
  if (pr.state !== "OPEN") refusals.push(refusal("PR_NOT_OPEN", pr.state));
  if (pr.baseRefName !== policy.base) refusals.push(refusal("BASE_REFUSED", pr.baseRefName));
  if (pr.isCrossRepository) refusals.push(refusal("FORK_REFUSED", pr.headRefName));
  if (pr.isDraft) refusals.push(refusal("DRAFT", `#${pr.number}`));
  if (policy.deny_title_patterns.some((pattern) => new RegExp(pattern).test(pr.title))) {
    refusals.push(refusal("TITLE_REFUSED", pr.title));
  }
  if (policy.deny_head_branch_prefixes.some((prefix) => pr.headRefName.startsWith(prefix))) {
    refusals.push(refusal("BRANCH_REFUSED", pr.headRefName));
  }
  if (!(pr.assignees ?? []).some((assignee) => !assignee.login.endsWith("[bot]"))) {
    refusals.push(refusal("NO_HUMAN_ASSIGNEE", `#${pr.number}`));
  }
  if (pr.mergeStateStatus !== "CLEAN") refusals.push(refusal("MERGE_STATE_NOT_CLEAN", pr.mergeStateStatus));
  if (pr.behindBy !== 0) refusals.push(refusal("BEHIND_BASE", String(pr.behindBy)));
  const checks = latestChecks(pr.statusCheckRollup ?? []);
  if (checks.length === 0) refusals.push(refusal("CHECKS_ABSENT", "aucun contrôle sur la tête"));
  for (const check of checks) {
    if (!checkPasses(check)) refusals.push(refusal("CHECK_NOT_PASSING", checkName(check)));
  }
  const present = new Set(checks.map(checkName));
  for (const context of requiredContexts) {
    if (!present.has(context)) refusals.push(refusal("CHECK_REQUIRED_ABSENT", context));
  }
  return refusals;
}

function gh(...args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function ghRaw(path) {
  return gh("api", "-H", "Accept: application/vnd.github.raw", path);
}

function readPolicy(policyFile) {
  if (policyFile) return { commit: `fichier local ${policyFile}`, policy: JSON.parse(readFileSync(policyFile, "utf8")) };
  const commit = gh("api", `repos/${VAULT_REPO}/commits/main`, "--jq", ".sha").trim();
  return { commit, policy: JSON.parse(ghRaw(`repos/${VAULT_REPO}/contents/${POLICY_PATH}?ref=${commit}`)) };
}

function readFiles(number, expected) {
  const files = [];
  for (let page = 1; ; page++) {
    const batch = JSON.parse(gh("api", `repos/${REPO}/pulls/${number}/files?per_page=100&page=${page}`));
    files.push(...batch);
    if (batch.length < 100) break;
  }
  if (files.length !== expected) throw new Error(`liste de fichiers incomplète (${files.length}/${expected})`);
  return files;
}

/** Fichiers de test du niveau B : contenu à la base de fusion et à la tête ; un échec de lecture laisse le champ absent (refus). */
export function readTestContents(policy, files, base, head) {
  const at = (path, ref) => {
    try {
      return ghRaw(`repos/${REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${ref}`);
    } catch {
      return undefined;
    }
  };
  for (const file of files) {
    if (!matches(file.filename, policy.level_b.test_paths) || file.previous_filename) continue;
    if (!policy.level_b.allowed_test_file_statuses.includes(file.status)) continue;
    file.head_content = at(file.filename, head);
    if (file.status !== "added" && typeof base === "string") file.base_content = at(file.filename, base);
  }
}

function readReviews(number) {
  const reviews = [];
  for (let page = 1; ; page++) {
    const batch = JSON.parse(gh("api", `repos/${REPO}/pulls/${number}/reviews?per_page=100&page=${page}`));
    reviews.push(...batch);
    if (batch.length < 100) break;
  }
  return reviews;
}

function evaluate(number, policyFile) {
  const { commit, policy } = readPolicy(policyFile);
  const problems = validatePolicy(policy);
  if (problems.length) return { commit, policy, refusals: problems.map((p) => refusal("POLICY_INVALID", p)) };
  const refusals = [];
  if (policy.status !== "active") refusals.push(refusal("POLICY_NOT_ACTIVE", String(policy.status)));
  if (existsSync(PAUSE_FILE)) refusals.push(refusal("PAUSED", PAUSE_FILE));
  const fields =
    "number,state,isDraft,title,body,author,headRefName,headRefOid,baseRefName,baseRefOid,isCrossRepository,assignees,mergeStateStatus,statusCheckRollup,changedFiles";
  const pr = JSON.parse(gh("pr", "view", String(number), "--repo", REPO, "--json", fields));
  const ownership = yaml.load(ghRaw(`repos/${REPO}/contents/${policy.classification.source_path}?ref=${pr.baseRefOid}`));
  if (!Array.isArray(ownership?.entries)) throw new Error("classification illisible");
  const required = JSON.parse(
    gh("api", `repos/${REPO}/branches/${policy.base}`, "--jq", ".protection.required_status_checks.contexts"),
  );
  if (!Array.isArray(required) || required.length === 0) throw new Error("contrôles requis illisibles");
  const files = readFiles(number, pr.changedFiles);
  // L'option `strict` de la protection n'est pas lisible par ce compte : on mesure le retard.
  const compare = JSON.parse(
    gh("api", `repos/${REPO}/compare/${pr.baseRefOid}...${pr.headRefOid}?per_page=1`, "--jq", "{behind_by, merge_base: .merge_base_commit.sha}"),
  );
  pr.behindBy = compare.behind_by;
  pr.mergeBase = compare.merge_base;
  const review = evaluateReview(policy, pr.body, pr.headRefOid, files, pr.baseRefOid);
  refusals.push(
    ...evaluatePullRequest(policy, pr, required),
    ...review.refusals,
    ...evaluateFiles(policy, ownership.entries, files),
  );
  if (review.level === "B" && levelBActive(policy)) {
    readTestContents(policy, files, pr.mergeBase, pr.headRefOid);
    refusals.push(
      ...evaluateLevelBFiles(policy, files),
      ...evaluateApproval(policy, pr.author, readReviews(number), pr.headRefOid),
    );
  }
  return { commit, policy, pr, level: review.level, refusals };
}

function merge({ commit, policy, pr, level }) {
  const account = policy.executor?.account ?? "non renseigné";
  gh(
    "pr",
    "comment",
    String(pr.number),
    "--repo",
    REPO,
    "--body",
    `Fusion automatique (ADR-124) : politique \`${commit}\`, tête \`${pr.headRefOid}\`, revue niveau ${level}, compte prévu \`${account}\`.`,
  );
  execFileSync(
    "flock",
    ["-n", "-E", "75", LOCK_FILE, "gh", "pr", "merge", String(pr.number), "--repo", REPO, "--squash", "--match-head-commit", pr.headRefOid],
    { stdio: "inherit" },
  );
  gh("pr", "comment", String(pr.number), "--repo", REPO, "--body", `Fusion automatique terminée pour la tête \`${pr.headRefOid}\`.`);
}

function main(argv) {
  const usage = "usage : merge-perimeter-gate.mjs <PR> [--dry-run [--policy-file <fichier>]]";
  const dryRun = argv.includes("--dry-run");
  const fileFlag = argv.indexOf("--policy-file");
  const policyFile = fileFlag >= 0 ? argv[fileFlag + 1] : undefined;
  const expected = 1 + (dryRun ? 1 : 0) + (fileFlag >= 0 ? 2 : 0);
  if (!/^\d+$/.test(argv[0] ?? "") || argv.length !== expected || (fileFlag >= 0 && (!dryRun || !policyFile))) {
    console.error(usage);
    return 2;
  }
  let result;
  try {
    result = evaluate(Number(argv[0]), policyFile);
  } catch (error) {
    console.error(`REFUS EVALUATION_FAILED : ${error.message}`);
    return 1;
  }
  for (const { code, detail } of result.refusals) console.log(`REFUS ${code} : ${detail}`);
  if (result.refusals.length) return 1;
  if (dryRun) {
    console.log(`ADMISE (simulation) : tête ${result.pr.headRefOid}, revue niveau ${result.level}`);
    return 0;
  }
  try {
    merge(result);
  } catch (error) {
    console.error(`ÉCHEC après évaluation : ${error.message}`);
    return 2;
  }
  console.log(`FUSIONNÉE : tête ${result.pr.headRefOid}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
