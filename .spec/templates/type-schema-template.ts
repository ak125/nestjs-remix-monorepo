/**
 * Type Schema: [Entity Name]
 * 
 * @description [Brief description of the entity]
 * @version 1.0.0
 * @created YYYY-MM-DD
 * @updated YYYY-MM-DD
 */

import { z } from 'zod';

// ============================================================================
// Base Schema
// ============================================================================

/**
 * [Entity] base schema
 * Core fields that define a [entity]
 */
export const [Entity]BaseSchema = z.object({
  id: z.string().uuid().describe('Unique identifier'),
  
  // Add your fields here
  field1: z.string()
    .min(1, 'Field1 is required')
    .max(255, 'Field1 must be less than 255 characters')
    .describe('Description of field1'),
  
  field2: z.number()
    .int()
    .positive()
    .optional()
    .describe('Description of field2'),
  
  field3: z.enum(['value1', 'value2', 'value3'])
    .describe('Description of field3'),
});

// ============================================================================
// Full Schema (with timestamps)
// ============================================================================

/**
 * [Entity] full schema
 * Includes metadata fields (timestamps, etc.)
 */
export const [Entity]Schema = [Entity]BaseSchema.extend({
  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
  deletedAt: z.date().nullable().optional().describe('Soft deletion timestamp'),
});

// ============================================================================
// Create Schema
// ============================================================================

/**
 * [Entity] creation schema
 * Fields required when creating a new [entity]
 */
export const Create[Entity]Schema = [Entity]BaseSchema.omit({
  id: true,
});

// ============================================================================
// Update Schema
// ============================================================================

/**
 * [Entity] update schema
 * Fields that can be updated (all optional)
 */
export const Update[Entity]Schema = [Entity]BaseSchema.omit({
  id: true,
}).partial();

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * [Entity] filter schema
 * Fields that can be used for filtering
 */
export const [Entity]FilterSchema = z.object({
  field1: z.string().optional(),
  field3: z.enum(['value1', 'value2', 'value3']).optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
});

/**
 * [Entity] sort schema
 * Fields that can be used for sorting
 */
export const [Entity]SortSchema = z.enum([
  'field1:asc',
  'field1:desc',
  'createdAt:asc',
  'createdAt:desc',
  'updatedAt:asc',
  'updatedAt:desc',
]);

/**
 * [Entity] pagination schema
 */
export const [Entity]PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort: [Entity]SortSchema.optional(),
  filter: [Entity]FilterSchema.optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * [Entity] list response schema
 */
export const [Entity]ListResponseSchema = z.object({
  data: z.array([Entity]Schema),
  meta: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

/**
 * [Entity] single response schema
 */
export const [Entity]ResponseSchema = [Entity]Schema;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * TypeScript types inferred from schemas
 */

export type [Entity]Base = z.infer<typeof [Entity]BaseSchema>;
export type [Entity] = z.infer<typeof [Entity]Schema>;
export type Create[Entity] = z.infer<typeof Create[Entity]Schema>;
export type Update[Entity] = z.infer<typeof Update[Entity]Schema>;
export type [Entity]Filter = z.infer<typeof [Entity]FilterSchema>;
export type [Entity]Sort = z.infer<typeof [Entity]SortSchema>;
export type [Entity]Pagination = z.infer<typeof [Entity]PaginationSchema>;
export type [Entity]ListResponse = z.infer<typeof [Entity]ListResponseSchema>;
export type [Entity]Response = z.infer<typeof [Entity]ResponseSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate [entity] data
 */
export const validate[Entity] = (data: unknown): [Entity] => {
  return [Entity]Schema.parse(data);
};

/**
 * Safe validate [entity] data
 * Returns { success: true, data } or { success: false, error }
 */
export const safeValidate[Entity] = (data: unknown) => {
  return [Entity]Schema.safeParse(data);
};

/**
 * Validate create [entity] data
 */
export const validateCreate[Entity] = (data: unknown): Create[Entity] => {
  return Create[Entity]Schema.parse(data);
};

/**
 * Validate update [entity] data
 */
export const validateUpdate[Entity] = (data: unknown): Update[Entity] => {
  return Update[Entity]Schema.parse(data);
};

// ============================================================================
// Business Rules
// ============================================================================

/**
 * Custom validation: [Rule name]
 */
export const validate[CustomRule] = (entity: [Entity]): boolean => {
  // Implement custom business logic
  return true;
};

// ============================================================================
// Examples
// ============================================================================

/**
 * Example valid [entity]
 */
export const example[Entity]: [Entity] = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  field1: 'Example value',
  field2: 42,
  field3: 'value1',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  deletedAt: null,
};

/**
 * Example create request
 */
export const exampleCreate[Entity]: Create[Entity] = {
  field1: 'Example value',
  field2: 42,
  field3: 'value1',
};

/**
 * Example update request
 */
export const exampleUpdate[Entity]: Update[Entity] = {
  field1: 'Updated value',
};
