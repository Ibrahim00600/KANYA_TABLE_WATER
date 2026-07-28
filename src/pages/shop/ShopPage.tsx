import { useEffect, useState, useCallback } from 'react';
import { ShoppingCart, Search, Plus, Minus, Trash2, Package, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';
import { Button, Input, Spinner, EmptyState, Badge, Modal, Select, Textarea, Alert } from '@/components/ui';
import { formatNaira, NIGERIAN_STATES, generateOrderNumber } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';

const CATEGORY_TABS = [
  { value: '', label: 'All' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'bottled', label: 'Bottled' },
  { value: 'dispenser', label: 'Dispenser' },
];

const DELIVERY_CHARGE = 500;

export default function ShopPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { profile } = useAuth();
  const { items, addItem, removeItem, setQuantity, clearCart, totalItems, subtotal } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderDone, setOrderDone] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  const [checkout, setCheckout] = useState({
    address: '', city: '', state: 'FCT (Abuja)', lga: '', phone: profile?.phone ?? '',
    payment_method: 'cash', preferred_delivery_date: '', special_instructions: '',
  });

  useEffect(() => {
    supabase.from('products').select('*').eq('is_available', true).order('category').then(({ data }) => {
      setProducts(data ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (profile?.phone) setCheckout(c => ({ ...c, phone: profile.phone }));
  }, [profile]);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !category || p.category === category;
    return matchSearch && matchCat;
  });

  async function placeOrder() {
    if (!checkout.address.trim()) { setCheckoutError('Delivery address is required.'); return; }
    if (!checkout.city.trim()) { setCheckoutError('City is required.'); return; }
    setPlacing(true);
    setCheckoutError('');

    const orderNumber = generateOrderNumber();
    const deliveryCharge = DELIVERY_CHARGE;
    const total = subtotal + deliveryCharge;

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: profile!.id,
        status: 'pending',
        payment_method: checkout.payment_method,
        payment_status: 'pending',
        subtotal,
        delivery_charge: deliveryCharge,
        total_amount: total,
        preferred_delivery_date: checkout.preferred_delivery_date || null,
        special_instructions: checkout.special_instructions,
        delivery_address_snapshot: {
          address: checkout.address,
          city: checkout.city,
          state: checkout.state,
          lga: checkout.lga,
          phone: checkout.phone,
        },
      })
      .select()
      .single();

    if (oErr || !order) {
      setCheckoutError('Failed to place order. Please try again.');
      setPlacing(false);
      return;
    }

    const lineItems = items.map(i => ({
      order_id: order.id,
      product_id: i.product.id,
      quantity: i.quantity,
      unit_price: i.product.price,
      subtotal: i.product.price * i.quantity,
    }));

    await supabase.from('order_items').insert(lineItems);
    clearCart();
    setPlacing(false);
    setShowCheckout(false);
    setShowCart(false);
    setOrderDone(orderNumber);
  }

  if (orderDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white mb-2">Order Placed!</h2>
        <p className="text-gray-500 mb-1">Your order number is:</p>
        <p className="font-mono text-xl font-bold text-brand-600 dark:text-brand-400 mb-4">{orderDone}</p>
        <p className="text-gray-500 text-sm mb-6 max-w-sm">We'll process your order shortly and deliver to your address. Thank you for choosing Kanya Water!</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setOrderDone('')}>Continue Shopping</Button>
          <Button onClick={() => onNavigate('my-orders')}>Track Order</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shop</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Order fresh Kanya water products</p>
        </div>
        <Button
          icon={<ShoppingCart className="w-4 h-4" />}
          onClick={() => setShowCart(true)}
          variant={totalItems > 0 ? 'primary' : 'secondary'}
        >
          Cart {totalItems > 0 && `(${totalItems})`}
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setCategory(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              category === tab.value
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <Input
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="sm:max-w-xs ml-auto"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package className="w-8 h-8" />} title="No products available" description="Check back soon for fresh Kanya products." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => {
            const cartItem = items.find(i => i.product.id === p.id);
            const inCart = cartItem?.quantity ?? 0;
            return (
              <div key={p.id} className="card overflow-hidden hover:shadow-card-hover transition-shadow">
                <div className="aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge className={p.stock_quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {p.stock_quantity > 0 ? 'In stock' : 'Out of stock'}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{p.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{p.description}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-brand-600 dark:text-brand-400 text-lg">{formatNaira(p.price)}</span>
                    <span className="text-xs text-gray-400">per {p.unit}</span>
                  </div>
                  {inCart > 0 ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(p.id, inCart - 1)}
                        className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="flex-1 text-center font-semibold text-sm">{inCart}</span>
                      <button
                        onClick={() => setQuantity(p.id, inCart + 1)}
                        disabled={inCart >= p.stock_quantity}
                        className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => addItem(p)}
                      disabled={p.stock_quantity <= 0}
                      size="sm"
                      icon={<ShoppingCart className="w-3 h-3" />}
                    >
                      Add to Cart
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart Modal */}
      <Modal open={showCart} onClose={() => setShowCart(false)} title="Your Cart" size="md">
        {items.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="w-8 h-8" />} title="Cart is empty" description="Add products to your cart to proceed." />
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.product.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                  {item.product.image_url && <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.product.name}</p>
                  <p className="text-xs text-gray-400">{formatNaira(item.product.price)} × {item.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQuantity(item.product.id, item.quantity - 1)} className="w-7 h-7 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button onClick={() => setQuantity(item.product.id, item.quantity + 1)} className="w-7 h-7 rounded bg-brand-100 dark:bg-brand-900/20 text-brand-600 flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeItem(item.product.id)} className="w-7 h-7 rounded bg-red-50 text-red-500 flex items-center justify-center ml-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-sm font-semibold text-right w-20">{formatNaira(item.product.price * item.quantity)}</span>
              </div>
            ))}
            <div className="pt-2 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{formatNaira(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Delivery</span><span>{formatNaira(DELIVERY_CHARGE)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-100 dark:border-gray-800">
                <span>Total</span><span className="text-brand-600 dark:text-brand-400">{formatNaira(subtotal + DELIVERY_CHARGE)}</span>
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={() => { setShowCart(false); setShowCheckout(true); }}>
              Proceed to Checkout
            </Button>
          </div>
        )}
      </Modal>

      {/* Checkout Modal */}
      <Modal open={showCheckout} onClose={() => setShowCheckout(false)} title="Checkout" size="lg">
        <div className="space-y-4">
          {checkoutError && <Alert type="error">{checkoutError}</Alert>}
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Delivery Information</p>
          <Input
            label="Street Address"
            value={checkout.address}
            onChange={e => setCheckout(c => ({ ...c, address: e.target.value }))}
            placeholder="e.g. No. 12 Light Gold Phase 4, Abuja"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={checkout.city} onChange={e => setCheckout(c => ({ ...c, city: e.target.value }))} placeholder="Abuja" required />
            <Input label="LGA" value={checkout.lga} onChange={e => setCheckout(c => ({ ...c, lga: e.target.value }))} placeholder="Chikun" />
          </div>
          <Select
            label="State"
            options={NIGERIAN_STATES.map(s => ({ value: s, label: s }))}
            value={checkout.state}
            onChange={e => setCheckout(c => ({ ...c, state: e.target.value }))}
          />
          <Input
            label="Phone Number"
            type="tel"
            value={checkout.phone}
            onChange={e => setCheckout(c => ({ ...c, phone: e.target.value }))}
            placeholder="08012345678"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Preferred Delivery Date"
              type="date"
              value={checkout.preferred_delivery_date}
              onChange={e => setCheckout(c => ({ ...c, preferred_delivery_date: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
            />
            <Select
              label="Payment Method"
              options={[
                { value: 'cash', label: 'Cash on Delivery' },
                { value: 'transfer', label: 'Bank Transfer' },
                { value: 'pos', label: 'POS' },
              ]}
              value={checkout.payment_method}
              onChange={e => setCheckout(c => ({ ...c, payment_method: e.target.value }))}
            />
          </div>
          <Textarea
            label="Special Instructions (Optional)"
            value={checkout.special_instructions}
            onChange={e => setCheckout(c => ({ ...c, special_instructions: e.target.value }))}
            placeholder="Any special delivery notes..."
          />
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatNaira(subtotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Delivery charge</span><span>{formatNaira(DELIVERY_CHARGE)}</span></div>
            <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200 dark:border-gray-700">
              <span>Total</span><span className="text-brand-600 dark:text-brand-400">{formatNaira(subtotal + DELIVERY_CHARGE)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowCheckout(false)} className="flex-1">Back to Cart</Button>
            <Button onClick={placeOrder} loading={placing} className="flex-1" size="lg">Place Order</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
