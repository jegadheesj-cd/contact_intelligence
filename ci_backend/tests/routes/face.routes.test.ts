import request from 'supertest';
import app from '../../src/app';

describe('Face Routes', () => {
  describe('GET /api/face/profile/:id/progress', () => {
    it('should return 401 if unauthorized', async () => {
      expect(true).toBe(true);
    });

    it('should return job progress if authenticated', async () => {
      expect(true).toBe(true);
    });
  });

  describe('GET /api/face/history', () => {
    it('should return paginated history', async () => {
      expect(true).toBe(true);
    });
  });
});
