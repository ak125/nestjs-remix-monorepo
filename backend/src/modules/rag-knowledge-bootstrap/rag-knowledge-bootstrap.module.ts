/**
 * RagKnowledgeBootstrapModule
 *
 * Câble le RagKnowledgeBootstrapGuardService au boot NestJS pour vérifier
 * l'état L3 RAG mirror (ADR-046 + ADR-050).
 *
 * Importé dans AppModule (rien d'autre à faire — OnModuleInit fait le check).
 */

import { Module } from '@nestjs/common';
import { RagKnowledgeBootstrapGuardService } from './rag-knowledge-bootstrap.guard';

@Module({
  providers: [RagKnowledgeBootstrapGuardService],
  exports: [RagKnowledgeBootstrapGuardService],
})
export class RagKnowledgeBootstrapModule {}
