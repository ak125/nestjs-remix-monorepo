-- Migration SQL pour créer les tables Orders dans Supabase
-- À exécuter dans l'éditeur SQL de Supabase

-- Création des enums
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'VALIDATED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'BANK_TRANSFER', 'PAYPAL', 'CASH_ON_DELIVERY');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- Création de la table orders
CREATE TABLE "orders" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "order_number" TEXT UNIQUE NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "OrderStatus" DEFAULT 'PENDING',
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_status" "PaymentStatus" DEFAULT 'PENDING',
    "billing_address" JSONB NOT NULL,
    "delivery_address" JSONB NOT NULL,
    "total_amount_ht" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "total_amount_ttc" DECIMAL(10,2) NOT NULL,
    "shipping_cost" DECIMAL(10,2) DEFAULT 0,
    "customer_notes" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "shipped_at" TIMESTAMP WITH TIME ZONE,
    "delivered_at" TIMESTAMP WITH TIME ZONE
);

-- Création de la table order_lines
CREATE TABLE "order_lines" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_reference" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
);

-- Création des index pour optimiser les performances
CREATE INDEX "idx_orders_customer_id" ON "orders"("customer_id");
CREATE INDEX "idx_orders_status" ON "orders"("status");
CREATE INDEX "idx_orders_created_at" ON "orders"("created_at");
CREATE INDEX "idx_order_lines_order_id" ON "order_lines"("order_id");
CREATE INDEX "idx_order_lines_product_id" ON "order_lines"("product_id");

-- Trigger pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON "orders"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
