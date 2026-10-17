import { DomainValidationException } from '@common/exceptions';
import type { VideoScenario } from '../types/video.types';
import { resolveTemplate } from './templates/template-registry';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate ownership and envelope only; narrative validation belongs to the renderer. */
export function validateVideoScenario(
  value: unknown,
  templateId: string | null | undefined,
): VideoScenario {
  const template = resolveTemplate(templateId);
  if (value == null) {
    throw new DomainValidationException({
      message: 'scenario_missing',
      field: 'scenario',
    });
  }
  if (
    !template.requiresScenario ||
    !isObject(value) ||
    value.schemaVersion !== 1 ||
    value.compositionId !== template.compositionId ||
    !isObject(value.props) ||
    ['audioUrl', 'claims', 'disclaimerText'].some((key) =>
      Object.hasOwn(value.props as object, key),
    )
  ) {
    throw new DomainValidationException({
      message: 'Invalid scenario envelope for template',
      field: 'scenario',
    });
  }
  return value as unknown as VideoScenario;
}

export function scenarioCompositionProps(
  scenario: unknown,
  templateId: string,
  masterAudioUrl: string | null,
): Record<string, unknown> {
  const validated = validateVideoScenario(scenario, templateId);
  if (
    masterAudioUrl != null &&
    (typeof masterAudioUrl !== 'string' || !masterAudioUrl.trim())
  ) {
    throw new DomainValidationException({
      message: 'Invalid master audio reference',
      field: 'masterAudioUrl',
    });
  }
  return {
    ...validated.props,
    ...(masterAudioUrl != null ? { audioUrl: masterAudioUrl } : {}),
  };
}
