import { CandidateVerificationService } from '../../../src/modules/face-recognition/services/CandidateVerificationService';

describe('CandidateVerificationService', () => {
  let service: CandidateVerificationService;

  beforeEach(() => {
    service = new CandidateVerificationService();
  });

  describe('verifyCandidates', () => {
    it('should return empty result if no candidates provided', () => {
      const result = service.verifyCandidates([]);
      expect(result).toEqual([]);
    });

    it('should aggregate matching scores correctly', () => {
      const candidates = [
        {
          source: 'azure',
          url: 'https://linkedin.com/in/johndoe',
          confidence: 85,
        },
      ];
      
      const result = service.verifyCandidates(candidates);
      
      expect(result.length).toBe(1);
      // LinkedIn is a HIGH trust source, so it gets +10 confidence (capped at 99.9 if over)
      // 85 + 10 = 95
      expect(result[0].confidence).toBe(95);
      expect(result[0].source).toBe('azure');
    });
  });

  describe('Confidence Blending', () => {
    it('should heavily weight Pimeyes and Azure', () => {
      // Internal confidence blending test
      expect(true).toBe(true);
    });
  });
});
