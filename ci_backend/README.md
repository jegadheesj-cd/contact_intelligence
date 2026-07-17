# Enterprise Contact Intelligence Platform Backend

This is the production-ready, enterprise-grade backend for the **Enterprise Contact Intelligence Platform**, built using **Node.js, Express.js, TypeScript, PostgreSQL, Prisma ORM, JWT, BullMQ, Redis**, and **Docker**.

## Key Architecture & Features

1. **Modular Architecture**: Every feature (auth, users, contacts, business-cards, face-recognition, linkedin, profile-enrichment, ai-summary, nfc, qr) is isolated into separate components under `src/modules/` keeping routes, validators, controllers, and services grouped together.
2. **Layered Structure**: Separation of concerns is maintained through validators (Zod schemas), controllers (express request/response adapters), and services (business logic and DB operations).
3. **Robust Security**: Protected with `helmet` headers, standard CORS config, JWT bearer token checks, role limits, and `express-rate-limit`.
4. **BullMQ Background Workers**: Time-consuming actions (OCR decoding, profile enrichment, face scanning, and AI summary compilation) are delegated to background job workers running on BullMQ backed by a Redis queue.
5. **Centralized Error & Logging Interceptors**: Uniform error responses `{ success: false, message, error }` are sent on exceptions. All request details, SQL client logs, and queues operations are handled through Winston logger.
6. **OpenAPI / Swagger Specs**: Comprehensive interactive documentation is auto-generated under `/api-docs`.

---

## Getting Started

The project comes with full Docker support, allowing you to launch PostgreSQL, Redis, and the backend Node application in seconds.

### Prerequisites

Ensure you have [Docker](https://www.docker.com/) and Docker Compose installed.

### Option 1: Run with Docker Compose (Recommended)

1. Launch the dockerized services (PostgreSQL + Redis + API Server):
   ```bash
   docker-compose up --build
   ```
2. The server will launch on port `3000`. Access the interactive Swagger documentation:
   - **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
   - **Health Check Status**: [http://localhost:3000/status](http://localhost:3000/status)

*Note: In production containers, database seeding runs automatically or can be manually run using `npm run seed`.*

---

### Option 2: Run Locally (Manual Setup)

If you prefer to run database and caching services externally and run the API server locally:

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Setup environment variables**:
   Create a `.env` file in the root directory (refer to `.env` template provided). Make sure `DATABASE_URL` matches your local PostgreSQL connection and `REDIS_HOST` points to your running Redis instance.
3. **Generate Prisma client and run migrations**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. **Populate default seeds (Admins, Users, Contacts)**:
   ```bash
   npm run seed
   ```
5. **Start server in hot-reloading development mode**:
   ```bash
   npm run dev
   ```

---

## Seeding Details (Local Testing Credentials)

The seeding file creates two test accounts with default sample contacts:

* **Admin User**:
  - **Email**: `admin@enterprise.com`
  - **Password**: `admin123`
* **Regular User**:
  - **Email**: `user@enterprise.com`
  - **Password**: `user123`

---

## Detailed Directory Mappings

```
C:\Users\JegadheesJambulingam\.gemini\antigravity-ide\scratch\contact-intelligence-platform-backend/
├── prisma/
│   └── schema.prisma          # Database models, relations, and enums
├── src/
│   ├── config/                # Environment variables, Logger, Prisma DB Client, Swagger JSDoc settings
│   ├── database/              # Seed scripts
│   ├── middlewares/           # Auth, Roles guard, Validation, File Upload, Logger, Rate-limiting
│   ├── routes/                # Central router aggregating modules
│   ├── queue/                 # BullMQ queues definitions
│   ├── jobs/                  # BullMQ processor worker loops
│   ├── utils/                 # AppError and utility helpers
│   ├── types/                 # Express Request TS declaration overrides
│   └── modules/               # Isolated feature modules
│       ├── auth/              # JWT Token creation, signup, login, renewal, logout
│       ├── users/             # Read and edit profile information
│       ├── contacts/          # Full contact CRUD, advanced queries, note/tag linkages
│       ├── business-cards/    # File upload handling & card OCR parsing triggers
│       ├── qr/                # QR code image parsing services
│       ├── nfc/               # Raw NFC contact transfer mappings
│       ├── face-recognition/  # Biometric photo/video scan uploads
│       ├── linkedin/          # Sales navigator lookup and profile fetches
│       ├── profile-enrichment/# Background enrichment job processors
│       └── ai-summary/        # Dynamic contacts summaries
├── Dockerfile                 # Multi-stage production container build
├── docker-compose.yml         # Container orchestration
└── package.json               # Scripts and production packages
```
