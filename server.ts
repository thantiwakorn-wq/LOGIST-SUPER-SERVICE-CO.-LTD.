import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_INGREDIENTS,
  INITIAL_MENU_ITEMS,
  INITIAL_ORDERS,
  SHOP_LOCATION,
} from './src/data/mockData';
import {
  Ingredient,
  MenuItem,
  Order,
  StockInRecord,
  LineAlert,
  OrderStatus,
  ShopLocationConfig,
  LineConfig,
} from './src/types';

interface StoreData {
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  orders: Order[];
  stockInHistory: StockInRecord[];
  lineAlerts: LineAlert[];
  shopLocation: ShopLocationConfig;
  lineConfig: LineConfig;
  version: number;
  updatedAt: string;
}

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createInitialStore(): StoreData {
  const initialAlerts: LineAlert[] = [
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

  return {
    ingredients: INITIAL_INGREDIENTS,
    menuItems: INITIAL_MENU_ITEMS,
    orders: INITIAL_ORDERS,
    stockInHistory: [],
    lineAlerts: initialAlerts,
    shopLocation: SHOP_LOCATION,
    lineConfig: DEFAULT_LINE_CONFIG,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

function loadStore(): StoreData {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.ingredients) && Array.isArray(parsed.menuItems)) {
        console.log(`[Store] Loaded existing data from store.json (version ${parsed.version}, ${parsed.orders.length} orders)`);
        return parsed;
      }
    } catch (err) {
      console.error('[Store] Failed to parse store.json, using defaults:', err);
    }
  }

  const initial = createInitialStore();
  saveStore(initial);
  console.log('[Store] Initialized store.json with default dataset');
  return initial;
}

let saveTimer: NodeJS.Timeout | null = null;
function saveStore(data: StoreData) {
  ensureDataDir();
  try {
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error('[Store] Failed to write store.json:', err);
  }
}

function triggerSave(data: StoreData) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveStore(data);
  }, 100);
}

// Active SSE Connections
interface SSEClient {
  id: string;
  res: express.Response;
}
const sseClients = new Map<string, express.Response>();

function broadcast(payload: { type: string; version: number; updatedAt: string; [key: string]: any }) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (const [id, clientRes] of sseClients.entries()) {
    try {
      clientRes.write(message);
    } catch (err) {
      sseClients.delete(id);
    }
  }
}

async function startServer() {
  const app = express();
  let currentStore = loadStore();

  app.use(express.json({ limit: '15mb' }));

  // CORS for local flexibility
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      version: currentStore.version,
      connectedClients: sseClients.size,
      updatedAt: currentStore.updatedAt,
    });
  });

  // 1. Get full state
  app.get('/api/sync', (req, res) => {
    res.json({
      success: true,
      version: currentStore.version,
      updatedAt: currentStore.updatedAt,
      data: currentStore,
    });
  });

  // 2. Server-Sent Events (SSE) stream for instant real-time sync across all devices
  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sseClients.set(clientId, res);

    // Initial event with current snapshot
    res.write(`data: ${JSON.stringify({
      type: 'init',
      version: currentStore.version,
      updatedAt: currentStore.updatedAt,
      data: currentStore,
    })}\n\n`);

    // Keep-alive heartbeat every 20 seconds
    const interval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(interval);
        sseClients.delete(clientId);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(interval);
      sseClients.delete(clientId);
    });
  });

  // 3. Process atomic action or state mutations
  app.post('/api/action', (req, res) => {
    const { action, payload, clientId } = req.body || {};

    if (!action) {
      res.status(400).json({ error: 'Action type required' });
      return;
    }

    try {
      let changed = false;

      switch (action) {
        case 'CREATE_ORDER': {
          const { order, deductions } = payload;
          if (order && !currentStore.orders.some((o) => o.id === order.id)) {
            currentStore.orders.unshift(order);
            // Apply deductions if provided
            if (deductions && typeof deductions === 'object') {
              currentStore.ingredients = currentStore.ingredients.map((ing) => {
                const deduct = deductions[ing.id] || 0;
                if (deduct > 0) {
                  return {
                    ...ing,
                    currentStock: Math.max(0, ing.currentStock - deduct),
                    updatedAt: new Date().toISOString(),
                  };
                }
                return ing;
              });
            }
            changed = true;
          }
          break;
        }

        case 'UPDATE_ORDER_STATUS': {
          const { orderId, status } = payload;
          const target = currentStore.orders.find((o) => o.id === orderId);
          if (target) {
            target.status = status;
            changed = true;
          }
          break;
        }

        case 'VOID_ORDER': {
          const { orderId, reason, restorations } = payload;
          const target = currentStore.orders.find((o) => o.id === orderId);
          if (target && target.status !== 'voided') {
            target.status = 'voided';
            target.voidReason = reason || 'ยกเลิกออเดอร์';
            if (restorations && typeof restorations === 'object') {
              currentStore.ingredients = currentStore.ingredients.map((ing) => {
                const restore = restorations[ing.id] || 0;
                if (restore > 0) {
                  return {
                    ...ing,
                    currentStock: ing.currentStock + restore,
                    updatedAt: new Date().toISOString(),
                  };
                }
                return ing;
              });
            }
            changed = true;
          }
          break;
        }

        case 'RECORD_STOCK_IN': {
          const { record, ingredientId, amount } = payload;
          if (record && !currentStore.stockInHistory.some((r) => r.id === record.id)) {
            currentStore.stockInHistory.unshift(record);
            currentStore.ingredients = currentStore.ingredients.map((ing) =>
              ing.id === ingredientId
                ? { ...ing, currentStock: ing.currentStock + amount, updatedAt: new Date().toISOString() }
                : ing
            );
            changed = true;
          }
          break;
        }

        case 'UNDO_STOCK_IN': {
          const { recordId, ingredientId, amount } = payload;
          currentStore.stockInHistory = currentStore.stockInHistory.filter((r) => r.id !== recordId);
          currentStore.ingredients = currentStore.ingredients.map((ing) =>
            ing.id === ingredientId
              ? { ...ing, currentStock: Math.max(0, ing.currentStock - amount), updatedAt: new Date().toISOString() }
              : ing
          );
          changed = true;
          break;
        }

        case 'UPDATE_STOCK': {
          const { ingredientId, newStock } = payload;
          currentStore.ingredients = currentStore.ingredients.map((ing) =>
            ing.id === ingredientId
              ? { ...ing, currentStock: Math.max(0, newStock), updatedAt: new Date().toISOString() }
              : ing
          );
          changed = true;
          break;
        }

        case 'TOGGLE_FAVORITE': {
          const { ingredientId, isFavorite } = payload;
          currentStore.ingredients = currentStore.ingredients.map((ing) =>
            ing.id === ingredientId
              ? {
                  ...ing,
                  isFavorite: typeof isFavorite === 'boolean' ? isFavorite : !ing.isFavorite,
                  updatedAt: new Date().toISOString(),
                }
              : ing
          );
          changed = true;
          break;
        }

        case 'UPDATE_INGREDIENT_SLOT': {
          const { ingredientId, slot } = payload;
          currentStore.ingredients = currentStore.ingredients.map((ing) =>
            ing.id === ingredientId
              ? { ...ing, placementSlot: slot, updatedAt: new Date().toISOString() }
              : ing
          );
          changed = true;
          break;
        }

        case 'APPLY_OPTIMAL_SLOTTING': {
          const { assignments } = payload;
          if (Array.isArray(assignments)) {
            const map = new Map(assignments.map((a: any) => [a.ingredientId, a.slot]));
            currentStore.ingredients = currentStore.ingredients.map((ing) => {
              const newSlot = map.get(ing.id);
              if (newSlot) {
                return { ...ing, placementSlot: newSlot, updatedAt: new Date().toISOString() };
              }
              return ing;
            });
            changed = true;
          }
          break;
        }

        case 'TOGGLE_SPIKE': {
          const { ingredientId, isSpike, dynamicMinStock, spikeReason } = payload;
          currentStore.ingredients = currentStore.ingredients.map((ing) =>
            ing.id === ingredientId
              ? {
                  ...ing,
                  isSpike,
                  dynamicMinStock,
                  spikeReason,
                  updatedAt: new Date().toISOString(),
                }
              : ing
          );
          changed = true;
          break;
        }

        case 'UPDATE_BOM': {
          const { menuItemId, bom } = payload;
          currentStore.menuItems = currentStore.menuItems.map((m) =>
            m.id === menuItemId ? { ...m, bom } : m
          );
          changed = true;
          break;
        }

        case 'ADD_MENU': {
          const { menuItem } = payload;
          if (menuItem && !currentStore.menuItems.some((m) => m.id === menuItem.id)) {
            currentStore.menuItems.push(menuItem);
            changed = true;
          }
          break;
        }

        case 'UPDATE_MENU': {
          const { id, menuUpdate } = payload;
          currentStore.menuItems = currentStore.menuItems.map((m) =>
            m.id === id ? { ...m, ...menuUpdate } : m
          );
          changed = true;
          break;
        }

        case 'DELETE_MENU': {
          const { id } = payload;
          currentStore.menuItems = currentStore.menuItems.filter((m) => m.id !== id);
          changed = true;
          break;
        }

        case 'UPDATE_SHOP_LOCATION': {
          const { shopLocation } = payload;
          if (shopLocation) {
            currentStore.shopLocation = { ...currentStore.shopLocation, ...shopLocation };
            changed = true;
          }
          break;
        }

        case 'UPDATE_LINE_CONFIG': {
          const { lineConfig } = payload;
          if (lineConfig) {
            currentStore.lineConfig = { ...currentStore.lineConfig, ...lineConfig };
            changed = true;
          }
          break;
        }

        case 'ADD_ALERT': {
          const { alert } = payload;
          if (alert) {
            currentStore.lineAlerts = [alert, ...currentStore.lineAlerts.slice(0, 30)];
            changed = true;
          }
          break;
        }

        case 'DISMISS_ALERT': {
          const { alertId } = payload;
          currentStore.lineAlerts = currentStore.lineAlerts.filter((a) => a.id !== alertId);
          changed = true;
          break;
        }

        case 'START_NEW_MONTH': {
          currentStore.orders = [];
          currentStore.stockInHistory = [];
          changed = true;
          break;
        }

        case 'SYNC_FULL_STATE': {
          const { updates } = payload;
          if (updates) {
            if (Array.isArray(updates.ingredients)) currentStore.ingredients = updates.ingredients;
            if (Array.isArray(updates.menuItems)) currentStore.menuItems = updates.menuItems;
            if (Array.isArray(updates.orders)) currentStore.orders = updates.orders;
            if (Array.isArray(updates.stockInHistory)) currentStore.stockInHistory = updates.stockInHistory;
            if (Array.isArray(updates.lineAlerts)) currentStore.lineAlerts = updates.lineAlerts;
            if (updates.shopLocation) currentStore.shopLocation = updates.shopLocation;
            if (updates.lineConfig) currentStore.lineConfig = updates.lineConfig;
            changed = true;
          }
          break;
        }

        default:
          res.status(400).json({ error: `Unknown action: ${action}` });
          return;
      }

      if (changed) {
        currentStore.version = (currentStore.version || 0) + 1;
        currentStore.updatedAt = new Date().toISOString();
        triggerSave(currentStore);

        // Broadcast immediately to all connected devices!
        broadcast({
          type: 'sync',
          action,
          payload,
          version: currentStore.version,
          updatedAt: currentStore.updatedAt,
          data: currentStore,
          senderId: clientId,
        });
      }

      res.json({
        success: true,
        version: currentStore.version,
        updatedAt: currentStore.updatedAt,
      });
    } catch (err: any) {
      console.error('[Action Error]', err);
      res.status(500).json({ error: err?.message || 'Server action error' });
    }
  });

  // 4. Reset endpoint (requires deliberate confirmation)
  app.post('/api/reset', (req, res) => {
    const { clientId } = req.body || {};
    currentStore = createInitialStore();
    currentStore.version = (currentStore.version || 0) + 1;
    currentStore.updatedAt = new Date().toISOString();
    saveStore(currentStore);

    broadcast({
      type: 'reset',
      version: currentStore.version,
      updatedAt: currentStore.updatedAt,
      data: currentStore,
      senderId: clientId,
    });

    res.json({
      success: true,
      version: currentStore.version,
      updatedAt: currentStore.updatedAt,
      data: currentStore,
    });
  });

  // 5. Mount Vite middleware for development or Static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Smoothie Stock & Delivery server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
