export type UserRole = 'super_admin' | 'manager' | 'sales_officer' | 'delivery' | 'customer';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  avatar_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: 'sachet' | 'bottled' | 'dispenser';
  price: number;
  unit: string;
  stock_quantity: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAddress {
  id: string;
  user_id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  lga: string;
  landmark: string;
  is_default: boolean;
  created_at: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'pos';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  delivery_address_id: string | null;
  delivery_address_snapshot: DeliveryAddress | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  delivery_charge: number;
  total_amount: number;
  preferred_delivery_date: string | null;
  special_instructions: string;
  assigned_driver_id: string | null;
  assigned_at: string | null;
  delivered_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  customer?: Profile;
  driver?: Profile;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
}

export interface ProductionRecord {
  id: string;
  recorded_by: string;
  product_id: string | null;
  bags_produced: number;
  bags_damaged: number;
  bags_transferred: number;
  production_date: string;
  production_time: string;
  shift: 'morning' | 'afternoon' | 'night';
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  recorder?: Profile;
  product?: Product;
}

export interface DeliveryLog {
  id: string;
  order_id: string;
  driver_id: string;
  bags_loaded: number;
  bags_delivered: number;
  bags_returned: number;
  started_at: string;
  completed_at: string | null;
  proof_of_delivery_url: string;
  notes: string;
  created_at: string;
  order?: Order;
  driver?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  is_broadcast: boolean;
  subject: string;
  body: string;
  is_read: boolean;
  parent_id: string | null;
  created_at: string;
  sender?: Profile;
  recipient?: Profile;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  change_type: 'production' | 'sale' | 'adjustment' | 'return' | 'damage';
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  notes: string;
  created_by: string;
  created_at: string;
  product?: Product;
  creator?: Profile;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  adjustment_type: 'add' | 'remove';
  quantity: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
  product?: Product;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
