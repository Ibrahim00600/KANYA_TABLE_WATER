import { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, Product } from '@/types';

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD'; product: Product }
  | { type: 'REMOVE'; productId: string }
  | { type: 'SET_QTY'; productId: string; qty: number }
  | { type: 'CLEAR' };

interface CartContextValue extends CartState {
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'kanya_cart';

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const existing = state.items.find(i => i.product.id === action.product.id);
      if (existing) {
        return { items: state.items.map(i => i.product.id === action.product.id ? { ...i, quantity: i.quantity + 1 } : i) };
      }
      return { items: [...state.items, { product: action.product, quantity: 1 }] };
    }
    case 'REMOVE':
      return { items: state.items.filter(i => i.product.id !== action.productId) };
    case 'SET_QTY': {
      if (action.qty <= 0) return { items: state.items.filter(i => i.product.id !== action.productId) };
      return { items: state.items.map(i => i.product.id === action.productId ? { ...i, quantity: action.qty } : i) };
    }
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"items":[]}'); } catch { return { items: [] }; }
  })();

  const [state, dispatch] = useReducer(reducer, stored as CartState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const totalItems = state.items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = state.items.reduce((s, i) => s + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      ...state,
      addItem: (p) => dispatch({ type: 'ADD', product: p }),
      removeItem: (id) => dispatch({ type: 'REMOVE', productId: id }),
      setQuantity: (id, qty) => dispatch({ type: 'SET_QTY', productId: id, qty }),
      clearCart: () => dispatch({ type: 'CLEAR' }),
      totalItems,
      subtotal,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
