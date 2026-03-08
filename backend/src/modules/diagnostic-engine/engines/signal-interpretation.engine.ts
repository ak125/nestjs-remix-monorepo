/**
 * SignalInterpretationEngine
 *
 * Interprete le signal d'entree → systemes suspects → symptomes candidats.
 * Premier maillon de la chaine : normalise et resout les slugs.
 */
import { Injectable, Logger } from '@nestjs/common';
import { DiagnosticEngineDataService } from '../diagnostic-engine.data-service';
import type { AnalyzeDiagnosticInput } from '../types/diagnostic-input.schema';

export interface SignalInterpretation {
  resolved_symptom_slugs: string[];
  system_slug: string;
  system_label: string;
  system_confirmed: boolean;
  unresolved_signals: string[];
  signal_quality: 'high' | 'medium' | 'low';
}

@Injectable()
export class SignalInterpretationEngine {
  private readonly logger = new Logger(SignalInterpretationEngine.name);

  constructor(private readonly dataService: DiagnosticEngineDataService) {}

  async interpret(
    input: AnalyzeDiagnosticInput,
  ): Promise<SignalInterpretation> {
    // Verify system exists
    const system = await this.dataService.getSystemBySlug(input.system_scope);
    if (!system) {
      return {
        resolved_symptom_slugs: [],
        system_slug: input.system_scope,
        system_label: input.system_scope,
        system_confirmed: false,
        unresolved_signals: [input.signal_input.primary_signal],
        signal_quality: 'low',
      };
    }

    // Get available symptoms for this system
    const availableSymptoms = await this.dataService.getSymptomsBySystem(
      input.system_scope,
    );
    const availableSlugs = new Set(availableSymptoms.map((s) => s.slug));

    const resolved: string[] = [];
    const unresolved: string[] = [];

    // Resolve primary signal
    if (availableSlugs.has(input.signal_input.primary_signal)) {
      resolved.push(input.signal_input.primary_signal);
    } else {
      unresolved.push(input.signal_input.primary_signal);
    }

    // Resolve secondary signals
    if (input.signal_input.secondary_signals) {
      for (const sig of input.signal_input.secondary_signals) {
        if (availableSlugs.has(sig)) {
          resolved.push(sig);
        } else {
          unresolved.push(sig);
        }
      }
    }

    // Signal quality assessment
    let signalQuality: 'high' | 'medium' | 'low' = 'low';
    if (resolved.length > 0 && unresolved.length === 0) {
      signalQuality = 'high';
    } else if (resolved.length > 0) {
      signalQuality = 'medium';
    }

    return {
      resolved_symptom_slugs: resolved,
      system_slug: system.slug,
      system_label: system.label,
      system_confirmed: true,
      unresolved_signals: unresolved,
      signal_quality: signalQuality,
    };
  }
}
