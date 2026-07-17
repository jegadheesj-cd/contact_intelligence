import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Enterprise Contact Intelligence Platform API',
      version: '1.0.0',
      description: 'Enterprise-grade Node/Express/TypeScript backend serving contact extraction, facial verification, and AI-summary queries.',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token in the format: Bearer <token>',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/modules/**/*.ts', 
    './dist/modules/**/*.js',
    './src/app.ts',
    './src/app.js'
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
