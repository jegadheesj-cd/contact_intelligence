import { z } from 'zod';
import { ContactSource } from '@prisma/client';

export const createContactSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    company: z.string().optional(),
    designation: z.string().optional(),
    email: z.string().email('Invalid email address').or(z.string().length(0)).optional(),
    phone: z.string().optional(),
    website: z.string().url('Invalid website URL').or(z.string().length(0)).optional(),
    address: z.string().optional(),
    
    // Professional Information
    linkedInUrl: z.string().url('Invalid LinkedIn URL').or(z.string().length(0)).optional(),
    salesNavigatorId: z.string().optional(),
    skills: z.array(z.string()).default([]),
    industry: z.string().optional(),
    experience: z.any().optional(),
    education: z.any().optional(),

    // AI / Metadata Info
    interests: z.array(z.string()).default([]),
    hobbies: z.array(z.string()).default([]),
    decisionMakerScore: z.number().min(0).max(100).default(0),
    source: z.nativeEnum(ContactSource).default(ContactSource.MANUAL),
    
    // Child Relations
    tags: z.array(z.string()).default([]),
    notes: z.string().optional(),
  }),
});

export const updateContactSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    company: z.string().optional(),
    designation: z.string().optional(),
    email: z.string().email('Invalid email address').or(z.string().length(0)).optional(),
    phone: z.string().optional(),
    website: z.string().url('Invalid website URL').or(z.string().length(0)).optional(),
    address: z.string().optional(),
    
    linkedInUrl: z.string().url('Invalid LinkedIn URL').or(z.string().length(0)).optional(),
    salesNavigatorId: z.string().optional(),
    skills: z.array(z.string()).optional(),
    industry: z.string().optional(),
    experience: z.any().optional(),
    education: z.any().optional(),

    interests: z.array(z.string()).optional(),
    hobbies: z.array(z.string()).optional(),
    decisionMakerScore: z.number().min(0).max(100).optional(),
    source: z.nativeEnum(ContactSource).optional(),
    
    tags: z.array(z.string()).optional(),
  }),
});

export const queryContactSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    name: z.string().optional(),
    company: z.string().optional(),
    industry: z.string().optional(),
    skills: z.string().optional(), // Comma separated
    tags: z.string().optional(), // Comma separated
    source: z.nativeEnum(ContactSource).optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),
});
