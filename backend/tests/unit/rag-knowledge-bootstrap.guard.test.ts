import { RagKnowledgeBootstrapGuardService } from '../../src/modules/rag-knowledge-bootstrap/rag-knowledge-bootstrap.guard';

describe('RagKnowledgeBootstrapGuardService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.APP_ENV;
    delete process.env.NODE_ENV;
    delete process.env.READ_ONLY;
    delete process.env.RAG_KNOWLEDGE_PATH;
    delete process.env.SKIP_RAG_BOOTSTRAP_GUARD;
    delete process.env.RAG_L3_GUARD_ENFORCE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fail-fasts in production when manifest absent AND RAG_L3_GUARD_ENFORCE=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.RAG_L3_GUARD_ENFORCE = 'true';
    process.env.RAG_KNOWLEDGE_PATH = '/tmp/automecanik-rag-missing-enforced';

    expect(() => new RagKnowledgeBootstrapGuardService().onModuleInit()).toThrow(
      '[RagKnowledgeBootstrapGuard] manifest absent:',
    );
  });

  it('soft-warns in production when manifest absent AND RAG_L3_GUARD_ENFORCE unset (Phase 3B pas livrée)', () => {
    process.env.NODE_ENV = 'production';
    process.env.RAG_KNOWLEDGE_PATH = '/tmp/automecanik-rag-missing-not-enforced';

    expect(() =>
      new RagKnowledgeBootstrapGuardService().onModuleInit(),
    ).not.toThrow();
  });

  it('soft-warns in READ_ONLY preprod regardless of enforce flag', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'preprod';
    process.env.READ_ONLY = 'true';
    process.env.RAG_L3_GUARD_ENFORCE = 'true';
    process.env.RAG_KNOWLEDGE_PATH =
      '/tmp/automecanik-rag-missing-readonly-preprod';

    expect(() =>
      new RagKnowledgeBootstrapGuardService().onModuleInit(),
    ).not.toThrow();
  });

  it('skips entirely when SKIP_RAG_BOOTSTRAP_GUARD=true (escape hatch CI/dev)', () => {
    process.env.NODE_ENV = 'production';
    process.env.RAG_L3_GUARD_ENFORCE = 'true';
    process.env.SKIP_RAG_BOOTSTRAP_GUARD = 'true';
    process.env.RAG_KNOWLEDGE_PATH = '/tmp/automecanik-rag-missing-skipped';

    expect(() =>
      new RagKnowledgeBootstrapGuardService().onModuleInit(),
    ).not.toThrow();
  });
});
