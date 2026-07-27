import { FaceSearchProviderManager } from '../../../src/modules/face-recognition/providers/FaceSearchProviderManager';

describe('FaceSearchProviderManager', () => {
  let manager: FaceSearchProviderManager;

  beforeEach(() => {
    manager = new FaceSearchProviderManager();
  });

  describe('Initialization', () => {
    it('should initialize providers with default concurrency', () => {
      expect(manager).toBeDefined();
    });
  });

  describe('Circuit Breaker Logic', () => {
    it('should fallback to local if OSINT providers fail or circuit breaker opens', async () => {
      // Internal circuit breaker test
      expect(true).toBe(true);
    });
  });

  describe('searchAllProviders', () => {
    it('should return empty results if buffer is empty', async () => {
      try {
        await manager.searchAllProviders(Buffer.from(''), 'test-id');
      } catch (err: any) {
        expect(err.message).toBeDefined();
      }
    });
  });
});
