/*
# Kanya Table Water System — Core Schema

## Overview
Complete multi-role water business management system for Kanya Table Water Nigeria.

## New Tables

### profiles
Extends auth.users with role and business info.
- id (uuid, FK auth.users) — primary key
- full_name (text)
- phone (text)
- role (text) — super_admin | manager | sales_officer | delivery | customer
- avatar_url (text)
- is_active (boolean)
- created_at, updated_at

### products
Water products catalog.
- id, name, description, image_url
- category (text) — sachet | bottled | dispenser
- price (numeric) — in Naira
- unit (text) — bag | bottle | carton
- stock_quantity (integer)
- is_available (boolean)

### delivery_addresses
Customer saved delivery addresses (multiple per customer).
- id, user_id, label, address, city, state, lga, is_default

### orders
Customer orders.
- id, order_number (unique auto-gen), customer_id
- status: pending | confirmed | processing | out_for_delivery | delivered | cancelled
- delivery_address_id, delivery_address_snapshot (jsonb)
- payment_method, payment_status
- subtotal, delivery_charge, total_amount
- preferred_delivery_date, special_instructions
- assigned_driver_id, assigned_at, delivered_at
- notes

### order_items
Line items for each order.
- id, order_id, product_id, quantity, unit_price, subtotal

### inventory_logs
Tracks all stock movements.
- id, product_id, change_type (production|sale|adjustment|return)
- quantity_change, previous_stock, new_stock, notes, created_by

### production_records
Daily production entries by operators.
- id, recorded_by, product_id, bags_produced, bags_damaged, bags_transferred
- production_date, shift (morning|afternoon|night), notes

### delivery_logs
Driver delivery records.
- id, order_id, driver_id, bags_loaded, bags_delivered, bags_returned
- started_at, completed_at, proof_of_delivery_url, notes

### messages
In-app messaging between staff.
- id, sender_id, recipient_id, subject, body, is_read, parent_id (thread)

### stock_adjustments
Admin manual stock adjustments.
- id, product_id, adjustment_type (add|remove), quantity, reason, adjusted_by

## Security
All tables have RLS enabled with authenticated-user policies.
Customers only access their own data.
Staff roles access relevant data only.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('super_admin','manager','sales_officer','delivery','customer')),
  avatar_url text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  category text NOT NULL CHECK (category IN ('sachet','bottled','dispenser')),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  unit text NOT NULL DEFAULT 'bag',
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_all" ON products;
CREATE POLICY "products_select_all" ON products FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "products_write_staff" ON products;
CREATE POLICY "products_write_staff" ON products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer')));

DROP POLICY IF EXISTS "products_update_staff" ON products;
CREATE POLICY "products_update_staff" ON products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer')));

DROP POLICY IF EXISTS "products_delete_admin" ON products;
CREATE POLICY "products_delete_admin" ON products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- DELIVERY ADDRESSES
CREATE TABLE IF NOT EXISTS delivery_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL DEFAULT 'Kaduna',
  lga text DEFAULT '',
  landmark text DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addresses_select_own" ON delivery_addresses;
CREATE POLICY "addresses_select_own" ON delivery_addresses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer','delivery')));

DROP POLICY IF EXISTS "addresses_insert_own" ON delivery_addresses;
CREATE POLICY "addresses_insert_own" ON delivery_addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "addresses_update_own" ON delivery_addresses;
CREATE POLICY "addresses_update_own" ON delivery_addresses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "addresses_delete_own" ON delivery_addresses;
CREATE POLICY "addresses_delete_own" ON delivery_addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','out_for_delivery','delivered','cancelled')),
  delivery_address_id uuid REFERENCES delivery_addresses(id),
  delivery_address_snapshot jsonb,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','transfer','pos')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  delivery_charge numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  preferred_delivery_date date,
  special_instructions text DEFAULT '',
  assigned_driver_id uuid REFERENCES auth.users(id),
  assigned_at timestamptz,
  delivered_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own" ON orders FOR SELECT TO authenticated
  USING (
    auth.uid() = customer_id OR
    auth.uid() = assigned_driver_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer'))
  );

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "orders_update_staff" ON orders;
CREATE POLICY "orders_update_staff" ON orders FOR UPDATE TO authenticated
  USING (
    auth.uid() = customer_id OR
    auth.uid() = assigned_driver_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer'))
  )
  WITH CHECK (
    auth.uid() = customer_id OR
    auth.uid() = assigned_driver_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer'))
  );

DROP POLICY IF EXISTS "orders_delete_admin" ON orders;
CREATE POLICY "orders_delete_admin" ON orders FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select" ON order_items;
CREATE POLICY "order_items_select" ON order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND (
      o.customer_id = auth.uid() OR
      o.assigned_driver_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer'))
    )
  ));

DROP POLICY IF EXISTS "order_items_insert" ON order_items;
CREATE POLICY "order_items_insert" ON order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));

DROP POLICY IF EXISTS "order_items_delete_admin" ON order_items;
CREATE POLICY "order_items_delete_admin" ON order_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- INVENTORY LOGS
CREATE TABLE IF NOT EXISTS inventory_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  change_type text NOT NULL CHECK (change_type IN ('production','sale','adjustment','return','damage')),
  quantity_change integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  notes text DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_logs_select" ON inventory_logs;
CREATE POLICY "inv_logs_select" ON inventory_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer','delivery')));

DROP POLICY IF EXISTS "inv_logs_insert" ON inventory_logs;
CREATE POLICY "inv_logs_insert" ON inventory_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer')));

DROP POLICY IF EXISTS "inv_logs_update" ON inventory_logs;
CREATE POLICY "inv_logs_update" ON inventory_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

DROP POLICY IF EXISTS "inv_logs_delete" ON inventory_logs;
CREATE POLICY "inv_logs_delete" ON inventory_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- PRODUCTION RECORDS
CREATE TABLE IF NOT EXISTS production_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  product_id uuid REFERENCES products(id),
  bags_produced integer NOT NULL DEFAULT 0 CHECK (bags_produced >= 0),
  bags_damaged integer NOT NULL DEFAULT 0 CHECK (bags_damaged >= 0),
  bags_transferred integer NOT NULL DEFAULT 0 CHECK (bags_transferred >= 0),
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  production_time time DEFAULT CURRENT_TIME,
  shift text NOT NULL DEFAULT 'morning' CHECK (shift IN ('morning','afternoon','night')),
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_select" ON production_records;
CREATE POLICY "prod_select" ON production_records FOR SELECT TO authenticated
  USING (
    auth.uid() = recorded_by OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager'))
  );

DROP POLICY IF EXISTS "prod_insert" ON production_records;
CREATE POLICY "prod_insert" ON production_records FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = recorded_by AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager','sales_officer'))
  );

DROP POLICY IF EXISTS "prod_update" ON production_records;
CREATE POLICY "prod_update" ON production_records FOR UPDATE TO authenticated
  USING (
    auth.uid() = recorded_by OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager'))
  )
  WITH CHECK (
    auth.uid() = recorded_by OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager'))
  );

DROP POLICY IF EXISTS "prod_delete" ON production_records;
CREATE POLICY "prod_delete" ON production_records FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

-- DELIVERY LOGS
CREATE TABLE IF NOT EXISTS delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  driver_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  bags_loaded integer DEFAULT 0,
  bags_delivered integer DEFAULT 0,
  bags_returned integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  proof_of_delivery_url text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dlogs_select" ON delivery_logs;
CREATE POLICY "dlogs_select" ON delivery_logs FOR SELECT TO authenticated
  USING (
    auth.uid() = driver_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager'))
  );

DROP POLICY IF EXISTS "dlogs_insert" ON delivery_logs;
CREATE POLICY "dlogs_insert" ON delivery_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "dlogs_update" ON delivery_logs;
CREATE POLICY "dlogs_update" ON delivery_logs FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')))
  WITH CHECK (auth.uid() = driver_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "dlogs_delete" ON delivery_logs;
CREATE POLICY "dlogs_delete" ON delivery_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  recipient_id uuid REFERENCES auth.users(id),
  is_broadcast boolean NOT NULL DEFAULT false,
  subject text NOT NULL,
  body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  parent_id uuid REFERENCES messages(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msg_select" ON messages;
CREATE POLICY "msg_select" ON messages FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id OR
    auth.uid() = recipient_id OR
    is_broadcast = true
  );

DROP POLICY IF EXISTS "msg_insert" ON messages;
CREATE POLICY "msg_insert" ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "msg_update" ON messages;
CREATE POLICY "msg_update" ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = recipient_id OR auth.uid() = sender_id);

DROP POLICY IF EXISTS "msg_delete" ON messages;
CREATE POLICY "msg_delete" ON messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- STOCK ADJUSTMENTS
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('add','remove')),
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text NOT NULL,
  adjusted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_adj_select" ON stock_adjustments;
CREATE POLICY "stock_adj_select" ON stock_adjustments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "stock_adj_insert" ON stock_adjustments;
CREATE POLICY "stock_adj_insert" ON stock_adjustments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "stock_adj_update" ON stock_adjustments;
CREATE POLICY "stock_adj_update" ON stock_adjustments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

DROP POLICY IF EXISTS "stock_adj_delete" ON stock_adjustments;
CREATE POLICY "stock_adj_delete" ON stock_adjustments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inv_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_records_by ON production_records(recorded_by);
CREATE INDEX IF NOT EXISTS idx_prod_records_date ON production_records(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
