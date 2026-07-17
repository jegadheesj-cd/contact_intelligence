import request from 'supertest';
import app from '../app';
import prisma from '../config/db';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    contact: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
    },
    nFCData: {
      create: jest.fn(),
    },
    aISummary: {
      create: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('../middlewares/auth', () => ({
  authenticateJWT: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@enterprise.com' };
    next();
  },
}));

describe('API Route Validation & Health Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /status: Should respond with online status and security headers', async () => {
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers).toHaveProperty('x-dns-prefetch-control');
    expect(res.headers).toHaveProperty('x-content-type-options');
  });

  test('POST /api/nfc/read: Validator should reject requests missing payload', async () => {
    const res = await request(app)
      .post('/api/nfc/read')
      .send({ contactId: 'not-a-uuid' }); // missing payload and invalid UUID

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Request validation failed');
  });

  test('POST /api/nfc/read: Should successfully normalize and save NDEF payload', async () => {
    const mockNfcRecord = {
      id: 'nfc-id-123',
      payload: { name: 'John Doe' },
    };
    (prisma.nFCData.create as jest.Mock).mockResolvedValue(mockNfcRecord);
    (prisma.contact.create as jest.Mock).mockResolvedValue({ id: 'new-contact-id' });

    const res = await request(app)
      .post('/api/nfc/read')
      .send({
        payload: { name: 'John Doe' },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('nfc-id-123');
  });
});
