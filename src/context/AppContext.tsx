import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Ingredient,
  MenuItem,
  Order,
  StockInRecord,
  LineAlert,
  OrderStatus,
  BOMRequirement,
  ShopLocationConfig,
  LineConfig,
  WorkstationSlot,
} from '../types';
import {
  INITIAL_INGREDIENTS,
  INITIAL_MENU_ITEMS,
  INITIAL_ORDERS,
  SHOP_LOCATION,
} from '../data/mockData';
import { calculateAdjustedBOM } from '../utils/helpers';
import { playNewOrderChime } from '../utils/audio';

interface AppContextType {
  // State
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  orders: Order[];
  stockInHistory: StockInRecord[];
  lastStockInRecord: StockInRecord | null;
  lineAlerts: LineAlert[];
  activeTab: 'customer' | 'pos' | 'kds' | 'rider' | 'admin';
  activeCustomerOrderId: string | null;
  shopLocation: ShopLocationConfig;
  lineConfig: LineConfig;
  latestNewOrderAlert: Order | null;
  isCustomerOnlyView: boolean;
  canGoBack: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline';
  lastSyncTime: string;

  // Actions
  setActiveTab: (tab: 'customer' | 'pos' | 'kds' | 'rider' | 'admin') => void;
  goBack: () => void;
  setActiveCustomerOrderId: (id: string | null) => void;
  updateShopLocation: (config: Partial<ShopLocationConfig>) => void;
  updateLineConfig: (config: Partial<LineConfig>) => void;
  dismissNewOrderAlert: () => void;
  setIsCustomerOnlyView: (val: boolean) => void;
  forceSync: () => Promise<void>;

  // Inventory actions
  recordStockIn: (ingredientId: string, amount: number, supplier?: string, notes?: string) => void;
  undoLastStockIn: () => boolean;
  updateIngredientStock: (ingredientId: string, newStock: number) => void;
  toggleSpikeItem: (ingredientId: string, customMultiplier?: number) => void;
  toggleFavoriteIngredient: (ingredientId: string) => void;
  updateIngredientSlot: (ingredientId: string, slot: WorkstationSlot) => void;
  applyOptimalSlotting: (assignments: { ingredientId: string; slot: WorkstationSlot }[]) => void;
  updateBOM: (menuItemId: string, newBOM: BOMRequirement[]) => void;
  addMenuItem: (menu: Omit<MenuItem, 'id'>) => MenuItem;
  updateMenuItem: (id: string, menu: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;
  runSpikeDetection: () => void;

  // Order actions
  createOrder: (order: Omit<Order, 'id' | 'createdAt' | 'status'>) => Order;
  voidOrder: (orderId: string, reason?: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;

  // Alerts
  dismissAlert: (alertId: string) => void;
  clearAlerts: () => void;
  triggerManualLineAlert: (title: string, message: string, type?: LineAlert['type']) => void;

  // Reset to initial
  resetDemoData: () => Promise<void>;
  startNewMonthReset: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  INGREDIENTS: 'smoothie_app_ingredients_v2',
  MENU_ITEMS: 'smoothie_app_menu_v2',
  ORDERS: 'smoothie_app_orders_v2',
  STOCK_HISTORY: 'smoothie_app_stock_history_v2',
  ALERTS: 'smoothie_app_alerts_v2',
  SHOP_LOCATION: 'smoothie_app_shop_location_v2',
  LINE_CONFIG: 'smoothie_app_line_config_v2',
};

const DEFAULT_LINE_CONFIG: LineConfig = {
  token: '',
  channelName: 'COCO BEAR / PANG BEAR (หน้า ม.อุบล)',
  webhookUrl: '',
  notifyLowStock: true,
  notifyOutOfStock: true,
  notifySpike: true,
  notifyNewOrder: true,
  notifyDailySummary: true,
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Unique client identifier for this tab/device session
  const clientId = useRef<string>(
    typeof window !== 'undefined'
      ? window.sessionStorage?.getItem('smoothie_client_id') ||
        `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      : `client_${Date.now()}`
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem('smoothie_client_id', clientId.current);
    }
  }, []);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('syncing');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Load initial state from localStorage (for 0ms instant display), fallback to default
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.INGREDIENTS);
    return saved ? JSON.parse(saved) : INITIAL_INGREDIENTS;
  });

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MENU_ITEMS);
    if (saved) {
      try {
        const parsed: MenuItem[] = JSON.parse(saved);
        return parsed;
      } catch {
        return INITIAL_MENU_ITEMS;
      }
    }
    return INITIAL_MENU_ITEMS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [stockInHistory, setStockInHistory] = useState<StockInRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STOCK_HISTORY);
    return saved ? JSON.parse(saved) : [];
  });

  const [lastStockInRecord, setLastStockInRecord] = useState<StockInRecord | null>(null);

  const [shopLocation, setShopLocation] = useState<ShopLocationConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SHOP_LOCATION);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return SHOP_LOCATION;
      }
    }
    return SHOP_LOCATION;
  });

  const [lineAlerts, setLineAlerts] = useState<LineAlert[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ALERTS);
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'alert-initial-1',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        type: 'spike',
        title: '🔥 ตรวจพบยอดขายพุ่งฉับพลัน (Spike Item)',
        message: 'มะม่วงน้ำดอกไม้สุก มีการสั่งซื้อถี่กว่าปกติ ระบบปรับ Dynamic Safety Stock ขึ้นเป็น 3,500g อัตโนมัติ',
        urgent: true,
      },
      {
        id: 'alert-initial-2',
        timestamp: new Date(Date.now() - 1000 * 60 * 35).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        type: 'low_stock',
        title: '⚠️ แจ้งเตือนวัตถุดิบใกล้หมด',
        message: 'สตรอว์เบอร์รีสดแช่แข็ง และ อะโวคาโดสด เหลือต่ำกว่าจุดสั่งซื้อประจำสัปดาห์',
        urgent: false,
      },
    ];
  });

  const [lineConfig, setLineConfig] = useState<LineConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LINE_CONFIG);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_LINE_CONFIG;
      }
    }
    return DEFAULT_LINE_CONFIG;
  });

  // Track latest orders to detect incoming orders from other devices
  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Server action dispatcher
  const sendServerAction = async (action: string, payload: any) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, clientId: clientId.current }),
      });
      if (res.ok) {
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
      } else {
        setSyncStatus('offline');
      }
    } catch (err) {
      console.warn('[Sync] Action saved locally, waiting for server reconnect:', err);
      setSyncStatus('offline');
    }
  };

  // Full state pull from server
  const forceSync = async () => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/sync');
      if (!res.ok) throw new Error('Sync endpoint returned ' + res.status);
      const json = await res.json();
      if (json && json.data) {
        applyServerData(json.data);
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
      }
    } catch (err) {
      console.warn('[Sync] Failed to fetch server state:', err);
      setSyncStatus('offline');
    }
  };

  const applyServerData = (serverData: any, senderId?: string) => {
    if (!serverData) return;

    // Trigger audible chime and popup banner if an order was placed on another device
    if (Array.isArray(serverData.orders)) {
      if (senderId && senderId !== clientId.current) {
        const prevIds = new Set(ordersRef.current.map((o) => o.id));
        const newOrders = serverData.orders.filter((o: Order) => !prevIds.has(o.id));
        if (newOrders.length > 0) {
          playNewOrderChime();
          setLatestNewOrderAlert(newOrders[0]);
        }
      }
      setOrders(serverData.orders);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(serverData.orders));
    }

    if (Array.isArray(serverData.ingredients)) {
      setIngredients(serverData.ingredients);
      localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(serverData.ingredients));
    }

    if (Array.isArray(serverData.menuItems)) {
      setMenuItems(serverData.menuItems);
      localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(serverData.menuItems));
    }

    if (Array.isArray(serverData.stockInHistory)) {
      setStockInHistory(serverData.stockInHistory);
      localStorage.setItem(STORAGE_KEYS.STOCK_HISTORY, JSON.stringify(serverData.stockInHistory));
    }

    if (Array.isArray(serverData.lineAlerts)) {
      setLineAlerts(serverData.lineAlerts);
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(serverData.lineAlerts));
    }

    if (serverData.shopLocation) {
      setShopLocation(serverData.shopLocation);
      localStorage.setItem(STORAGE_KEYS.SHOP_LOCATION, JSON.stringify(serverData.shopLocation));
    }

    if (serverData.lineConfig) {
      setLineConfig(serverData.lineConfig);
      localStorage.setItem(STORAGE_KEYS.LINE_CONFIG, JSON.stringify(serverData.lineConfig));
    }
  };

  // Connect to SSE stream & background synchronization
  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    // Initial fetch to load master server store
    forceSync();

    const connectSSE = () => {
      if (eventSource) {
        eventSource.close();
      }

      try {
        eventSource = new EventSource('/api/events');

        eventSource.onopen = () => {
          if (!isMounted) return;
          setSyncStatus('synced');
          setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
        };

        eventSource.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'init' || parsed.type === 'sync' || parsed.type === 'reset') {
              applyServerData(parsed.data, parsed.senderId);
              setSyncStatus('synced');
              setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
            }
          } catch (err) {
            console.error('[SSE] Failed to parse message:', err);
          }
        };

        eventSource.onerror = () => {
          if (!isMounted) return;
          setSyncStatus('offline');
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              if (isMounted) connectSSE();
            }, 3500);
          }
        };
      } catch (err) {
        console.warn('[SSE] EventSource init failed:', err);
        setSyncStatus('offline');
      }
    };

    connectSSE();

    // Secondary fallback polling every 8s when visible to guarantee updates across tabs and devices
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        forceSync();
      }
    }, 8000);

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
    };
  }, []);

  const updateLineConfig = (config: Partial<LineConfig>) => {
    setLineConfig((prev) => {
      const updated = { ...prev, ...config };
      localStorage.setItem(STORAGE_KEYS.LINE_CONFIG, JSON.stringify(updated));
      sendServerAction('UPDATE_LINE_CONFIG', { lineConfig: updated });
      return updated;
    });
    sendLineAlert('🟢 อัปเดตการตั้งค่า LINE สำเร็จ', 'การเชื่อมต่อและตัวเลือกการแจ้งเตือนได้รับการบันทึกเรียบร้อย');
  };

  // Latest New Order for instant sound and prominent popup alert across POS, KDS, Rider
  const [latestNewOrderAlert, setLatestNewOrderAlert] = useState<Order | null>(null);

  const dismissNewOrderAlert = () => {
    setLatestNewOrderAlert(null);
  };

  // Check URL query param (e.g. from scanning Order QR code: ?mode=order or ?tab=customer)
  const [activeTab, setActiveTabState] = useState<'customer' | 'pos' | 'kds' | 'rider' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const mode = searchParams.get('mode');
      const role = searchParams.get('role');
      if (
        mode === 'order' ||
        mode === 'customer' ||
        role === 'customer' ||
        searchParams.get('order_only') === 'true' ||
        window.location.hash === '#order'
      ) {
        return 'customer';
      }
      const paramTab = searchParams.get('tab');
      if (paramTab === 'customer') return 'customer';
      if (paramTab === 'pos') return 'customer';
      if (paramTab === 'kds') return 'kds';
      if (paramTab === 'rider') return 'rider';
      if (paramTab === 'admin') return 'admin';
    }
    return 'customer';
  });

  const [isCustomerOnlyView, setIsCustomerOnlyViewState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const mode = searchParams.get('mode');
      const role = searchParams.get('role');
      const orderOnly = searchParams.get('order_only');
      if (
        mode === 'order' ||
        mode === 'customer' ||
        role === 'customer' ||
        orderOnly === 'true' ||
        window.location.hash === '#order'
      ) {
        return true;
      }
    }
    return false;
  });

  const setIsCustomerOnlyView = (val: boolean) => {
    setIsCustomerOnlyViewState(val);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (val) {
        url.searchParams.set('mode', 'order');
        url.searchParams.delete('tab');
        setActiveTabState('customer');
      } else {
        url.searchParams.delete('mode');
        url.searchParams.delete('order_only');
        url.searchParams.delete('role');
        const nextTab = activeTab === 'customer' ? 'pos' : activeTab;
        url.searchParams.set('tab', nextTab);
        setActiveTabState(nextTab);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const [tabHistory, setTabHistory] = useState<Array<'customer' | 'pos' | 'kds' | 'rider' | 'admin'>>([]);

  const setActiveTab = (tab: 'customer' | 'pos' | 'kds' | 'rider' | 'admin') => {
    setActiveTabState((prev) => {
      if (prev !== tab) {
        setTabHistory((h) => [...h.slice(-15), prev]);
      }
      return tab;
    });
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const canGoBack = isCustomerOnlyView || tabHistory.length > 0 || activeTab !== 'pos';

  const goBack = () => {
    if (isCustomerOnlyView) {
      setIsCustomerOnlyView(false);
      return;
    }
    if (tabHistory.length > 0) {
      const prev = tabHistory[tabHistory.length - 1];
      setTabHistory((h) => h.slice(0, -1));
      setActiveTabState(prev);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', prev);
        window.history.replaceState({}, '', url.toString());
      }
    } else if (activeTab !== 'pos') {
      setActiveTab('pos');
    }
  };

  const [activeCustomerOrderId, setActiveCustomerOrderId] = useState<string | null>('ord-002');

  const updateShopLocation = (config: Partial<ShopLocationConfig>) => {
    setShopLocation((prev) => {
      const updated = { ...prev, ...config };
      localStorage.setItem(STORAGE_KEYS.SHOP_LOCATION, JSON.stringify(updated));
      sendServerAction('UPDATE_SHOP_LOCATION', { shopLocation: updated });
      return updated;
    });
    sendLineAlert('📍 อัปเดตข้อมูลที่ตั้งร้านเรียบร้อย', 'ข้อมูลชื่อร้าน ที่อยู่ เบอร์ติดต่อ และพร้อมเพย์ได้รับการบันทึกแล้ว');
  };

  // Auto-backup to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(ingredients));
  }, [ingredients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOP_LOCATION, JSON.stringify(shopLocation));
  }, [shopLocation]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STOCK_HISTORY, JSON.stringify(stockInHistory));
  }, [stockInHistory]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(lineAlerts));
  }, [lineAlerts]);

  // Helper to send alert
  const sendLineAlert = (title: string, message: string, type: LineAlert['type'] = 'low_stock', urgent = false) => {
    const newAlert: LineAlert = {
      id: `alert-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      type,
      title,
      message,
      urgent,
    };
    setLineAlerts((prev) => [newAlert, ...prev.slice(0, 25)]);
    sendServerAction('ADD_ALERT', { alert: newAlert });
  };

  // 1) Record Stock In
  const recordStockIn = (ingredientId: string, amount: number, supplier = 'ตลาดวาริน / ซัพพลายเออร์อุบล', notes = '') => {
    if (amount <= 0) return;
    const targetIng = ingredients.find((i) => i.id === ingredientId);
    if (!targetIng) return;

    const record: StockInRecord = {
      id: `rec-${Date.now()}`,
      ingredientId,
      ingredientName: targetIng.name,
      amount,
      unit: targetIng.unit,
      supplier,
      cost: Math.round(amount * targetIng.costPerUnit),
      timestamp: new Date().toISOString(),
      notes,
    };

    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === ingredientId) {
          return {
            ...ing,
            currentStock: ing.currentStock + amount,
            updatedAt: new Date().toISOString(),
          };
        }
        return ing;
      })
    );

    setStockInHistory((prev) => [record, ...prev]);
    setLastStockInRecord(record);

    sendServerAction('RECORD_STOCK_IN', { record, ingredientId, amount });

    sendLineAlert(
      '📦 รับของเข้าร้านสำเร็จ',
      `เติม ${targetIng.name} จำนวน +${amount} ${targetIng.unit} เข้าสต็อกเรียบร้อย (คงเหลือใหม่: ${targetIng.currentStock + amount} ${targetIng.unit})`,
      'reorder',
      false
    );
  };

  // 2) Undo Last Receipt
  const undoLastStockIn = (): boolean => {
    if (!lastStockInRecord) return false;

    const recordToUndo = lastStockInRecord;
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === recordToUndo.ingredientId) {
          const newStock = Math.max(0, ing.currentStock - recordToUndo.amount);
          return {
            ...ing,
            currentStock: newStock,
            updatedAt: new Date().toISOString(),
          };
        }
        return ing;
      })
    );

    setStockInHistory((prev) => prev.filter((r) => r.id !== recordToUndo.id));
    setLastStockInRecord(null);

    sendServerAction('UNDO_STOCK_IN', {
      recordId: recordToUndo.id,
      ingredientId: recordToUndo.ingredientId,
      amount: recordToUndo.amount,
    });

    sendLineAlert(
      '↩️ ย้อนรายการรับเข้าล่าสุดแล้ว',
      `ยกเลิกรายการรับเข้า ${recordToUndo.ingredientName} (-${recordToUndo.amount} ${recordToUndo.unit}) เรียบร้อย`,
      'reorder',
      false
    );

    return true;
  };

  // 3) Update Ingredient Stock directly
  const updateIngredientStock = (ingredientId: string, newStock: number) => {
    setIngredients((prev) =>
      prev.map((ing) =>
        ing.id === ingredientId
          ? { ...ing, currentStock: Math.max(0, newStock), updatedAt: new Date().toISOString() }
          : ing
      )
    );
    sendServerAction('UPDATE_STOCK', { ingredientId, newStock: Math.max(0, newStock) });
  };

  // 4) Toggle Spike Item
  const toggleSpikeItem = (ingredientId: string, customMultiplier = 2.0) => {
    let nextIsSpike = false;
    let newDynamicMin = 0;

    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === ingredientId) {
          nextIsSpike = !ing.isSpike;
          newDynamicMin = nextIsSpike
            ? Math.round(ing.minStock * customMultiplier)
            : ing.minStock;

          if (nextIsSpike) {
            sendLineAlert(
              '🔥 ปรับสถานะ: สินค้ากระแสพุ่ง (Spike Item)',
              `${ing.name} ถูกปรับเป็นสินค้ากระแสพุ่ง! จุดเตือนสั่งซื้อ (Safety Stock) ขยับขึ้นจาก ${ing.minStock} เป็น ${newDynamicMin} ${ing.unit}`,
              'spike',
              true
            );
          } else {
            sendLineAlert(
              'ℹ️ ยกเลิกสถานะสินค้ากระแสพุ่ง',
              `${ing.name} กลับสู่ระดับจุดเตือนสั่งซื้อปกติ (${ing.minStock} ${ing.unit})`,
              'spike',
              false
            );
          }

          return {
            ...ing,
            isSpike: nextIsSpike,
            dynamicMinStock: newDynamicMin,
            spikeReason: nextIsSpike ? 'ปรับด้วยตนเอง / ระบบตรวจจับการสั่งซื้อถี่' : undefined,
            updatedAt: new Date().toISOString(),
          };
        }
        return ing;
      })
    );

    sendServerAction('TOGGLE_SPIKE', {
      ingredientId,
      isSpike: nextIsSpike,
      dynamicMinStock: newDynamicMin,
      spikeReason: nextIsSpike ? 'ปรับด้วยตนเอง / ระบบตรวจจับการสั่งซื้อถี่' : undefined,
    });
  };

  // Toggle Favorite Ingredient (⭐ ของที่หยิบบ่อย)
  const toggleFavoriteIngredient = (ingredientId: string) => {
    let nextIsFavorite = false;
    let targetName = '';

    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === ingredientId) {
          nextIsFavorite = !ing.isFavorite;
          targetName = ing.name;
          return {
            ...ing,
            isFavorite: nextIsFavorite,
            updatedAt: new Date().toISOString(),
          };
        }
        return ing;
      })
    );

    sendServerAction('TOGGLE_FAVORITE', {
      ingredientId,
      isFavorite: nextIsFavorite,
    });

    sendLineAlert(
      nextIsFavorite ? '⭐ เพิ่มเป็นรายการโปรด/ของที่หยิบบ่อย' : '☆ นำออกจากรายการโปรด',
      nextIsFavorite
        ? `บันทึก "${targetName}" เป็นวัตถุดิบที่หยิบบ่อยแล้ว เพื่อการค้นหาและมอนิเตอร์สต็อกที่สะดวก`
        : `นำ "${targetName}" ออกจากรายการโปรดแล้ว`,
      'reorder',
      false
    );
  };

  // Update Workstation Slot (ตำแหน่งจัดวางในเคาน์เตอร์บาร์น้ำปั่น)
  const updateIngredientSlot = (ingredientId: string, slot: WorkstationSlot) => {
    const targetIng = ingredients.find((i) => i.id === ingredientId);
    setIngredients((prev) =>
      prev.map((ing) =>
        ing.id === ingredientId
          ? { ...ing, placementSlot: slot, updatedAt: new Date().toISOString() }
          : ing
      )
    );

    sendServerAction('UPDATE_INGREDIENT_SLOT', { ingredientId, slot });

    if (targetIng) {
      const slotName =
        slot === 'golden_zone'
          ? 'จุดเอื้อมมือ (Golden Zone 0 ก้าว)'
          : slot === 'secondary_zone'
          ? 'จุด 1 ก้าว (Secondary Zone 1.2 ม.)'
          : 'จุดเก็บลึก/หลังร้าน (Deep Storage 3.5 ม.)';
      sendLineAlert(
        '🔄 ปรับผังจุดหยิบวัตถุดิบ',
        `ย้าย ${targetIng.name} ไปไว้ที่ ${slotName} เพื่อปรับให้สอดคล้องกับความถี่ในการหยิบ`,
        'info',
        false
      );
    }
  };

  // Bulk Apply Optimal Slotting based on ABC Analysis
  const applyOptimalSlotting = (assignments: { ingredientId: string; slot: WorkstationSlot }[]) => {
    const slotMap = new Map(assignments.map((a) => [a.ingredientId, a.slot]));
    setIngredients((prev) =>
      prev.map((ing) => {
        const newSlot = slotMap.get(ing.id);
        if (newSlot) {
          return { ...ing, placementSlot: newSlot, updatedAt: new Date().toISOString() };
        }
        return ing;
      })
    );

    sendServerAction('APPLY_OPTIMAL_SLOTTING', { assignments });

    sendLineAlert(
      '⚡ ปรับผังเคาน์เตอร์ตาม ABC Analysis สำเร็จ',
      `ปรับผังจุดหยิบวัตถุดิบ ${assignments.length} รายการ ช่วยลดระยะทางเดินหยิบของลงอย่างมีนัยสำคัญ`,
      'info',
      false
    );
  };

  // Calculate BOM deductions
  const calculateDeductions = (orderItems: Order['items']) => {
    const deductions: Record<string, number> = {};

    orderItems.forEach((item) => {
      const menu = menuItems.find((m) => m.id === item.menuItemId);
      if (menu) {
        menu.bom.forEach((b) => {
          const amountPerCup = calculateAdjustedBOM(b, item.sweetness);
          const totalAmount = amountPerCup * item.quantity;
          deductions[b.ingredientId] = (deductions[b.ingredientId] || 0) + totalAmount;
        });
      }

      item.selectedToppings.forEach((top) => {
        const totalTopAmount = top.amount * item.quantity;
        deductions[top.ingredientId] = (deductions[top.ingredientId] || 0) + totalTopAmount;
      });
    });

    return deductions;
  };

  // 5) Deduct BOM
  const deductBOMForOrder = (orderItems: Order['items']) => {
    const deductions = calculateDeductions(orderItems);

    setIngredients((prev) => {
      const updated = prev.map((ing) => {
        const deductAmount = deductions[ing.id] || 0;
        if (deductAmount > 0) {
          const remaining = Math.max(0, ing.currentStock - deductAmount);
          const alertThreshold = ing.isSpike ? ing.dynamicMinStock : ing.minStock;

          if (remaining <= alertThreshold && ing.currentStock > alertThreshold) {
            setTimeout(() => {
              sendLineAlert(
                '⚠️ วัตถุดิบแตะจุดสั่งซื้อแล้ว!',
                `${ing.name} เหลือเพียง ${remaining} ${ing.unit} (จุดเตือน: ${alertThreshold} ${ing.unit}) แนะนำสั่งซื้อเพิ่มในรอบสัปดาห์นี้`,
                'low_stock',
                true
              );
            }, 100);
          }

          return {
            ...ing,
            currentStock: remaining,
            updatedAt: new Date().toISOString(),
          };
        }
        return ing;
      });
      return updated;
    });

    return deductions;
  };

  // 6) Restore BOM
  const restoreBOMForOrder = (orderItems: Order['items']) => {
    const additions: Record<string, number> = {};

    orderItems.forEach((item) => {
      const menu = menuItems.find((m) => m.id === item.menuItemId);
      if (menu) {
        menu.bom.forEach((b) => {
          const amountPerCup = calculateAdjustedBOM(b, item.sweetness);
          const totalAmount = amountPerCup * item.quantity;
          additions[b.ingredientId] = (additions[b.ingredientId] || 0) + totalAmount;
        });
      }

      item.selectedToppings.forEach((top) => {
        const totalTopAmount = top.amount * item.quantity;
        additions[top.ingredientId] = (additions[top.ingredientId] || 0) + totalTopAmount;
      });
    });

    setIngredients((prev) =>
      prev.map((ing) => {
        const addAmount = additions[ing.id] || 0;
        if (addAmount > 0) {
          return {
            ...ing,
            currentStock: ing.currentStock + addAmount,
            updatedAt: new Date().toISOString(),
          };
        }
        return ing;
      })
    );

    return additions;
  };

  // 7) Create Order
  const createOrder = (orderData: Omit<Order, 'id' | 'createdAt' | 'status'>): Order => {
    const newId = `ord-${Date.now()}`;
    const newOrder: Order = {
      ...orderData,
      id: newId,
      createdAt: new Date().toISOString(),
      status: 'queued',
    };

    // Calculate deductions & update local ingredients
    const deductions = deductBOMForOrder(newOrder.items);

    setOrders((prev) => [newOrder, ...prev]);

    // Send atomic action to server with deductions
    sendServerAction('CREATE_ORDER', {
      order: newOrder,
      deductions,
    });

    // Play chime locally for the creator
    playNewOrderChime();
    setLatestNewOrderAlert(newOrder);

    const channelLabel = newOrder.channel === 'counter' ? 'หน้าร้าน (POS)' : 'สั่งออนไลน์ Delivery';
    sendLineAlert(
      `🥤 ออเดอร์ใหม่ ${newOrder.orderNumber} (${channelLabel})`,
      `ยอดรวม ฿${newOrder.totalAmount} • ${newOrder.items.map((i) => `${i.menuItemName} x${i.quantity}`).join(', ')}${newOrder.isDelivery ? ` • จัดส่ง: ${newOrder.deliveryInfo?.landmarkName || newOrder.deliveryInfo?.address}` : ''}`,
      newOrder.isDelivery ? 'delivery' : 'reorder',
      true
    );

    return newOrder;
  };

  // 8) Void Order
  const voidOrder = (orderId: string, reason = 'ลูกค้ายกเลิก / พนักงานกดผิด') => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder || targetOrder.status === 'voided') return;

    const restorations = restoreBOMForOrder(targetOrder.items);

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'voided', voidReason: reason } : o))
    );

    sendServerAction('VOID_ORDER', {
      orderId,
      reason,
      restorations,
    });

    sendLineAlert(
      `🚫 ยกเลิกออเดอร์ (Void) ${targetOrder.orderNumber}`,
      `ออเดอร์ ${targetOrder.orderNumber} ถูกยกเลิกแล้ว • ระบบได้คืนวัตถุดิบทั้งหมดกลับเข้าคลังเรียบร้อย`,
      'spike',
      false
    );
  };

  // 9) Update Order Status
  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return { ...o, status };
        }
        return o;
      })
    );

    sendServerAction('UPDATE_ORDER_STATUS', { orderId, status });

    const order = orders.find((o) => o.id === orderId);
    if (order && order.isDelivery) {
      if (status === 'out_for_delivery') {
        sendLineAlert(
          `🛵 ไรเดอร์กำลังนำส่ง ${order.orderNumber}`,
          `กำลังออกไปส่งให้ ${order.deliveryInfo?.customerName || 'ลูกค้า'} ที่ ${order.deliveryInfo?.landmarkName || order.deliveryInfo?.address}`,
          'delivery'
        );
      } else if (status === 'completed') {
        sendLineAlert(
          `✅ ส่งถึงมือลูกค้าแล้ว ${order.orderNumber}`,
          `จัดส่งสำเร็จเรียบร้อย ขอบคุณลูกค้าที่อุดหนุนครับ!`,
          'delivery'
        );
      }
    }
  };

  // 10) Spike Detection Engine
  const runSpikeDetection = () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const recentOrders = orders.filter(
      (o) => new Date(o.createdAt).getTime() > twoHoursAgo && o.status !== 'voided'
    );

    const itemCounts: Record<string, number> = {};
    recentOrders.forEach((o) => {
      o.items.forEach((item) => {
        itemCounts[item.menuItemId] = (itemCounts[item.menuItemId] || 0) + item.quantity;
      });
    });

    let detectedAny = false;

    Object.entries(itemCounts).forEach(([menuId, count]) => {
      if (count >= 3) {
        const menu = menuItems.find((m) => m.id === menuId);
        if (menu) {
          const mainIngReq = menu.bom.find((b) => {
            const ing = ingredients.find((i) => i.id === b.ingredientId);
            return ing && (ing.category === 'fruit' || ing.category === 'dairy');
          });

          if (mainIngReq) {
            const targetIng = ingredients.find((i) => i.id === mainIngReq.ingredientId);
            if (targetIng && !targetIng.isSpike) {
              toggleSpikeItem(targetIng.id, 2.0);
              detectedAny = true;
            }
          }
        }
      }
    });

    if (!detectedAny) {
      const signatureIng = ingredients.find((i) => i.id === 'ing-coconut-meat' || i.id === 'ing-bear-milk') || ingredients[0];
      if (signatureIng && !signatureIng.isSpike) {
        toggleSpikeItem(signatureIng.id, 2.0);
      } else {
        sendLineAlert(
          '🔍 ผลการวิเคราะห์ยอดขายพุ่ง (Spike Engine)',
          'ประมวลผลยอดขายชั่วโมงล่าสุดเรียบร้อย ไม่พบการสั่งซื้อที่พุ่งผิดปกติเกินเกณฑ์ สต็อกปัจจุบันอยู่ในเกณฑ์ที่คำนวณไว้',
          'spike',
          false
        );
      }
    }
  };

  // 11) Update BOM
  const updateBOM = (menuItemId: string, newBOM: BOMRequirement[]) => {
    setMenuItems((prev) =>
      prev.map((m) => (m.id === menuItemId ? { ...m, bom: newBOM } : m))
    );
    sendServerAction('UPDATE_BOM', { menuItemId, bom: newBOM });
  };

  // 12) Add Menu
  const addMenuItem = (menuData: Omit<MenuItem, 'id'>): MenuItem => {
    const newMenu: MenuItem = {
      ...menuData,
      id: `menu-${Date.now()}`,
    };
    setMenuItems((prev) => [...prev, newMenu]);
    sendServerAction('ADD_MENU', { menuItem: newMenu });

    sendLineAlert(
      `✨ เพิ่มเมนูใหม่: ${newMenu.name}`,
      `ราคา ฿${newMenu.basePrice} • มีวัตถุดิบในสูตร BOM ${newMenu.bom.length} รายการ พร้อมตัดสต็อกอัตโนมัติ`,
      'reorder',
      false
    );
    return newMenu;
  };

  // 13) Update Menu
  const updateMenuItem = (id: string, partial: Partial<MenuItem>) => {
    setMenuItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...partial } : m))
    );
    sendServerAction('UPDATE_MENU', { id, menuUpdate: partial });
    sendLineAlert('📝 ปรับปรุงสูตรเมนู', 'ข้อมูลเมนูและสัดส่วนวัตถุดิบ BOM ได้รับการอัปเดตเรียบร้อย');
  };

  // 14) Delete Menu
  const deleteMenuItem = (id: string) => {
    const target = menuItems.find((m) => m.id === id);
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
    sendServerAction('DELETE_MENU', { id });
    if (target) {
      sendLineAlert('🗑️ ลบเมนูออกจากระบบ', `เมนู "${target.name}" ถูกลบออกจากรายการขายเรียบร้อย`);
    }
  };

  const dismissAlert = (alertId: string) => {
    setLineAlerts((prev) => prev.filter((a) => a.id !== alertId));
    sendServerAction('DISMISS_ALERT', { alertId });
  };

  const clearAlerts = () => {
    setLineAlerts([]);
  };

  const triggerManualLineAlert = (title: string, message: string, type: LineAlert['type'] = 'low_stock') => {
    sendLineAlert(title, message, type, true);
  };

  const startNewMonthReset = () => {
    setOrders([]);
    setStockInHistory([]);
    setLastStockInRecord(null);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_HISTORY);
    sendServerAction('START_NEW_MONTH', {});
    sendLineAlert('🗓️ เริ่มต้นรอบเดือนใหม่', 'ล้างประวัติออเดอร์และยอดขายประจำเดือนเรียบร้อย พร้อมรับออเดอร์เดือนใหม่');
  };

  const resetDemoData = async () => {
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.current }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          applyServerData(json.data);
        }
      }
    } catch {
      // Local fallback
      setIngredients(INITIAL_INGREDIENTS);
      setMenuItems(INITIAL_MENU_ITEMS);
      setOrders(INITIAL_ORDERS);
      setStockInHistory([]);
      setLastStockInRecord(null);
      setShopLocation(SHOP_LOCATION);
    }
    localStorage.removeItem(STORAGE_KEYS.INGREDIENTS);
    localStorage.removeItem(STORAGE_KEYS.MENU_ITEMS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.ALERTS);
    localStorage.removeItem(STORAGE_KEYS.SHOP_LOCATION);
    sendLineAlert('🔄 รีเซ็ตข้อมูลตั้งต้นสำเร็จ', 'ข้อมูลระบบคลังและออเดอร์ถูกรีเซ็ตกลับสู่ค่าเริ่มต้นสำหรับการทดสอบ');
  };

  return (
    <AppContext.Provider
      value={{
        ingredients,
        menuItems,
        orders,
        stockInHistory,
        lastStockInRecord,
        lineAlerts,
        activeTab,
        activeCustomerOrderId,
        shopLocation,
        lineConfig,
        latestNewOrderAlert,
        isCustomerOnlyView,
        canGoBack,
        syncStatus,
        lastSyncTime,
        goBack,
        setActiveTab,
        setActiveCustomerOrderId,
        updateShopLocation,
        updateLineConfig,
        dismissNewOrderAlert,
        setIsCustomerOnlyView,
        forceSync,
        recordStockIn,
        undoLastStockIn,
        updateIngredientStock,
        toggleSpikeItem,
        toggleFavoriteIngredient,
        updateIngredientSlot,
        applyOptimalSlotting,
        updateBOM,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        runSpikeDetection,
        createOrder,
        voidOrder,
        updateOrderStatus,
        dismissAlert,
        clearAlerts,
        triggerManualLineAlert,
        resetDemoData,
        startNewMonthReset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
