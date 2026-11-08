// L11 validation; optional read-only native WIKI process. No application bootstrap, DB, provider or write.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { TextDecoder } = require('node:util');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const root = path.resolve(__dirname, '../..');
const workspace = path.join(root, 'workspaces/marketing/fafa-media-factory');
// The local D17 collection queries use row 1001 as a possible-truncation sentinel.
const MAX_CATALOGUE_EXTRACT_ROWS = 1000;
// Fail on malformed bytes instead of substituting U+FFFD. Preserve a BOM so
// JSON.parse retains its existing syntax policy; do not repair source files.
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function parseJson(bytes) {
  let text;
  try {
    text = utf8.decode(bytes);
  } catch {
    throw new Error('INVALID_JSON_UTF8');
  }
  const value = JSON.parse(text); // Native parser remains the syntax authority.
  // Inspect the original valid JSON before using the parsed value: JSON.parse
  // silently keeps the last occurrence of a repeated object key. Strings are
  // whole tokens, so punctuation inside a string cannot change object scope.
  const scopes = [];
  for (const [token] of text.matchAll(/"(?:[^"\\]|\\[\s\S])*"|[{}\[\],]/g)) {
    const scope = scopes.at(-1);
    if (token === '{') scopes.push({ keys: new Set(), expectsKey: true });
    else if (token === '[') scopes.push({ keys: null });
    else if (token === '}' || token === ']') scopes.pop();
    else if (token === ',') {
      if (scope?.keys) scope.expectsKey = true;
    } else if (scope?.keys && scope.expectsKey) {
      const key = JSON.parse(token); // Decode escapes before comparing names.
      if (scope.keys.has(key)) throw new Error('DUPLICATE_JSON_KEY');
      scope.keys.add(key);
      scope.expectsKey = false;
    }
  }
  return value;
}
const read = (file) => parseJson(fs.readFileSync(file));
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const schemas = new Map();
function validator(name) {
  if (!schemas.has(name)) {
    const schema = read(path.join(workspace, 'governance', `${name}.schema.json`));
    schemas.set(name, ajv.compile(schema));
  }
  return schemas.get(name);
}
function check(name, doc) {
  const validate = validator(name);
  if (!validate(doc)) throw new Error(`INVALID_${name}: ${ajv.errorsText(validate.errors)}`);
}
function checkExtract(dir, reference) {
  const base = fs.realpathSync(dir);
  const file = fs.realpathSync(path.resolve(base, reference.extract_path));
  const relative = path.relative(base, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('EXTRACT_OUTSIDE_DOSSIER');
  const bytes = fs.readFileSync(file);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== reference.extract_sha256) throw new Error('EXTRACT_HASH_MISMATCH');
  const rows = parseJson(bytes);
  if (!Array.isArray(rows) || !rows.length || !rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) throw new Error('INVALID_EXTRACT_ROWS');
  if (rows.length > MAX_CATALOGUE_EXTRACT_ROWS) throw new Error('EXTRACT_ROW_LIMIT');
  // JSON.parse rounds oversized integers: a correct digest cannot make their comparison exact.
  // Preserve large identifiers as strings at export time, never stringify an already rounded value.
  const unsafeNumber = (value) => typeof value === 'number' &&
    (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)));
  const anchor = Object.entries(reference.key);
  if (anchor.some(([key, value]) => unsafeNumber(value) || rows.some((row) => unsafeNumber(row[key])))) {
    throw new Error('EXTRACT_KEY_UNSAFE_NUMBER');
  }
  // The anchor must identify exactly one exported row, including after joins.
  const matches = rows.filter((row) => anchor.every(([key, value]) => row[key] === value)).length;
  if (matches === 0) throw new Error('EXTRACT_KEY_MISSING');
  if (matches > 1) throw new Error('EXTRACT_KEY_AMBIGUOUS');
}
// Authority roots/executable come from trusted operator configuration only.
function resolveWiki(entries, dir, config) {
  if (!entries.length) return [];
  const unavailable = (code = 'AUTHORITY_UNAVAILABLE') => entries.map((entry) => ({doc_id:entry.doc_id,status:'UNAVAILABLE',code}));
  try {
    if (!config || !path.isAbsolute(config.pythonExecutable ?? '') || !path.isAbsolute(config.wikiRoot ?? '') || !path.isAbsolute(config.rawRoot ?? '')) return unavailable();
    const authority = fs.realpathSync(config.wikiRoot);
    const dossier = fs.realpathSync(dir);
    const within = (base, candidate) => { const rel=path.relative(base,candidate); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
    if (within(dossier,authority)) return unavailable();
    const nativePath = (relative) => {
      const file=fs.realpathSync(path.join(authority,relative));
      if (!within(authority,file) || within(dossier,file)) throw new Error('INVALID_AUTHORITY_PATH');
      return file;
    };
    const program=nativePath('_scripts/build_exports_content.py');
    const contract=nativePath('_meta/schema/exports-content.schema.json');
    const programBytes=fs.readFileSync(program), contractBytes=fs.readFileSync(contract);
    const schema=parseJson(contractBytes);
    const responseValidator=new Ajv({strict:false}).compile({$ref:'#/$defs/AdmissionResponse',$defs:schema.$defs});
    const references=entries.map((entry) => {
      const ref=entry.wiki_reference ?? {};
      if (!ref.export_path || !ref.export_sha256 || !ref.section_sha256) throw new Error('WIKI_BINDINGS_MISSING');
      return {doc_id:entry.doc_id,export_path:ref.export_path,export_sha256:ref.export_sha256,wiki_path:ref.path,
        source_wiki_commit:ref.commit,section:ref.section,section_sha256:ref.section_sha256,excerpt:entry.excerpt};
    });
    const request={schema_version:'1.0.0',request_id:crypto.randomUUID(),consumer:'fafa',references};
    const input=JSON.stringify(request);
    if (Buffer.byteLength(input)>4*1024*1024) return unavailable();
    const output=require('node:child_process').spawnSync(config.pythonExecutable,
      ['-B',program,'--resolve-stdin','--wiki-root',authority,'--raw-root',config.rawRoot,'--require-commits-on','refs/heads/main','--require-remote','origin'],
      {cwd:authority,input,shell:false,timeout:60000,maxBuffer:4*1024*1024});
    if (output.error || output.signal || ![0,2].includes(output.status)) return unavailable();
    if (nativePath('_scripts/build_exports_content.py')!==program || nativePath('_meta/schema/exports-content.schema.json')!==contract ||
        !fs.readFileSync(program).equals(programBytes) || !fs.readFileSync(contract).equals(contractBytes)) return unavailable();
    const answer=parseJson(Buffer.from(output.stdout));
    if (!responseValidator(answer) || answer.schema_version!==request.schema_version || answer.request_id!==request.request_id || answer.consumer!=='fafa' ||
        answer.results.length!==references.length || new Set(answer.results.map((result)=>result.reference?.doc_id)).size!==references.length) return unavailable();
    const admitted=answer.results.every((result)=>result.status==='ADMITTED');
    if ((output.status===0)!==admitted || (admitted && !/^[a-f0-9]{40}$/.test(answer.authority_revision ?? ''))) return unavailable();
    const bindings=new Map(references.map((reference)=>[reference.doc_id,reference]));
    for (const result of answer.results) {
      const expected=bindings.get(result.reference?.doc_id);
      if (!expected || Object.keys(result.reference).length!==Object.keys(expected).length ||
          Object.entries(expected).some(([key,value])=>result.reference[key]!==value)) return unavailable();
      if (!['ADMITTED','DENIED','UNAVAILABLE'].includes(result.status) || (result.status==='ADMITTED')!==(result.code==='ADMITTED')) return unavailable();
    }
    return answer.results.map((result)=>({doc_id:result.reference.doc_id,status:result.status,code:result.code}));
  } catch (error) {
    return unavailable(['EACCES','EPERM'].includes(error.code)?'AUTHORITY_ACCESS_DENIED':'AUTHORITY_UNAVAILABLE');
  }
}
function evaluateDossier(dir, options) {
  const claims = read(path.join(dir, 'claims.json'));
  const evidence = read(path.join(dir, 'evidence.json'));
  const approval = read(path.join(dir, 'approval.json'));
  for (const [schema, doc] of [['claim-table', claims], ['evidence-pack', evidence], ['approval-record', approval]]) check(schema, doc);
  const [brief, disclaimer] = [['brief.json', 'video-brief'], ['disclaimer.json', 'disclaimer-plan']].map(([file, schema]) => {
    const doc = read(path.join(dir, file));
    check(schema, doc);
    if (doc.video_id !== claims.video_id) throw new Error('DOSSIER_ID_MISMATCH');
    return doc;
  });
  if (evidence.video_id !== claims.video_id || approval.video_id !== claims.video_id) throw new Error('DOSSIER_ID_MISMATCH');
  const allEvidence = [...evidence.evidence, ...(evidence.historical_traces ?? [])];
  if (new Set(allEvidence.map((e) => e.doc_id)).size !== allEvidence.length) throw new Error('DUPLICATE_EVIDENCE_ID');
  if (new Set(claims.claims.map((c) => c.claim_id)).size !== claims.claims.length) throw new Error('DUPLICATE_CLAIM_ID');
  const evidenceById = new Map(allEvidence.map((entry) => [entry.doc_id, entry]));
  const claimsById = new Map(claims.claims.map((claim) => [claim.claim_id, claim]));
  for (const claim of claims.claims) {
    for (const ref of claim.evidence_refs ?? []) {
      const entry = evidenceById.get(ref);
      if (!entry) throw new Error('UNKNOWN_EVIDENCE_REFERENCE');
      if (entry.claim_refs && !entry.claim_refs.includes(claim.claim_id)) throw new Error('EVIDENCE_CLAIM_MISMATCH');
    }
  }
  // Optional reverse links must agree with the actual claim table, including traces.
  for (const entry of allEvidence) {
    for (const ref of entry.claim_refs ?? []) {
      const claim = claimsById.get(ref);
      if (!claim) throw new Error('UNKNOWN_CLAIM_REFERENCE');
      if (!(claim.evidence_refs ?? []).includes(entry.doc_id)) throw new Error('EVIDENCE_CLAIM_MISMATCH');
    }
  }
  const schema = read(path.join(workspace, 'governance/evidence-pack.schema.json'));
  const supports = ajv.getSchema(`${schema.$id}#/$defs/SupportingEvidence`);
  // Resolve only active, cited WIKI evidence; unused inputs cannot block catalogue claims.
  const cited=new Set(claims.claims.flatMap((claim)=>claim.evidence_refs ?? []));
  const wikiResults=options ? resolveWiki(evidence.evidence.filter((entry)=>entry.source_type==='wiki_diagnostic' && cited.has(entry.doc_id)),dir,options) : [];
  const admittedIds=new Set(wikiResults.filter((result)=>result.status==='ADMITTED').map((result)=>result.doc_id));
  // Schema validity does not establish canonical WIKI admission.
  const unresolvedEvidenceIds = [...new Set(evidence.evidence
    .filter((entry) => entry.source_type === 'wiki_diagnostic' && !admittedIds.has(entry.doc_id))
    .map((entry) => entry.doc_id))].sort();
  const unresolvedIds = new Set(unresolvedEvidenceIds);
  const blockingClaimIds = [...new Set(claims.claims
    .filter((claim) => (claim.evidence_refs ?? []).some((ref) => unresolvedIds.has(ref)))
    .map((claim) => claim.claim_id))].sort();
  const wikiAdmission = {
    status: blockingClaimIds.length ? 'UNRESOLVED' : admittedIds.size ? 'ADMITTED' : 'NOT_REFERENCED',
    unresolvedEvidenceIds,
    blockingClaimIds,
    reason: options ? (blockingClaimIds.length ? (wikiResults.some((result)=>result.status==='UNAVAILABLE') ? 'WIKI_AUTHORITY_UNAVAILABLE' : 'WIKI_ADMISSION_DENIED') : null)
      : unresolvedEvidenceIds.length ? 'WIKI_ADMISSION_NOT_CONNECTED' : null,
    ...(options ? {admittedEvidenceIds:[...admittedIds].sort(),results:wikiResults.sort((a,b)=>a.doc_id.localeCompare(b.doc_id))} : {}),
  };
  const accepted = evidence.evidence.filter((entry) => !unresolvedIds.has(entry.doc_id) && supports(entry));
  for (const entry of accepted) {
    if (entry.data_reference) checkExtract(dir, entry.data_reference);
  }
  const acceptedIds = new Set(accepted.map((e) => e.doc_id));
  require('ts-node').register({ project: path.join(root, 'backend/tsconfig.json'), transpileOnly: true });
  const { VideoGatesService } = require(path.join(root, 'backend/src/modules/media-factory/services/video-gates.service.ts'));
  const gateService = new VideoGatesService();
  // Step 1 of the code (checkArtefacts): approval.json is read as the schema's three approvals.
  const artefactCheck = gateService.checkArtefacts({ brief, claims: claims.claims, evidencePack: evidence.evidence,
    disclaimerPlan: disclaimer, approvalRecord: approval });
  const gates = gateService.runClaimGates({
    claims: claims.claims.map((claim) => ({
      id: claim.claim_id, kind: claim.kind, rawText: claim.text,
      value: '', unit: '', sectionKey: String(claim.sequence_index ?? ''),
      sourceRef: null, // A page URL must never bypass D17 through G1's sourceRef branch.
      evidenceId: (claim.evidence_refs ?? []).find((ref) => acceptedIds.has(ref)) ?? null,
      status: claim.source_status,
      requiresHumanValidation: ['procedure', 'safety'].includes(claim.kind),
      validatedBy: claim.human_validated ? claim.human_validated_by : undefined,
      validatedAt: claim.human_validated ? claim.human_validated_at : undefined,
    })),
    evidencePack: accepted.map((entry) => ({ docId: entry.doc_id, heading: '', charRange: [0, entry.excerpt.length], rawExcerpt: entry.excerpt, confidence: entry.confidence })),
  });
  const claimsReady = blockingClaimIds.length === 0 && gates.every((gate) => gate.verdict !== 'FAIL');
  return {
    videoId: claims.video_id,
    readiness: claimsReady ? 'CLAIMS_ONLY' : 'NOT_READY',
    claimsReady,
    reason: blockingClaimIds.length
      ? (options ? 'Referenced WIKI evidence was not admitted by the current authority check.' : 'Referenced WIKI evidence has unresolved admission; canonical admission verification is not connected.')
      : claimsReady ? 'Claim gates only; render, remaining gates and approvals are not validated here.' : 'Unsupported claims or missing human validation; D17 source review required.',
    wikiAdmission,
    artefactCheck,
    claimGates: gates,
    acceptedEvidenceIds: [...acceptedIds],
    approvalsComplete: ['content_approved', 'render_approved', 'publish_approved'].every((key) => approval.approval[key] === true),
    canPublishEligible: claimsReady ? null : false,
    actorAuthenticated: false,
  };
}
function validateRenderReview(review, relativePath, artifactPath, manifest) {
  check('render-review', review);
  if (relativePath !== `reviews/${review.render_sha256}/${review.requested_revision}.json`) throw new Error('REVIEW_PATH_MISMATCH');
  const bytes = fs.readFileSync(artifactPath);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (hash !== review.render_sha256 || hash !== manifest.artifact.sha256 || bytes.length !== manifest.artifact.bytes) throw new Error('RENDER_HASH_MISMATCH');
  const durationMs = manifest.composition.durationSecs * 1000;
  if (!Number.isFinite(durationMs) || durationMs <= 0 || review.end_ms <= review.start_ms || review.end_ms > durationMs) throw new Error('REVIEW_INTERVAL');
  // Bounds use declared duration; this is not a codec/AV inspection or actor authentication.
  return { sha256: hash, bytes: bytes.length, actorAuthenticated: false };
}
function prepareCorrection(record, review, relativePath, artifactPath, manifest) {
  check('approval-record', record);
  if (record.video_id !== manifest.briefId) throw new Error('DOSSIER_ID_MISMATCH');
  validateRenderReview(review, relativePath, artifactPath, manifest);
  if (record.approval.render_sha256 && record.approval.render_sha256 !== review.render_sha256) throw new Error('APPROVAL_RENDER_MISMATCH');
  if (review.requested_revision <= (record.revision ?? 0)) throw new Error('REVISION_NOT_NEWER');
  const next = structuredClone(record);
  next.revision = review.requested_revision;
  for (const stage of ['content', 'render', 'publish']) {
    next.approval[`${stage}_approved`] = false;
    next.approval[`${stage}_approved_by`] = null;
    next.approval[`${stage}_approved_at`] = null;
  }
  next.approval.render_sha256 = null;
  check('approval-record', next);
  return next; // Caller saves a new revision; the original is never overwritten here.
}
module.exports = { evaluateDossier, checkExtract, validateRenderReview, prepareCorrection };
if (require.main === module) {
  try {
    const args=process.argv.slice(2);
    const connected=args.includes('--wiki-authority');
    const positional=args.filter((arg)=>arg!=='--wiki-authority');
    if(positional.length>1) throw new Error('INVALID_ARGUMENTS');
    const config=connected ? {wikiRoot:process.env.AUTOMECANIK_WIKI_PATH,rawRoot:process.env.AUTOMECANIK_RAW_PATH,pythonExecutable:process.env.AUTOMECANIK_WIKI_PYTHON} : undefined;
    const result = evaluateDossier(positional[0] ?? path.join(workspace, 'scripts/draft/fafa-plaquettes-frein-001'), config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.readiness === 'NOT_READY' ? 2 : 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
