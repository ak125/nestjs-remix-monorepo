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
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fail-fasts in real production when the L3 manifest is absent', () => {
    process.env.NODE_ENV = 'production';
    process.env.RAG_KNOWLEDGE_PATH = '/tmp/automecanik-rag-missing-prod';

    expect(() => new RagKnowledgeBootstrapGuardService().onModuleInit()).toThrow(
      '[RagKnowledgeBootstrapGuard] manifest absent:',
    );
  });

  it('soft-warns in READ_ONLY preprod when the L3 manifest is absent', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'preprod';
    process.env.READ_ONLY = 'true';
    process.env.RAG_KNOWLEDGE_PATH =
      '/tmp/automecanik-rag-missing-readonly-preprod';

    expect(() =>
      new RagKnowledgeBootstrapGuardService().onModuleInit(),
    ).not.toThrow();
  });
});
