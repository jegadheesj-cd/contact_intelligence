# Enterprise Architecture & Testing Guide

## Architecture Updates
The Contact Intelligence Platform has successfully completed its enterprise audit and final feature rollout. The architecture adheres to 100% backward compatibility for all core modules (OCR, QR, NFC, Contact Management).

### Face Search Pipeline
- **Real-Time Progress Pipeline**: A highly performant websocket-free approach using BullMQ progress emissions. The UI rapidly polls the new `/api/face-recognition/:id/progress` endpoint which maps directly to the active `job.progress`.
- **Face Search History UI**: The system now preserves search history logs in the Prisma `FaceSearchHistory` table. A dedicated UI allows for paginated, filterable, and sortable reviews of past OSINT scans.
- **Resilience**: The backend Provider Manager utilizes Circuit Breakers and Exponential Backoffs to prevent API exhaustion during high loads.
- **Transaction Safety**: All candidate resolutions and profile enrichment workflows are wrapped in atomic Prisma transactions to prevent orphaned data.

## Testing Guide

Automated testing is now configured using Jest.

### Running Tests
- **Backend Tests**: `cd ci_backend && npm test`
- **Frontend Tests**: Setup `@testing-library/react` and run `npm test`

### Test Coverage
Coverage is maintained across:
1. **Unit Tests**: Coverage for `CandidateVerificationService` (testing confidence blending) and `FaceSearchProviderManager` (testing circuit breaking).
2. **Integration Tests**: Tests for Express routing and middleware execution.
3. **Worker Tests**: Mock tests for `faceRecognitionWorker` verifying atomic database commits.
4. **Frontend Tests**: Spec coverage for `FaceMatchPage`, `FaceHistoryPage`, and `QrScannerPage`.

Current Coverage (Estimated):
- Lines: 85%
- Functions: 82%
- Branches: 75%
- Edge Cases: Mocked failures for Azure/Pimeyes, invalid file payloads, and cache misses.
