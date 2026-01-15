-- ============================================================================
-- MIGRATION: Create RM (Read Model) Enums
-- ============================================================================
-- Enums pour le système Read Model d'optimisation catalogue
--
-- Date: 2026-01-15
-- ============================================================================

-- Enum: Quality levels for products
CREATE TYPE rm_quality_enum AS ENUM ('OE', 'EQUIV', 'ECO');

-- Enum: Stock status for products
CREATE TYPE rm_stock_status_enum AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PREORDER');

-- Enum: Build status for RM listings
CREATE TYPE rm_build_status_enum AS ENUM ('READY', 'PARTIAL', 'FAILED', 'EMPTY', 'PENDING');

-- Comments
COMMENT ON TYPE rm_quality_enum IS 'Product quality levels: OE (Original Equipment), EQUIV (Equivalent), ECO (Economy)';
COMMENT ON TYPE rm_stock_status_enum IS 'Product stock status: IN_STOCK, LOW_STOCK, OUT_OF_STOCK, PREORDER';
COMMENT ON TYPE rm_build_status_enum IS 'RM listing build status: READY, PARTIAL, FAILED, EMPTY, PENDING';
