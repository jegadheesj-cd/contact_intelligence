import { ProfileEnrichmentService } from './src/modules/profile-enrichment/enrichment.service';
import logger from './src/config/logger';

async function testDiscovery() {
  const service = new ProfileEnrichmentService();
  
  const mockContact = {
    name: 'Jegadhees J',
    company: 'Contact Intelligence',
    designation: 'Founder & Developer'
  };

  logger.info('Starting discovery test...');
  const result = await service.runDiscoveryPipeline(mockContact);
  
  console.log(JSON.stringify(result, null, 2));
}

testDiscovery().catch(console.error);
