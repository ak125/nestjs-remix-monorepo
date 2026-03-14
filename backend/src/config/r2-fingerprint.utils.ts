/**
 * R2 Content Contract — Fingerprint utils (SHA-256)
 * 6 hashes pour détecter la duplication inter-pages.
 */

import crypto from 'node:crypto';

function hash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function sig(values: string[]): string {
  return hash(values.join('||'));
}

function orderedSig(values: string[]): string {
  return hash(values.join('>>'));
}

export function buildR2Fingerprint(input: {
  orderedBlocks: string[];
  faqQuestions: string[];
  subgroupKeys: string[];
  productReferenceKeys: string[];
  compatibilitySummary: string[];
}) {
  const blockSignature = orderedSig(input.orderedBlocks);
  const faqSignature = sig(input.faqQuestions);
  const subgroupSignature = orderedSig(input.subgroupKeys);
  const productSetSignature = sig(input.productReferenceKeys.sort());
  const compatibilitySignature = sig(input.compatibilitySummary);

  const contentFingerprint = hash(
    [
      blockSignature,
      faqSignature,
      subgroupSignature,
      productSetSignature,
      compatibilitySignature,
    ].join('::'),
  );

  return {
    contentFingerprint,
    blockSignature,
    faqSignature,
    subgroupSignature,
    productSetSignature,
    compatibilitySignature,
  };
}
