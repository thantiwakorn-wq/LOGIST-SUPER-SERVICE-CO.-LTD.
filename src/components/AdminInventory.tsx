import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Ingredient, StorageZone, BOMRequirement, MenuItem, Order } from '../types';
import { exportToGoogleSheetsFormat, downloadCSV } from '../utils/helpers';
import { AddMenuRecipeModal } from './AddMenuRecipeModal';
import { LineSettingsModal } from './LineSettingsModal';
import { MonthlyReportModal } from './MonthlyReportModal';
import { StockDashboard } from './StockDashboard';
import { ABCSlottingOptimizer } from './ABCSlottingOptimizer';
import {
  Package,
  AlertTriangle,
  Flame,
  Search,
  Plus,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Copy,
  TrendingUp,
  Refrigerator,
  Sparkles,
  Layers,
  ShoppingBag,
  Bell,
  Trash2,
  Edit2,
  ArrowUpDown,
  Calendar,
  DollarSign,
  PieChart,
  Settings,
  Send,
  ExternalLink,
  Clock,
  BarChart3,
  Coffee,
  Star,
  Activity,
} from 'lucide-react';

export const AdminInventory: React.FC = () => {
  const {
    ingredients,
    menuItems,
    orders,
    stockInHistory,
    lastStockInRecord,
    lineAlerts,
    lineConfig,
    recordStockIn,
    undoLastStockIn,
    updateIngredientStock,
    toggleSpikeItem,
    toggleFavoriteIngredient,
    runSpikeDetection,
    updateBOM,
    deleteMenuItem,
    dismissAlert,
    clearAlerts,
    triggerManualLineAlert,
  } = useApp();

  // Active sub-view:
  // 'dashboard' = แดชบอร์ด & กราฟแสดงสต็อกดูง่าย + ของที่หยิบบ่อย
  // 'abc_slotting' = วิเคราะห์ ABC & ผังเคาน์เตอร์ลดระยะทางหยิบ
  // 'inventory' = สต็อก & บันทึกของเข้า (ตารางละเอียด)
  // 'replenishment' = ดูสิ่งที่ต้องเติมใน 1 คลิก
  // 'bom' = จัดการสูตร BOM
  // 'line_alerts' = แจ้งเตือน LINE เจ้าของร้าน
  // 'analytics' = วิเคราะห์ยอดขายและวัตถุดิบ
  // 'monthly_report' = สรุปยอดขายรายเดือน & นำออก Google Sheets
  const [subView, setSubView] = useState<
    'dashboard' | 'abc_slotting' | 'inventory' | 'replenishment' | 'bom' | 'line_alerts' | 'analytics' | 'monthly_report'
  >('dashboard');

  // Instant Search Query
  const [searchQuery, setSearchQuery] = useState('');
  // Zone Filter
  const [zoneFilter, setZoneFilter] = useState<'all' | StorageZone>('all');
  // Only Low Stock Filter
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  // Only Favorites Filter (⭐ ของที่หยิบบ่อย)
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Stock-in Form State
  const [selectedIngId, setSelectedIngId] = useState<string>(ingredients[0]?.id || '');
  const [stockInAmount, setStockInAmount] = useState<string>('');
  const [stockInSupplier, setStockInSupplier] = useState('ตลาดวาริน / ซัพพลายเออร์อุบล');
  const [stockInNotes, setStockInNotes] = useState('');
  const [showStockInModal, setShowStockInModal] = useState(false);

  // Recipe & Menu Modal State
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [menuToEdit, setMenuToEdit] = useState<MenuItem | null>(null);

  // LINE Connection Settings Modal State
  const [showLineSettingsModal, setShowLineSettingsModal] = useState(false);

  // 1-Click Replenishment Sheet Drawer/Modal
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Analytics Timeframe: 'day' (วันนี้), 'week' (7 วัน / สัปดาห์), 'month' (30 วัน / เดือน), 'all' (ทั้งหมด)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'day' | 'week' | 'month' | 'all'>('day');

  // Filtered Ingredients with Instant Search (1-2 keystrokes)
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const matchSearch =
        !searchQuery ||
        ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ing.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchZone = zoneFilter === 'all' || ing.zone === zoneFilter;

      const threshold = ing.isSpike ? ing.dynamicMinStock : ing.minStock;
      const isLow = ing.currentStock <= threshold;
      const matchLow = !onlyLowStock || isLow;
      const matchFavorite = !onlyFavorites || !!ing.isFavorite;

      return matchSearch && matchZone && matchLow && matchFavorite;
    });
  }, [ingredients, searchQuery, zoneFilter, onlyLowStock, onlyFavorites]);

  // Favorite items count (⭐ ของที่หยิบบ่อย)
  const favoriteItems = useMemo(() => {
    return ingredients.filter((ing) => ing.isFavorite);
  }, [ingredients]);

  // Low stock items count
  const lowStockItems = useMemo(() => {
    return ingredients.filter(
      (ing) => ing.currentStock <= (ing.isSpike ? ing.dynamicMinStock : ing.minStock)
    );
  }, [ingredients]);

  // Spike items count
  const spikeItems = useMemo(() => {
    return ingredients.filter((ing) => ing.isSpike);
  }, [ingredients]);

  // Handle Stock-in Submit
  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(stockInAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('กรุณาระบุจำนวนที่รับเข้าให้ถูกต้อง');
      return;
    }

    recordStockIn(selectedIngId, amt, stockInSupplier, stockInNotes);
    setStockInAmount('');
    setStockInNotes('');
    setShowStockInModal(false);
  };

  // Copy to Google Sheets format
  const handleCopyGoogleSheetsData = (type: 'inventory' | 'replenishment' | 'orders') => {
    const csvData = exportToGoogleSheetsFormat(type, ingredients, orders);
    navigator.clipboard.writeText(csvData);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // Download CSV for Google Sheets
  const handleDownloadCSV = (type: 'inventory' | 'replenishment' | 'orders') => {
    const csvData = exportToGoogleSheetsFormat(type, ingredients, orders);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csvData, `smoothie_${type}_${dateStr}.csv`);
  };

  // Analytics Calculations based on Period (Day / Week / Month / All)
  const analyticsData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    const filteredOrders = orders.filter((o) => {
      if (o.status === 'voided') return false;
      const orderTime = new Date(o.createdAt).getTime();

      if (analyticsPeriod === 'day') {
        return orderTime >= startOfToday;
      }
      if (analyticsPeriod === 'week') {
        return orderTime >= sevenDaysAgo;
      }
      if (analyticsPeriod === 'month') {
        return orderTime >= thirtyDaysAgo;
      }
      return true;
    });

    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const counterRevenue = filteredOrders
      .filter((o) => o.channel === 'counter')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const deliveryRevenue = filteredOrders
      .filter((o) => o.channel === 'online' || o.isDelivery)
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const totalCups = filteredOrders.reduce(
      (sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0),
      0
    );

    // Menu Sales Count
    const menuSalesMap: Record<string, { name: string; count: number; revenue: number; image: string }> = {};
    filteredOrders.forEach((o) => {
      o.items.forEach((it) => {
        if (!menuSalesMap[it.menuItemId]) {
          const menu = menuItems.find((m) => m.id === it.menuItemId);
          menuSalesMap[it.menuItemId] = {
            name: it.menuItemName,
            count: 0,
            revenue: 0,
            image: menu?.image || '🥤',
          };
        }
        menuSalesMap[it.menuItemId].count += it.quantity;
        menuSalesMap[it.menuItemId].revenue += it.price * it.quantity;
      });
    });

    const topMenus = Object.values(menuSalesMap).sort((a, b) => b.count - a.count);

    return {
      filteredOrders,
      totalRevenue,
      counterRevenue,
      deliveryRevenue,
      totalCups,
      orderCount: filteredOrders.length,
      averageTicket: filteredOrders.length > 0 ? Math.round(totalRevenue / filteredOrders.length) : 0,
      topMenus,
    };
  }, [orders, analyticsPeriod, menuItems]);

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-4 space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-stone-900 text-white p-4 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-xl">
            📊
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base leading-tight">
              Smart Inventory & เจ้าของร้าน
            </h1>
            <p className="text-xs text-stone-400">
              สต็อกรอบ 1 สัปดาห์ • Spike Detection • Dynamic Safety Stock • Google Sheets
            </p>
          </div>
        </div>

        {/* Action Buttons: Monthly Report & Google Sheets, 1-Click Purchase Plan & Spike Run */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Monthly Report & Google Sheets Button - Highlighted & Easy to Press */}
          <button
            type="button"
            onClick={() => setSubView('monthly_report')}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>สรุปรายเดือน & Google Sheets</span>
          </button>

          {/* Spike Engine Button */}
          <button
            type="button"
            onClick={runSpikeDetection}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>ตรวจยอดขายพุ่ง (Spike Engine)</span>
          </button>

          {/* 1-Click Reorder List ("กดปุ่มเดียวแล้วได้ดูว่ามีอะไรที่ต้องเติมเพิ่มพร้อมจำนวน") */}
          <button
            type="button"
            onClick={() => setSubView('replenishment')}
            className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ดูของที่ต้องเติม ({lowStockItems.length} รายการ)</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
        <button
          type="button"
          onClick={() => setSubView('dashboard')}
          className={`px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subView === 'dashboard'
              ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-xs font-black'
              : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-700" />
          <span>📊 แดชบอร์ด & กราฟสต็อก</span>
          {favoriteItems.length > 0 && (
            <span className="bg-amber-950 text-amber-100 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              ⭐ {favoriteItems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubView('abc_slotting')}
          className={`px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subView === 'abc_slotting'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-black'
              : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-950 border-amber-300 hover:bg-amber-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-amber-600" />
          <span>⚡ วิเคราะห์ ABC & ลดระยะหยิบ</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('monthly_report')}
          className={`px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subView === 'monthly_report'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
              : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>📊 สรุปรายเดือน & Google Sheets</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('inventory')}
          className={`px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subView === 'inventory'
              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>คลังสต็อก & รับของเข้า</span>
          {lowStockItems.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {lowStockItems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubView('replenishment')}
          className={`px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subView === 'replenishment'
              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>ใบสั่งของรอบสัปดาห์ (1-Click)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('bom')}
          className={`px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subView === 'bom'
              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>จัดการสูตร (BOM)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('line_alerts')}
          className={`px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subView === 'line_alerts'
              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-emerald-600" />
          <span>เตือน LINE ร้าน ({lineAlerts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('analytics')}
          className={`px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subView === 'analytics'
              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>วิเคราะห์ยอดขาย & วัตถุดิบ</span>
        </button>
      </div>

      {/* VIEW 0: STOCK DASHBOARD & VISUAL GRAPHS + FAVORITES */}
      {subView === 'dashboard' && (
        <StockDashboard
          onOpenStockIn={(ingId) => {
            if (ingId) setSelectedIngId(ingId);
            setShowStockInModal(true);
          }}
          onGoToReplenishment={() => setSubView('replenishment')}
          onGoToABCSlotting={() => setSubView('abc_slotting')}
        />
      )}

      {/* VIEW: ABC SLOTTING & PICK DISTANCE OPTIMIZER */}
      {subView === 'abc_slotting' && <ABCSlottingOptimizer />}

      {/* VIEW 1: INVENTORY & STOCK-IN */}
      {subView === 'inventory' && (
        <div className="space-y-4">
          {/* Quick Actions Bar: Record Stock-in, Undo Last, Export to Google Sheets */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Record Stock-In Button */}
              <button
                type="button"
                onClick={() => setShowStockInModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>บันทึกของเข้าร้าน</span>
              </button>

              {/* View Dashboard Button */}
              <button
                type="button"
                onClick={() => setSubView('dashboard')}
                className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                <span>📊 ดูกราฟสรุป & ของที่หยิบบ่อย</span>
              </button>

              {/* Undo Last Receipt Button ("ถ้ากรอกผิด ย้อนรายการล่าสุดได้") */}
              {lastStockInRecord && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`ย้อนรายการล่าสุด: คืนสต็อก ${lastStockInRecord.ingredientName} (-${lastStockInRecord.amount} ${lastStockInRecord.unit}) ใช่หรือไม่?`)) {
                      undoLastStockIn();
                    }
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    ย้อนรายการล่าสุด ({lastStockInRecord.ingredientName} -{lastStockInRecord.amount}{' '}
                    {lastStockInRecord.unit})
                  </span>
                </button>
              )}
            </div>

            {/* Google Sheets Actions & Monthly Report */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSubView('monthly_report')}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>สรุปยอดรายเดือน</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyGoogleSheetsData('inventory')}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>คัดลอกลง Google Sheets</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadCSV('inventory')}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>ส่งออก Google Sheets (CSV)</span>
              </button>
            </div>
          </div>

          {copiedNotification && (
            <div className="bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold text-center">
              ✓ คัดลอกข้อมูลสต็อกในรูปแบบที่พร้อมนำไปวาง (Ctrl+V) ลงใน Google Sheets เรียบร้อยแล้ว!
            </div>
          )}

          {/* Instant Search Bar & Zone Filter */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
            {/* Instant Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="พิมพ์ไม่กี่ตัวอักษรเพื่อค้นหาทันที เช่น มะ, สต, นม, แก้ว..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-600 text-xs text-stone-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter by storage zone & low stock */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-stone-500">แยกพื้นที่จัดเก็บ:</span>
                <button
                  type="button"
                  onClick={() => setZoneFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    zoneFilter === 'all'
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  ทั้งหมด ({ingredients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setZoneFilter('chilled')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                    zoneFilter === 'chilled'
                      ? 'bg-sky-600 text-white'
                      : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                  }`}
                >
                  <Refrigerator className="w-3 h-3" />
                  <span>ตู้เย็น/ถังน้ำแข็ง ({ingredients.filter((i) => i.zone === 'chilled').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoneFilter('counter')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    zoneFilter === 'counter'
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  เคาน์เตอร์แห้ง ({ingredients.filter((i) => i.zone === 'counter').length})
                </button>
              </div>

              {/* Filter Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Favorites Toggle */}
                <button
                  type="button"
                  onClick={() => setOnlyFavorites(!onlyFavorites)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    onlyFavorites
                      ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-stone-950 text-stone-950' : 'fill-amber-400 text-amber-500'}`} />
                  <span>เฉพาะของที่หยิบบ่อย ({favoriteItems.length})</span>
                </button>

                {/* Low Stock Toggle */}
                <button
                  type="button"
                  onClick={() => setOnlyLowStock(!onlyLowStock)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    onlyLowStock
                      ? 'bg-red-500 text-white border-red-500 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-red-50'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>แสดงเฉพาะของที่ต้องเติม ({lowStockItems.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                    <th className="py-3 px-2.5 font-bold text-center w-10">⭐</th>
                    <th className="py-3 px-3.5 font-bold">ชื่อวัตถุดิบ</th>
                    <th className="py-3 px-3 font-bold">พื้นที่จัดเก็บ</th>
                    <th className="py-3 px-3 font-bold">สต็อกปัจจุบัน</th>
                    <th className="py-3 px-3 font-bold">จุดสั่งซื้อปกติ</th>
                    <th className="py-3 px-3 font-bold">จุดเตือนปรับตามจริง (Dynamic)</th>
                    <th className="py-3 px-3 font-bold">เป้าหมายสัปดาห์</th>
                    <th className="py-3 px-3 font-bold">กระแสพุ่ง (Spike)</th>
                    <th className="py-3 px-3.5 font-bold text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredIngredients.map((ing) => {
                    const threshold = ing.isSpike ? ing.dynamicMinStock : ing.minStock;
                    const isLow = ing.currentStock <= threshold;

                    return (
                      <tr
                        key={ing.id}
                        className={`transition-colors ${
                          isLow
                            ? 'bg-red-50/40 hover:bg-red-50/70'
                            : 'hover:bg-stone-50'
                        }`}
                      >
                        {/* Favorite Star Button */}
                        <td className="py-3 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleFavoriteIngredient(ing.id)}
                            title={ing.isFavorite ? 'นำออกจากของที่หยิบบ่อย' : 'ทำเครื่องหมายเป็นของที่หยิบบ่อย (Favorite)'}
                            className="p-1.5 rounded-lg hover:bg-amber-100 transition-transform active:scale-90 cursor-pointer"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                ing.isFavorite
                                  ? 'fill-amber-400 text-amber-500'
                                  : 'text-stone-300 hover:text-stone-400'
                              }`}
                            />
                          </button>
                        </td>

                        {/* Name & Low Stock Alert Badge */}
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                            <span>{ing.name}</span>
                            {ing.isFavorite && (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                <span>หยิบบ่อย</span>
                              </span>
                            )}
                            {ing.isSpike && (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Flame className="w-3 h-3 text-amber-600" />
                                <span>Spike</span>
                              </span>
                            )}
                          </div>
                          {isLow ? (
                            <div className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-0.5 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              <span>เหลือน้อยพอที่จะสั่งเพิ่ม! (ต่ำกว่า {threshold} {ing.unit})</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-stone-400">
                              อัปเดต: {new Date(ing.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>

                        {/* Storage Zone */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 w-fit ${
                              ing.zone === 'chilled'
                                ? 'bg-sky-100 text-sky-900'
                                : 'bg-stone-100 text-stone-800'
                            }`}
                          >
                            {ing.zone === 'chilled' ? (
                              <>
                                <Refrigerator className="w-3 h-3 text-sky-700" />
                                <span>ตู้เย็น/ถังน้ำแข็ง</span>
                              </>
                            ) : (
                              <span>เคาน์เตอร์แห้ง</span>
                            )}
                          </span>
                        </td>

                        {/* Current Stock */}
                        <td className="py-3 px-3">
                          <span
                            className={`font-extrabold text-sm ${
                              isLow ? 'text-red-700' : 'text-stone-900'
                            }`}
                          >
                            {ing.currentStock.toLocaleString()}
                          </span>{' '}
                          <span className="text-stone-500">{ing.unit}</span>
                        </td>

                        {/* Normal Min Stock */}
                        <td className="py-3 px-3 text-stone-600">
                          {ing.minStock.toLocaleString()} {ing.unit}
                        </td>

                        {/* Dynamic Min Stock */}
                        <td className="py-3 px-3">
                          <span
                            className={`font-bold ${
                              ing.isSpike
                                ? 'text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded'
                                : 'text-stone-500'
                            }`}
                          >
                            {ing.dynamicMinStock.toLocaleString()} {ing.unit}
                          </span>
                        </td>

                        {/* Target Weekly Stock */}
                        <td className="py-3 px-3 text-stone-600">
                          {ing.targetStock.toLocaleString()} {ing.unit}
                        </td>

                        {/* Spike Item Toggle */}
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => toggleSpikeItem(ing.id)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                              ing.isSpike
                                ? 'bg-amber-500 text-stone-950 shadow-xs'
                                : 'bg-stone-100 text-stone-600 hover:bg-amber-100 hover:text-amber-900'
                            }`}
                          >
                            <Flame className="w-3 h-3" />
                            <span>{ing.isSpike ? 'กระแสพุ่ง (ON)' : 'ปกติ (OFF)'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIngId(ing.id);
                              setShowStockInModal(true);
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg font-bold text-xs"
                          >
                            + เติมของ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: 1-CLICK WEEKLY REPLENISHMENT LIST (ปุ่มเดียวดูของที่ต้องเติมพร้อมจำนวน) */}
      {subView === 'replenishment' && (
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <h2 className="font-bold text-stone-900 text-base">
                  สรุปรายการสั่งซื้อวัตถุดิบประจำสัปดาห์ (One-Click Reorder Plan)
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                คำนวณจาก (เป้าหมายสต็อกรอบสัปดาห์ - สต็อกคงเหลือปัจจุบัน) รองรับรอบสั่งของ 1 ครั้งต่อสัปดาห์
              </p>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyGoogleSheetsData('replenishment')}
                className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>คัดลอกตาราง</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadCSV('replenishment')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>ดาวน์โหลดสำหรับ Google Sheets</span>
              </button>
            </div>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="py-10 text-center text-stone-400 text-xs">
              🎉 สต็อกทุกรายการยังมีปริมาณเพียงพอ ไม่แตะจุดสั่งซื้อในสัปดาห์นี้
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lowStockItems.map((ing) => {
                  const reorderQty = Math.max(0, ing.targetStock - ing.currentStock);
                  const estCost = Math.round(reorderQty * ing.costPerUnit);

                  return (
                    <div
                      key={ing.id}
                      className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                            <span>{ing.name}</span>
                            {ing.isSpike && (
                              <span className="bg-amber-200 text-amber-950 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                🔥 กระแสพุ่ง
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            พื้นที่: {ing.zone === 'chilled' ? 'ตู้เย็น / ถังน้ำแข็ง' : 'เคาน์เตอร์'} • สต็อกเหลือ {ing.currentStock} {ing.unit}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block">ต้องสั่งเติม</span>
                          <span className="font-black text-amber-900 text-base">
                            +{reorderQty.toLocaleString()} {ing.unit}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-amber-200/80 text-[11px]">
                        <span className="text-stone-600">
                          จุดเตือน: {ing.isSpike ? ing.dynamicMinStock : ing.minStock} {ing.unit} (เป้าหมาย {ing.targetStock} {ing.unit})
                        </span>
                        <span className="font-bold text-stone-900">
                          งบประมาณราว ฿{estCost.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Replenishment Budget */}
              <div className="bg-stone-900 text-white p-4 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-400 block">งบประมาณรวมที่ต้องสั่งของเข้าร้านสัปดาห์นี้</span>
                  <span className="font-bold text-sm text-stone-200">
                    จำนวน {lowStockItems.length} รายการวัตถุดิบ
                  </span>
                </div>
                <span className="text-xl font-black text-amber-400">
                  ฿
                  {lowStockItems
                    .reduce(
                      (sum, ing) =>
                        sum +
                        Math.max(0, ing.targetStock - ing.currentStock) * ing.costPerUnit,
                      0
                    )
                    .toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: BOM RECIPE MANAGEMENT (หมวดจัดการสูตร & เพิ่มเมนู) */}
      {subView === 'bom' && (
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div>
              <h2 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                <span>หมวดจัดการสูตรและเมนู (Recipe & BOM Management)</span>
              </h2>
              <p className="text-xs text-stone-500">
                กำหนดสูตรส่วนผสม (BOM) เพื่อให้ระบบตัดสต็อกและส่งแจ้งเตือนของหมดเข้า LINE อัตโนมัติ
              </p>
            </div>

            {/* Add New Recipe / Menu Button */}
            <button
              type="button"
              onClick={() => {
                setMenuToEdit(null);
                setShowAddMenuModal(true);
              }}
              className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ เพิ่มสูตรหรือเมนูใหม่</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {menuItems.map((menu) => (
              <div
                key={menu.id}
                className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3 text-xs hover:border-amber-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl p-1 bg-white rounded-xl shadow-xs border border-stone-100">
                      {menu.image}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-stone-900 text-sm">{menu.name}</span>
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-semibold px-1.5 py-0.2 rounded">
                          {menu.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-500 block">
                        ราคา ฿{menu.basePrice} • หวานเริ่มต้น {menu.defaultSweetness} • {menu.baseCalories || 160} kcal
                      </span>
                      <span className="text-[10px] text-emerald-700 font-medium">
                        {menu.allowIcedOrBlended ? '✓ ปั่นสด / เย็น' : '✓ ปั่นสดอย่างเดียว'}
                      </span>
                    </div>
                  </div>

                  {/* Edit / Delete Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuToEdit(menu);
                        setShowAddMenuModal(true);
                      }}
                      title="แก้ไขสูตรและราคา"
                      className="p-1.5 rounded-lg bg-white hover:bg-stone-200 text-stone-700 border border-stone-200 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {menuItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`คุณต้องการลบเมนู "${menu.name}" ใช่หรือไม่?`)) {
                            deleteMenuItem(menu.id);
                          }
                        }}
                        title="ลบเมนูนี้"
                        className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-stone-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {menu.description && (
                  <p className="text-[11px] text-stone-600 italic bg-white/60 p-2 rounded-xl">
                    "{menu.description}"
                  </p>
                )}

                <div className="space-y-1.5 pt-1">
                  <span className="font-bold text-stone-800 block text-[11px]">
                    สูตรส่วนผสม (BOM ต่อ 1 แก้ว):
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {menu.bom.map((b, bIdx) => {
                      const ing = ingredients.find((i) => i.id === b.ingredientId);
                      const isLow = ing ? ing.currentStock <= (ing.isSpike ? ing.dynamicMinStock : ing.minStock) : false;

                      return (
                        <div
                          key={bIdx}
                          className={`p-2 rounded-xl border text-[11px] flex justify-between items-center ${
                            isLow
                              ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                              : 'bg-white border-stone-200 text-stone-800'
                          }`}
                        >
                          <div className="truncate pr-1">
                            <span className="font-semibold block truncate">
                              {ing?.name || b.ingredientId}
                            </span>
                            {b.scalesWithSweetness && (
                              <span className="text-[9px] text-amber-700 block">
                                (ปรับตามหวาน)
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold whitespace-nowrap">
                            {b.baseAmount} {b.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: LINE ALERTS & OWNER INTEGRATION (เชื่อมต่อ LINE เจ้าของร้าน) */}
      {subView === 'line_alerts' && (
        <div className="space-y-4">
          {/* Connection Status Card */}
          <div className="bg-[#06C755]/10 border border-[#06C755]/30 rounded-3xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#06C755]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#06C755] text-white flex items-center justify-center font-black text-xl shadow-md">
                  LINE
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-stone-900 text-base">
                      การเชื่อมต่อการแจ้งเตือนเข้า LINE เจ้าของกิจการ
                    </h2>
                    {lineConfig.token ? (
                      <span className="bg-[#06C755] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        เชื่อมต่อแล้ว
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        ยังไม่ได้ตั้งค่า Token
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {lineConfig.token
                      ? `เชื่อมต่อกับ: ${lineConfig.channelName} • พร้อมส่งแจ้งเตือนของหมดและออเดอร์ใหม่`
                      : 'เชื่อมต่อฟรีผ่าน LINE Notify เข้าไลน์ส่วนตัวหรือกลุ่มร้านค้า'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLineSettingsModal(true)}
                  className="bg-[#06C755] hover:bg-[#05b34c] active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Settings className="w-4 h-4" />
                  <span>ตั้งค่าและเชื่อมต่อ LINE</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerManualLineAlert(
                      '🔔 ทดสอบส่งสัญญาณแจ้งเตือนเข้า LINE',
                      'ระบบแจ้งเตือนสต็อกร้านน้ำปั่น ม.อุบล ทำงานปกติทุกประการ!',
                      'low_stock'
                    );
                  }}
                  className="bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1"
                >
                  <Send className="w-3 h-3 text-[#06C755]" />
                  <span>ทดสอบส่ง</span>
                </button>
              </div>
            </div>

            {/* Quick Summary of Active Notifications */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-[11px]">
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/60">
                <span className="text-stone-500 block">ของใกล้หมด (Low Stock)</span>
                <span className={`font-bold ${lineConfig.notifyLowStock ? 'text-[#06C755]' : 'text-stone-400'}`}>
                  {lineConfig.notifyLowStock ? '✓ เปิดเตือน' : '✕ ปิด'}
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/60">
                <span className="text-stone-500 block">ของหมดเกลี้ยง (Out of Stock)</span>
                <span className={`font-bold ${lineConfig.notifyOutOfStock ? 'text-[#06C755]' : 'text-stone-400'}`}>
                  {lineConfig.notifyOutOfStock ? '✓ เปิดเตือน' : '✕ ปิด'}
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/60">
                <span className="text-stone-500 block">ยอดขายพุ่ง (Spike Item)</span>
                <span className={`font-bold ${lineConfig.notifySpike ? 'text-[#06C755]' : 'text-stone-400'}`}>
                  {lineConfig.notifySpike ? '✓ เปิดเตือน' : '✕ ปิด'}
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/60">
                <span className="text-stone-500 block">ออเดอร์ใหม่ (New Order)</span>
                <span className={`font-bold ${lineConfig.notifyNewOrder ? 'text-[#06C755]' : 'text-stone-400'}`}>
                  {lineConfig.notifyNewOrder ? '✓ เปิดเตือน' : '✕ ปิด'}
                </span>
              </div>
            </div>
          </div>

          {/* Alert Stream Log */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm">
                ประวัติการส่งสัญญาณแจ้งเตือน ({lineAlerts.length} ข้อความ)
              </h3>
              {lineAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={clearAlerts}
                  className="text-xs text-stone-500 hover:text-stone-800"
                >
                  ล้างประวัติ
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lineAlerts.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  ไม่มีข้อความแจ้งเตือนใหม่ในขณะนี้
                </div>
              ) : (
                lineAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-2xl border shadow-xs flex items-start justify-between gap-3 text-xs ${
                      alert.urgent
                        ? 'bg-rose-50/50 border-rose-200'
                        : 'bg-stone-50/70 border-stone-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{alert.title}</span>
                        <span className="text-[10px] text-stone-400 font-mono">{alert.timestamp}</span>
                        {alert.urgent && (
                          <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                            ด่วน
                          </span>
                        )}
                      </div>
                      <p className="text-stone-700 leading-relaxed text-[11px]">{alert.message}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => dismissAlert(alert.id)}
                      className="text-stone-400 hover:text-stone-600 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: SALES ANALYTICS (วิเคราะห์ยอดขาย: ยอดวัน, สัปดาห์, เดือน) */}
      {subView === 'analytics' && (
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm space-y-5">
          {/* Header & Timeframe Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-600" />
                <h2 className="font-bold text-stone-900 text-base">
                  รายงานวิเคราะห์ยอดขายและช่องทาง
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                เลือกช่วงเวลาที่ต้องการดู: ยอดรายวัน (Today), ยอดรายสัปดาห์ (7 วัน), ยอดรายเดือน (30 วัน)
              </p>
            </div>

            {/* Timeframe Selector Tabs */}
            <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setAnalyticsPeriod('day')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  analyticsPeriod === 'day'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                📅 ยอดวันนี้ (Day)
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsPeriod('week')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  analyticsPeriod === 'week'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                📆 ยอดสัปดาห์ (7 วัน)
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsPeriod('month')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  analyticsPeriod === 'month'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                🗓️ ยอดเดือน (30 วัน)
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsPeriod('all')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  analyticsPeriod === 'all'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                ทั้งหมด (All)
              </button>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-sm text-xs space-y-1">
              <span className="text-stone-400 block font-medium">
                ยอดขายรวม (
                {analyticsPeriod === 'day'
                  ? 'วันนี้'
                  : analyticsPeriod === 'week'
                  ? '7 วัน'
                  : analyticsPeriod === 'month'
                  ? '30 วัน'
                  : 'ทั้งหมด'}
                )
              </span>
              <span className="text-2xl font-black text-amber-400 block">
                ฿{analyticsData.totalRevenue.toLocaleString()}
              </span>
              <span className="text-[11px] text-stone-300 block">
                รวม {analyticsData.orderCount} ออเดอร์ ({analyticsData.totalCups} แก้ว)
              </span>
            </div>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-xs space-y-1">
              <span className="text-emerald-800 block font-semibold">
                ยอดขายหน้าร้าน (Counter POS)
              </span>
              <span className="text-2xl font-black text-emerald-950 block">
                ฿{analyticsData.counterRevenue.toLocaleString()}
              </span>
              <span className="text-[11px] text-emerald-700 block">
                สัดส่วน{' '}
                {analyticsData.totalRevenue > 0
                  ? Math.round((analyticsData.counterRevenue / analyticsData.totalRevenue) * 100)
                  : 0}
                % ของยอดขาย
              </span>
            </div>

            <div className="bg-sky-50 p-4 rounded-2xl border border-sky-200 text-xs space-y-1">
              <span className="text-sky-800 block font-semibold">
                ยอดเดลิเวอรี่ (Delivery ม.อุบล)
              </span>
              <span className="text-2xl font-black text-sky-950 block">
                ฿{analyticsData.deliveryRevenue.toLocaleString()}
              </span>
              <span className="text-[11px] text-sky-700 block">
                สัดส่วน{' '}
                {analyticsData.totalRevenue > 0
                  ? Math.round((analyticsData.deliveryRevenue / analyticsData.totalRevenue) * 100)
                  : 0}
                % ของยอดขาย
              </span>
            </div>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs space-y-1">
              <span className="text-amber-800 block font-semibold">
                ยอดเฉลี่ยต่อบิล (Ticket Size)
              </span>
              <span className="text-2xl font-black text-amber-950 block">
                ฿{analyticsData.averageTicket.toLocaleString()}
              </span>
              <span className="text-[11px] text-amber-700 block">
                เฉลี่ย{' '}
                {analyticsData.orderCount > 0
                  ? (analyticsData.totalCups / analyticsData.orderCount).toFixed(1)
                  : 0}{' '}
                แก้ว / บิล
              </span>
            </div>
          </div>

          {/* Top Selling Smoothies & Menus for selected period */}
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
            <h3 className="font-bold text-stone-900 text-xs flex items-center gap-2">
              <Coffee className="w-4 h-4 text-amber-600" />
              <span>
                เมนูขายดีประจำช่วงเวลา (
                {analyticsPeriod === 'day'
                  ? 'วันนี้'
                  : analyticsPeriod === 'week'
                  ? 'สัปดาห์นี้'
                  : analyticsPeriod === 'month'
                  ? 'เดือนนี้'
                  : 'ทั้งหมด'}
                )
              </span>
            </h3>

            {analyticsData.topMenus.length === 0 ? (
              <p className="text-center py-6 text-stone-400 text-xs">
                ยังไม่มีรายการขายในช่วงเวลานี้
              </p>
            ) : (
              <div className="space-y-2">
                {analyticsData.topMenus.map((m, idx) => {
                  const maxCount = analyticsData.topMenus[0]?.count || 1;
                  const percent = Math.round((m.count / maxCount) * 100);

                  return (
                    <div
                      key={m.name}
                      className="bg-white p-3 rounded-xl border border-stone-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-[140px]">
                        <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center font-bold text-[11px] text-stone-600">
                          #{idx + 1}
                        </span>
                        <span className="text-xl">{m.image}</span>
                        <div>
                          <span className="font-bold text-stone-900 block">{m.name}</span>
                          <span className="text-[10px] text-stone-500 font-mono">
                            ฿{m.revenue.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Bar graph */}
                      <div className="flex-1 max-w-xs hidden sm:block">
                        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap">
                        <span className="font-black text-amber-900 text-sm">{m.count}</span>
                        <span className="text-[10px] text-stone-500 ml-1">แก้ว</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Order Log for Period */}
          <div className="space-y-2 pt-2">
            <h3 className="font-bold text-stone-900 text-xs">
              รายการออเดอร์ในช่วงเวลานี้ ({analyticsData.filteredOrders.length} รายการ)
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {analyticsData.filteredOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-stone-900">{ord.orderNumber}</span>
                    <span className="text-[10px] bg-stone-200 px-1.5 py-0.2 rounded font-semibold">
                      {ord.channel === 'counter' ? 'หน้าร้าน' : 'เดลิเวอรี่'}
                    </span>
                    <span className="text-[11px] text-stone-600 truncate max-w-[200px]">
                      {ord.items.map((i) => `${i.menuItemName} x${i.quantity}`).join(', ')}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-stone-900">฿{ord.totalAmount}</span>
                    <span className="text-[10px] text-stone-400 block font-mono">
                      {new Date(ord.createdAt).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 6: MONTHLY REPORT & GOOGLE SHEETS */}
      {subView === 'monthly_report' && (
        <MonthlyReportModal isEmbedded={true} />
      )}

      {/* STOCK-IN RECORD MODAL (บันทึกตอนของเข้าร้าน) */}
      {showStockInModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleStockInSubmit}
            className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3.5 animate-in zoom-in-95 text-xs"
          >
            <div className="flex justify-between items-center pb-2 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>บันทึกของเข้าร้าน (Stock Receiving)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowStockInModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">เลือกวัตถุดิบ *</label>
              <select
                value={selectedIngId}
                onChange={(e) => setSelectedIngId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
              >
                {ingredients.some((i) => i.isFavorite) && (
                  <optgroup label="⭐ รายการโปรด / ของที่หยิบบ่อย">
                    {ingredients
                      .filter((i) => i.isFavorite)
                      .map((ing) => (
                        <option key={`fav-${ing.id}`} value={ing.id}>
                          ⭐ {ing.name} (คงเหลือ: {ing.currentStock.toLocaleString()} {ing.unit})
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="📦 วัตถุดิบทั้งหมด">
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.isFavorite ? '⭐ ' : ''}{ing.name} (คงเหลือ: {ing.currentStock.toLocaleString()} {ing.unit})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                จำนวนที่รับเข้า (กรัม / มล. / ชิ้น) *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="เช่น 1000, 2500, 50"
                value={stockInAmount}
                onChange={(e) => setStockInAmount(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">ซัพพลายเออร์ / ร้านที่ซื้อ</label>
              <input
                type="text"
                value={stockInSupplier}
                onChange={(e) => setStockInSupplier(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">หมายเหตุเพิ่มเติม</label>
              <input
                type="text"
                placeholder="เช่น ล็อตใหม่, ผลไม้จากสวนอุบล..."
                value={stockInNotes}
                onChange={(e) => setStockInNotes(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStockInModal(false)}
                className="py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
              >
                บันทึกเข้าสต็อก
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD / EDIT RECIPE & MENU MODAL */}
      <AddMenuRecipeModal
        isOpen={showAddMenuModal}
        onClose={() => {
          setShowAddMenuModal(false);
          setMenuToEdit(null);
        }}
        menuToEdit={menuToEdit}
      />

      {/* LINE CONNECTION SETTINGS MODAL */}
      <LineSettingsModal
        isOpen={showLineSettingsModal}
        onClose={() => setShowLineSettingsModal(false)}
      />
    </div>
  );
};
