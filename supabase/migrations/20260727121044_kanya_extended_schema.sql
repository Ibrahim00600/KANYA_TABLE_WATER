/*
# Kanya Extended Features Schema

## New Tables

### credit_records
Tracks customers/people who collect products on credit.
- id, recorded_by (manager), customer_name, phone, amount_owed, amount_paid
- status: unpaid | partial | paid
- product_description, quantity, date, notes
- payment_date (when fully paid)

### staff_cash_collections
Tracks staff who collect cash for the company.
- id, recorded_by (manager), staff_name, staff_id (profile ref)
- amount_collected, date, description, collection_count_this_month

### driver_load_records
Tracks how many bags a driver loaded and carried.
- id, recorded_by, driver_id, driver_name, product_id
- bags_loaded, bags_delivered, bags_returned
- load_date, load_time, notes

### operator_requests
Operators can request items or log collections from manager.
- id, operator_id, request_type (cash|materials|other)
- amount_or_qty, description, status (pending|approved|rejected)
- reviewed_by, reviewed_at, notes
*/

-- CREDIT RECORDS
CREATE TABLE IF NOT EXISTS credit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  customer_name text NOT NULL,
  phone text DEFAULT '',
  amount_owed numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  product_description text DEFAULT '',
  quantity integer DEFAULT 0,
  credit_date date NOT NULL DEFAULT CURRENT_DATE,
  credit_time time DEFAULT CURRENT_TIME,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid')),
  payment_date date,
  payment_time time,
  payment_notes text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_select" ON credit_records;
CREATE POLICY "credit_select" ON credit_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "credit_insert" ON credit_records;
CREATE POLICY "credit_insert" ON credit_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recorded_by AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "credit_update" ON credit_records;
CREATE POLICY "credit_update" ON credit_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "credit_delete" ON credit_records;
CREATE POLICY "credit_delete" ON credit_records FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

-- STAFF CASH COLLECTIONS
CREATE TABLE IF NOT EXISTS staff_cash_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  staff_id uuid REFERENCES auth.users(id),
  staff_name text NOT NULL,
  amount_collected numeric(12,2) NOT NULL,
  collection_date date NOT NULL DEFAULT CURRENT_DATE,
  collection_time time DEFAULT CURRENT_TIME,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_cash_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scc_select" ON staff_cash_collections;
CREATE POLICY "scc_select" ON staff_cash_collections FOR SELECT TO authenticated
  USING (
    auth.uid() = staff_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager'))
  );

DROP POLICY IF EXISTS "scc_insert" ON staff_cash_collections;
CREATE POLICY "scc_insert" ON staff_cash_collections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recorded_by AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "scc_update" ON staff_cash_collections;
CREATE POLICY "scc_update" ON staff_cash_collections FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "scc_delete" ON staff_cash_collections;
CREATE POLICY "scc_delete" ON staff_cash_collections FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

-- DRIVER LOAD RECORDS
CREATE TABLE IF NOT EXISTS driver_load_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  driver_id uuid REFERENCES auth.users(id),
  driver_name text NOT NULL,
  product_id uuid REFERENCES products(id),
  product_name text DEFAULT '',
  bags_loaded integer NOT NULL DEFAULT 0,
  bags_delivered integer NOT NULL DEFAULT 0,
  bags_returned integer NOT NULL DEFAULT 0,
  load_date date NOT NULL DEFAULT CURRENT_DATE,
  load_time time DEFAULT CURRENT_TIME,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE driver_load_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dlr_select" ON driver_load_records;
CREATE POLICY "dlr_select" ON driver_load_records FOR SELECT TO authenticated
  USING (
    auth.uid() = driver_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager'))
  );

DROP POLICY IF EXISTS "dlr_insert" ON driver_load_records;
CREATE POLICY "dlr_insert" ON driver_load_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recorded_by AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "dlr_update" ON driver_load_records;
CREATE POLICY "dlr_update" ON driver_load_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

DROP POLICY IF EXISTS "dlr_delete" ON driver_load_records;
CREATE POLICY "dlr_delete" ON driver_load_records FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager')));

-- OPERATOR REQUESTS
CREATE TABLE IF NOT EXISTS operator_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  request_type text NOT NULL DEFAULT 'cash' CHECK (request_type IN ('cash','materials','other')),
  amount_or_qty text NOT NULL DEFAULT '',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE operator_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opreq_select" ON operator_requests;
CREATE POLICY "opreq_select" ON operator_requests FOR SELECT TO authenticated
  USING (
    auth.uid() = operator_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager'))
  );

DROP POLICY IF EXISTS "opreq_insert" ON operator_requests;
CREATE POLICY "opreq_insert" ON operator_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = operator_id);

DROP POLICY IF EXISTS "opreq_update" ON operator_requests;
CREATE POLICY "opreq_update" ON operator_requests FOR UPDATE TO authenticated
  USING (
    auth.uid() = operator_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager'))
  )
  WITH CHECK (
    auth.uid() = operator_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','manager'))
  );

DROP POLICY IF EXISTS "opreq_delete" ON operator_requests;
CREATE POLICY "opreq_delete" ON operator_requests FOR DELETE TO authenticated
  USING (auth.uid() = operator_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_credit_recorded_by ON credit_records(recorded_by);
CREATE INDEX IF NOT EXISTS idx_credit_status ON credit_records(status);
CREATE INDEX IF NOT EXISTS idx_scc_date ON staff_cash_collections(collection_date DESC);
CREATE INDEX IF NOT EXISTS idx_dlr_date ON driver_load_records(load_date DESC);
CREATE INDEX IF NOT EXISTS idx_opreq_operator ON operator_requests(operator_id);
