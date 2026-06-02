import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupplierTruthRepository } from './supplier-truth.repository';
import {
  SupplierSyncProcessor,
  type EventSink,
  noopSink,
} from './supplier-sync.processor';
import {
  listConnectableSuppliers,
  type SupplierConnectorConfig,
} from './connectors/supplier-registry';
import type {
  SupplierConnector,
  SupplierCredentials,
} from './connectors/supplier-connector.interface';
import { InoshopConnector } from './connectors/inoshop.connector';

/**
 * Orchestrates one full sync cycle: bounded working-set → each connectable
 * supplier → connector login → processor.syncRefs. Connector factory and
 * credential resolver are injected so this is unit-testable without HTTP/env.
 *
 * Anti-ban: refs come from the bounded working-set only (never full catalog).
 */

export type ConnectorFactory = (
  cfg: SupplierConnectorConfig,
) => SupplierConnector;
export type CredResolver = (
  cfg: SupplierConnectorConfig,
) => SupplierCredentials | null;

/** Default factory: real connectors per platform. */
export const defaultConnectorFactory: ConnectorFactory = (cfg) => {
  switch (cfg.platform) {
    case 'inoshop':
      return new InoshopConnector({
        supplierId: cfg.supplierId,
        baseUrl: cfg.baseUrl,
      });
    default:
      throw new Error(`No connector for platform ${cfg.platform}`);
  }
};

/** Default resolver: read credentials from env by the registry's env var NAMES. */
export const envCredResolver: CredResolver = (cfg) => {
  const user = process.env[cfg.credEnv.userKey];
  const password = process.env[cfg.credEnv.passKey];
  return user && password ? { user, password } : null;
};

export interface RunSummary {
  suppliersRun: number;
  /** Connector threw (auth/site-down/anti-ban/crash) — a broken supplier, NOT idle. */
  suppliersFailed: number;
  /** Benign skip: no credentials configured, or none of the working-set brands carried. */
  suppliersSkipped: number;
  refs: number;
  projectionsUpserted: number;
}

@Injectable()
export class SupplierSyncRunner {
  private readonly logger = new Logger(SupplierSyncRunner.name);

  constructor(
    private readonly repo: SupplierTruthRepository,
    private readonly processor: SupplierSyncProcessor,
    private readonly connectorFactory: ConnectorFactory = defaultConnectorFactory,
    private readonly credResolver: CredResolver = envCredResolver,
    private readonly emit: EventSink = noopSink,
  ) {}

  async runSync(now: Date = new Date()): Promise<RunSummary> {
    const runId = randomUUID();
    const workingSet = await this.repo.getWorkingSet();
    const summary: RunSummary = {
      suppliersRun: 0,
      suppliersFailed: 0,
      suppliersSkipped: 0,
      refs: workingSet.length,
      projectionsUpserted: 0,
    };
    if (workingSet.length === 0) return summary;

    for (const cfg of listConnectableSuppliers()) {
      const creds = this.credResolver(cfg);
      if (!creds) {
        this.logger.warn(
          `skip ${cfg.supplierName} (${cfg.supplierId}): no credentials in env`,
        );
        summary.suppliersSkipped++;
        continue;
      }

      // Only query this supplier for the brands it actually carries
      // (DistriCash does not sell every brand/family/piece — ___xtr_supplier_link_pm).
      const carriedBrands = new Set(
        await this.repo.getSupplierLinkedBrands(cfg.supplierId),
      );
      const refs = [
        ...new Set(
          workingSet
            .filter((w) => w.pmId != null && carriedBrands.has(w.pmId))
            .map((w) => w.ref),
        ),
      ];
      if (refs.length === 0) {
        this.logger.log(
          `skip ${cfg.supplierName}: none of the working-set brands are carried`,
        );
        summary.suppliersSkipped++;
        continue;
      }

      const connector = this.connectorFactory(cfg);
      try {
        await connector.login(creds);
        const res = await this.processor.syncRefs(connector, refs, now);
        summary.projectionsUpserted += res.projectionsUpserted;
        summary.suppliersRun++;
        this.logger.log(
          `synced ${cfg.supplierName}: ${res.snapshotsInserted} snapshots, ${res.projectionsUpserted} projections`,
        );
      } catch (e) {
        const message = (e as Error).message;
        this.logger.error(`sync failed for ${cfg.supplierName}: ${message}`);
        // A broken connector must be observable, NOT conflated into the benign
        // suppliersSkipped counter (no silent fallback). Distinct count + event.
        summary.suppliersFailed++;
        this.emit('supplier.sync.connector_failed', {
          supplierId: cfg.supplierId,
          supplierName: cfg.supplierName,
          connector: cfg.platform,
          error: message,
          runId,
        });
      } finally {
        await connector.close?.();
      }
    }
    return summary;
  }
}
