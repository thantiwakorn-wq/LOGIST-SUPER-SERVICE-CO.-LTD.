import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Ingredient, StorageZone } from '../types';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Star,
  Search,
  Plus,
  TrendingUp,
  Refrigerator,
  Sparkles,
  BarChart3,
  DollarSign,
  Layers,
  ArrowUpDown,
  Filter,
  Check,
  Zap,
} from 'lucide-react';

interface StockDashboardProps {
  onOpenStockIn: (ingredientId?: string) => void;
  onGoToReplenishment?: () => void;
  onGoToABCSlotting?: () => void;
}

export const StockDashboard: React.FC<StockDashboardProps> = ({
  onOpenStockIn,
  onGoToReplenishment,
  onGoToABCSlotting,
}) => {
  const {
    ingredients,
    toggleFavoriteIngredient,
    updateIngredientStock,
    toggleSpikeItem,
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'favorite' | 'critical' | 'warning' | 'healthy'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | Ingredient['category']>('all');
  const [zoneFilter, setZoneFilter] = useState<'all' | StorageZone>('all');
  const [sortBy, setSortBy] = useState<'percent_asc' | 'percent_desc' | 'name' | 'value_desc'>('percent_asc');
  const [chartTab, setChartTab] = useState<'all' | 'categories' | 'zones'>('all');

  // Inline quick adjustment feedback
  const [adjustedId, setAdjustedId] = useState<string | null>(null);

  // Quick adjust helper
  const handleQuickAdjust = (ing: Ingredient, delta: number) => {
    const nextVal = Math.max(0, ing.currentStock + delta);
    updateIngredientStock(ing.id, nextVal);
    setAdjustedId(ing.id);
    setTimeout(() => setAdjustedId(null), 1200);
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalItems = ingredients.length;
    let criticalCount = 0; // <= minStock
    let warningCount = 0;  // > minStock && <= minStock * 1.5
    let healthyCount = 0;  // > minStock * 1.5
    let favoriteCount = 0;
    let totalValue = 0;
    let spikeCount = 0;

    ingredients.forEach((ing) => {
      const threshold = ing.isSpike ? ing.dynamicMinStock : ing.minStock;
      if (ing.currentStock <= threshold) {
        criticalCount++;
      } else if (ing.currentStock <= threshold * 1.5) {
        warningCount++;
      } else {
        healthyCount++;
      }

      if (ing.isFavorite) favoriteCount++;
      if (ing.isSpike) spikeCount++;
      totalValue += ing.currentStock * ing.costPerUnit;
    });

    return {
      totalItems,
      criticalCount,
      warningCount,
      healthyCount,
      favoriteCount,
      totalValue: Math.round(totalValue),
      spikeCount,
    };
  }, [ingredients]);

  // Category Aggregates for Chart
  const categoryStats = useMemo(() => {
    const categories: Record<
      Ingredient['category'],
      { name: string; icon: string; count: number; currentStockSum: number; targetStockSum: number; lowCount: number; value: number }
    > = {
      fruit: { name: 'ผลไม้สด / แช่แข็ง', icon: '🍓', count: 0, currentStockSum: 0, targetStockSum: 0, lowCount: 0, value: 0 },
      dairy: { name: 'นมสด & โยเกิร์ต', icon: '🥛', count: 0, currentStockSum: 0, targetStockSum: 0, lowCount: 0, value: 0 },
      sweetener: { name: 'ไซรัป & ผงชา/โกโก้', icon: '🍯', count: 0, currentStockSum: 0, targetStockSum: 0, lowCount: 0, value: 0 },
      topping: { name: 'ท็อปปิ้ง & ของแต่งหน้า', icon: '🍮', count: 0, currentStockSum: 0, targetStockSum: 0, lowCount: 0, value: 0 },
      packaging: { name: 'แก้ว หลอด & กล่อง', icon: '🥤', count: 0, currentStockSum: 0, targetStockSum: 0, lowCount: 0, value: 0 },
    };

    ingredients.forEach((ing) => {
      const cat = categories[ing.category] || categories.sweetener;
      cat.count++;
      cat.currentStockSum += ing.currentStock;
      cat.targetStockSum += ing.targetStock;
      cat.value += ing.currentStock * ing.costPerUnit;
      const threshold = ing.isSpike ? ing.dynamicMinStock : ing.minStock;
      if (ing.currentStock <= threshold) {
        cat.lowCount++;
      }
    });

    return Object.entries(categories).map(([key, data]) => {
      const percent = data.targetStockSum > 0 ? Math.min(100, Math.round((data.currentStockSum / data.targetStockSum) * 100)) : 0;
      return {
        key: key as Ingredient['category'],
        ...data,
        percent,
      };
    });
  }, [ingredients]);

  // Storage Zone Aggregates for Chart
  const zoneStats = useMemo(() => {
    const chilled = ingredients.filter((i) => i.zone === 'chilled');
    const counter = ingredients.filter((i) => i.zone === 'counter');

    const calculateStats = (items: Ingredient[]) => {
      const count = items.length;
      const lowCount = items.filter(
        (i) => i.currentStock <= (i.isSpike ? i.dynamicMinStock : i.minStock)
      ).length;
      const value = Math.round(items.reduce((s, i) => s + i.currentStock * i.costPerUnit, 0));
      const totalPct =
        items.reduce((acc, i) => acc + (i.targetStock > 0 ? Math.min(100, (i.currentStock / i.targetStock) * 100) : 0), 0) /
        (count || 1);
      return { count, lowCount, value, avgPercent: Math.round(totalPct) };
    };

    return {
      chilled: calculateStats(chilled),
      counter: calculateStats(counter),
    };
  }, [ingredients]);

  // Filtered & Sorted Ingredients
  const processedIngredients = useMemo(() => {
    return ingredients
      .filter((ing) => {
        // Search
        const matchSearch =
          !searchQuery ||
          ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ing.id.toLowerCase().includes(searchQuery.toLowerCase());

        // Status Filter
        const threshold = ing.isSpike ? ing.dynamicMinStock : ing.minStock;
        let matchStatus = true;
        if (statusFilter === 'favorite') matchStatus = !!ing.isFavorite;
        else if (statusFilter === 'critical') matchStatus = ing.currentStock <= threshold;
        else if (statusFilter === 'warning') matchStatus = ing.currentStock > threshold && ing.currentStock <= threshold * 1.5;
        else if (statusFilter === 'healthy') matchStatus = ing.currentStock > threshold * 1.5;

        // Category Filter
        const matchCategory = categoryFilter === 'all' || ing.category === categoryFilter;

        // Zone Filter
        const matchZone = zoneFilter === 'all' || ing.zone === zoneFilter;

        return matchSearch && matchStatus && matchCategory && matchZone;
      })
      .sort((a, b) => {
        const pctA = a.targetStock > 0 ? (a.currentStock / a.targetStock) * 100 : 0;
        const pctB = b.targetStock > 0 ? (b.currentStock / b.targetStock) * 100 : 0;

        if (sortBy === 'percent_asc') return pctA - pctB;
        if (sortBy === 'percent_desc') return pctB - pctA;
        if (sortBy === 'name') return a.name.localeCompare(b.name, 'th');
        if (sortBy === 'value_desc') return b.currentStock * b.costPerUnit - a.currentStock * a.costPerUnit;
        return 0;
      });
  }, [ingredients, searchQuery, statusFilter, categoryFilter, zoneFilter, sortBy]);

  // Favorite ingredients list
  const favoriteIngredients = useMemo(() => {
    return ingredients.filter((i) => i.isFavorite);
  }, [ingredients]);

  return (
    <div className="space-y-4">
      {/* 1. Header Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Total Items */}
        <div
          onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setZoneFilter('all'); }}
          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'all' && categoryFilter === 'all' && zoneFilter === 'all'
              ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-stone-900/20'
              : 'bg-white text-stone-800 border-stone-200 hover:border-stone-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>วัตถุดิบทั้งหมด</span>
            <Package className="w-4 h-4 opacity-70" />
          </div>
          <div className="text-2xl font-black mt-1">{metrics.totalItems}</div>
          <div className="text-[10px] opacity-75 mt-0.5">ครบทุกหมวดหมู่</div>
        </div>

        {/* Critical Low Stock */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'critical'
              ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-500/20'
              : 'bg-red-50/80 text-red-900 border-red-200 hover:border-red-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span>🚨 ต้องเติมด่วน</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black mt-1 text-red-600">
            {metrics.criticalCount}
          </div>
          <div className="text-[10px] text-red-700 font-medium mt-0.5">
            ต่ำกว่าจุดปลอดภัย
          </div>
        </div>

        {/* Warning Stock */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'warning' ? 'all' : 'warning')}
          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'warning'
              ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-400/20'
              : 'bg-amber-50/80 text-amber-900 border-amber-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span>⚠️ ใกล้จุดสั่ง</span>
            <span className="text-xs">⚡</span>
          </div>
          <div className="text-2xl font-black mt-1 text-amber-600">
            {metrics.warningCount}
          </div>
          <div className="text-[10px] text-amber-800 font-medium mt-0.5">
            เตรียมสั่งซื้อเพิ่ม
          </div>
        </div>

        {/* Healthy Stock */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'healthy' ? 'all' : 'healthy')}
          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'healthy'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-emerald-50/80 text-emerald-900 border-emerald-200 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span>🟢 สต็อกพร้อม</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black mt-1 text-emerald-700">
            {metrics.healthyCount}
          </div>
          <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
            ปลอดภัยขายดี
          </div>
        </div>

        {/* Favorites / Frequently Picked */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'favorite' ? 'all' : 'favorite')}
          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'favorite'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
              : 'bg-amber-50 text-amber-950 border-amber-300 hover:border-amber-500'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span>⭐ หยิบบ่อย/โปรด</span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
          </div>
          <div className="text-2xl font-black mt-1 text-amber-700">
            {metrics.favoriteCount}
          </div>
          <div className="text-[10px] text-amber-800 font-medium mt-0.5">
            คลิกเพื่อดูเฉพาะโปรด
          </div>
        </div>

        {/* Inventory Value */}
        <div className="p-3 rounded-2xl border bg-white text-stone-800 border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
            <span>มูลค่าสต็อกรวม</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black mt-1 text-emerald-700">
            ฿{metrics.totalValue.toLocaleString()}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            ประเมินตามต้นทุน
          </div>
        </div>
      </div>

      {/* 2. Spotlight: Frequently Picked Items Bar ("⭐ ของที่เราหยิบบ่อยๆ") */}
      {favoriteIngredients.length > 0 && (
        <div className="bg-linear-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 p-3.5 rounded-3xl border border-amber-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-400 text-stone-900 flex items-center justify-center font-bold text-xs shadow-xs">
                ⭐
              </div>
              <h2 className="font-bold text-xs sm:text-sm text-stone-900">
                ของที่หยิบบ่อย / รายการโปรดประจำร้าน ({favoriteIngredients.length} รายการ)
              </h2>
              <span className="text-[10px] text-amber-800 font-medium hidden sm:inline">
                • ติดดาวเพื่อให้หยิบใช้ เช็คยอด และสั่งเติมได้ง่ายใน 1 วินาที
              </span>
            </div>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'favorite' ? 'all' : 'favorite')}
              className="text-[11px] font-bold text-amber-900 hover:text-amber-700 bg-amber-200/70 hover:bg-amber-200 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1"
            >
              <span>{statusFilter === 'favorite' ? 'แสดงทั้งหมด' : 'กรองดูเฉพาะกลุ่มนี้'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {favoriteIngredients.map((fav) => {
              const threshold = fav.isSpike ? fav.dynamicMinStock : fav.minStock;
              const isLow = fav.currentStock <= threshold;
              const fillPct = fav.targetStock > 0 ? Math.min(100, Math.round((fav.currentStock / fav.targetStock) * 100)) : 0;

              return (
                <div
                  key={`fav-pill-${fav.id}`}
                  className={`p-2.5 rounded-2xl border transition-all relative ${
                    isLow
                      ? 'bg-red-50/90 border-red-300 shadow-xs ring-1 ring-red-400'
                      : 'bg-white/95 border-amber-200 shadow-xs hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="font-bold text-xs text-stone-900 truncate" title={fav.name}>
                      {fav.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFavoriteIngredient(fav.id)}
                      title="ยกเลิกรายการโปรด"
                      className="text-amber-500 hover:text-stone-400 transition-colors p-0.5"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    </button>
                  </div>

                  <div className="mt-1 flex items-baseline justify-between">
                    <span className={`font-black text-xs sm:text-sm ${isLow ? 'text-red-700' : 'text-stone-900'}`}>
                      {fav.currentStock.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-stone-500">{fav.unit}</span>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full bg-stone-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow ? 'bg-red-500' : fillPct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(4, fillPct)}%` }}
                    />
                  </div>

                  {/* Quick Stock-In Button */}
                  <div className="mt-2 flex items-center justify-between text-[10px] pt-1 border-t border-stone-100">
                    <span className={`font-semibold ${isLow ? 'text-red-600 font-bold' : 'text-stone-500'}`}>
                      {isLow ? '🚨 ต้องเติม' : `${fillPct}%`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenStockIn(fav.id)}
                      className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>เติม</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2.5 Quick Link: ABC Analysis & Pick Distance Optimization Banner */}
      {onGoToABCSlotting && (
        <div className="bg-stone-900 text-stone-100 p-4 sm:p-5 rounded-3xl border border-stone-800 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shrink-0 shadow-xs">
              <Zap className="w-5 h-5 fill-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  วิเคราะห์ความถี่การหยิบ ABC & ลดระยะทางหยิบสินค้า
                </h3>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30">
                  Ergonomics
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5 max-w-2xl">
                ลดก้าวเดินที่ไม่จำเป็นในบาร์น้ำปั่น จัดกลุ่ม A (หยิบบ่อย 80%) ให้อยู่ในระยะเอื้อมมือ (Golden Zone 0 ก้าว) หน้าโถปั่น
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToABCSlotting}
            className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black shrink-0 flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <span>⚡ เปิดผังวิเคราะห์ ABC & ผังบาร์</span>
          </button>
        </div>
      )}

      {/* 3. Visual Charts & Category Analytics Section */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold text-xs">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-stone-900">
                กราฟแสดงสุขภาพสต็อกแยกตามหมวดหมู่ & พื้นที่จัดเก็บ
              </h2>
              <p className="text-[11px] text-stone-500">
                เปรียบเทียบระดับความพร้อมของสินค้ากับเป้าหมายรอบสัปดาห์ (100% คือพร้อมสูงสุด)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChartTab('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                chartTab === 'all' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              ภาพรวมทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setChartTab('categories')}
              className={`px-3 py-1 rounded-lg transition-all ${
                chartTab === 'categories' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              แยกหมวดวัตถุดิบ
            </button>
            <button
              type="button"
              onClick={() => setChartTab('zones')}
              className={`px-3 py-1 rounded-lg transition-all ${
                chartTab === 'zones' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              แยกพื้นที่จัดเก็บ
            </button>
          </div>
        </div>

        {/* Charts Body */}
        {(chartTab === 'all' || chartTab === 'categories') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-stone-700">
              <span>ระดับความพร้อมของสต็อกแยกหมวดหมู่ (% เทียบเป้าหมายสัปดาห์)</span>
              <span className="text-[11px] text-stone-400">คลิกที่หมวดหมู่เพื่อกรองดูสินค้า</span>
            </div>

            <div className="space-y-2.5">
              {categoryStats.map((cat) => {
                const isSelected = categoryFilter === cat.key;
                return (
                  <div
                    key={`cat-stat-${cat.key}`}
                    onClick={() => setCategoryFilter(isSelected ? 'all' : cat.key)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300/40 shadow-xs'
                        : 'bg-stone-50/70 border-stone-200 hover:bg-stone-100/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cat.icon}</span>
                        <span className="font-bold text-stone-900">{cat.name}</span>
                        <span className="text-stone-400 text-[11px]">({cat.count} รายการ)</span>
                        {cat.lowCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>เตือน {cat.lowCount} รายการ</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-stone-600 text-xs">
                        <span>มูลค่ารวม: <strong className="text-stone-900">฿{Math.round(cat.value).toLocaleString()}</strong></span>
                        <span className="font-black text-stone-900 text-sm">{cat.percent}%</span>
                      </div>
                    </div>

                    {/* Visual Bar Graph */}
                    <div className="w-full bg-stone-200 rounded-full h-3 mt-2 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          cat.percent < 30
                            ? 'bg-linear-to-r from-red-500 to-rose-600'
                            : cat.percent < 60
                            ? 'bg-linear-to-r from-amber-500 to-yellow-500'
                            : 'bg-linear-to-r from-emerald-500 to-teal-500'
                        }`}
                        style={{ width: `${Math.max(3, cat.percent)}%` }}
                      />
                      {/* 50% target reference marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-stone-400/70 pointer-events-none"
                        style={{ left: '50%' }}
                        title="เส้นอ้างอิงกึ่งกลาง 50%"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Zone Comparison Cards */}
        {(chartTab === 'all' || chartTab === 'zones') && (
          <div className="pt-2 border-t border-stone-100">
            <div className="text-xs font-bold text-stone-700 mb-2">
              สัดส่วนการจัดเก็บ: ตู้เย็น/ถังน้ำแข็ง vs เคาน์เตอร์แห้ง
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Chilled */}
              <div
                onClick={() => setZoneFilter(zoneFilter === 'chilled' ? 'all' : 'chilled')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  zoneFilter === 'chilled'
                    ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-300/40 shadow-xs'
                    : 'bg-sky-50/40 border-sky-200 hover:bg-sky-50/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                      <Refrigerator className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-sky-950">โซนแช่เย็น / ถังน้ำแข็ง</div>
                      <div className="text-[10px] text-sky-700">ผลไม้สด, นมสด, เพียวเร่, วิปครีม</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-sky-900">{zoneStats.chilled.avgPercent}%</div>
                    <div className="text-[10px] text-sky-600">ความพร้อมเฉลี่ย</div>
                  </div>
                </div>

                <div className="w-full bg-sky-200/60 rounded-full h-2.5 mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-sky-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, zoneStats.chilled.avgPercent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-sky-800 font-medium mt-2 pt-1 border-t border-sky-200/60">
                  <span>{zoneStats.chilled.count} รายการ • มูลค่า ฿{zoneStats.chilled.value.toLocaleString()}</span>
                  {zoneStats.chilled.lowCount > 0 && (
                    <span className="text-red-600 font-bold">เตือน {zoneStats.chilled.lowCount} รายการ</span>
                  )}
                </div>
              </div>

              {/* Dry Counter */}
              <div
                onClick={() => setZoneFilter(zoneFilter === 'counter' ? 'all' : 'counter')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  zoneFilter === 'counter'
                    ? 'bg-stone-100 border-stone-400 ring-2 ring-stone-300/40 shadow-xs'
                    : 'bg-stone-50 border-stone-200 hover:bg-stone-100/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-stone-200 text-stone-700 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-stone-900">เคาน์เตอร์แห้ง / คลังทั่วไป</div>
                      <div className="text-[10px] text-stone-500">แก้ว, หลอด, ผงชา, ไซรัป, ขนมปัง</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-stone-900">{zoneStats.counter.avgPercent}%</div>
                    <div className="text-[10px] text-stone-500">ความพร้อมเฉลี่ย</div>
                  </div>
                </div>

                <div className="w-full bg-stone-200 rounded-full h-2.5 mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-stone-700 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, zoneStats.counter.avgPercent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-700 font-medium mt-2 pt-1 border-t border-stone-200">
                  <span>{zoneStats.counter.count} รายการ • มูลค่า ฿{zoneStats.counter.value.toLocaleString()}</span>
                  {zoneStats.counter.lowCount > 0 && (
                    <span className="text-red-600 font-bold">เตือน {zoneStats.counter.lowCount} รายการ</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Controls & Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        {/* Search & Sort Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาวัตถุดิบ (เช่น มะพร้าว, นมสด, แก้ว, นมหมี)..."
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

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end text-xs">
            {/* Sort Select */}
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-2.5 py-1.5 rounded-xl">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-500" />
              <span className="text-stone-500 text-[11px]">เรียง:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent font-bold text-stone-800 text-xs focus:outline-none cursor-pointer"
              >
                <option value="percent_asc">สต็อกเหลือน้อยสุด (% ต่ำสุดก่อน)</option>
                <option value="percent_desc">สต็อกเหลือมากสุด (% เต็มก่อน)</option>
                <option value="name">ชื่อวัตถุดิบ (ก-ฮ)</option>
                <option value="value_desc">มูลค่าสต็อกสูงสุด (฿)</option>
              </select>
            </div>

            {/* Quick stock in button */}
            <button
              type="button"
              onClick={() => onOpenStockIn()}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึกของเข้า</span>
            </button>
          </div>
        </div>

        {/* Filter Badges Strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1 border-t border-stone-100">
          <span className="text-[11px] text-stone-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>กรอง:</span>
          </span>

          {/* Status Pills */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-stone-900 text-white font-bold shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            ทั้งหมด ({ingredients.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('favorite')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
              statusFilter === 'favorite'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
            <span>⭐ หยิบบ่อย/โปรด ({metrics.favoriteCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('critical')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
              statusFilter === 'critical'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>🚨 ต้องเติมด่วน ({metrics.criticalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('warning')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              statusFilter === 'warning'
                ? 'bg-amber-500 text-white font-bold shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            ⚠️ ใกล้จุดสั่ง ({metrics.warningCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('healthy')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              statusFilter === 'healthy'
                ? 'bg-emerald-700 text-white font-bold shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            🟢 พร้อมขาย ({metrics.healthyCount})
          </button>

          {/* Reset Filters button if active */}
          {(statusFilter !== 'all' || categoryFilter !== 'all' || zoneFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setZoneFilter('all');
                setSearchQuery('');
              }}
              className="ml-auto text-[11px] text-red-600 hover:underline font-bold"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
      </div>

      {/* 5. Visual Stock Gauges Grid (Main Display) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-stone-600 px-1">
          <span>
            แสดงผลกราฟระดับสต็อก ({processedIngredients.length} รายการ)
          </span>
          <span className="text-[11px] text-stone-400">
            แถบสี: 🔴 ต่ำกว่าจุดปลอดภัย | 🟡 ใกล้หมด | 🟢 สต็อกพร้อม
          </span>
        </div>

        {processedIngredients.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-stone-200 text-center space-y-2">
            <div className="text-3xl">🔍</div>
            <div className="font-bold text-sm text-stone-800">ไม่พบวัตถุดิบตามเงื่อนไขที่เลือก</div>
            <p className="text-xs text-stone-500">
              ลองพิมพ์คำค้นหาอื่น หรือกดปุ่ม "ล้างตัวกรองทั้งหมด" ด้านบน
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setZoneFilter('all');
                setSearchQuery('');
              }}
              className="bg-stone-900 text-white text-xs font-bold px-4 py-2 rounded-xl mt-2 hover:bg-stone-800 transition-all"
            >
              แสดงวัตถุดิบทั้งหมด
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {processedIngredients.map((ing) => {
              const threshold = ing.isSpike ? ing.dynamicMinStock : ing.minStock;
              const isLow = ing.currentStock <= threshold;
              const isWarning = ing.currentStock > threshold && ing.currentStock <= threshold * 1.5;
              const fillPct = ing.targetStock > 0 ? Math.min(100, Math.round((ing.currentStock / ing.targetStock) * 100)) : 0;
              const thresholdPct = ing.targetStock > 0 ? Math.min(100, Math.round((threshold / ing.targetStock) * 100)) : 20;

              return (
                <div
                  key={`gauge-card-${ing.id}`}
                  className={`bg-white p-4 rounded-3xl border transition-all relative overflow-hidden ${
                    isLow
                      ? 'border-red-300 shadow-xs ring-1 ring-red-200 bg-red-50/10'
                      : 'border-stone-200 shadow-xs hover:border-stone-300'
                  }`}
                >
                  {/* Top Header: Name, Star, Zone & Spike Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-stone-900 leading-tight">
                          {ing.name}
                        </span>

                        {/* Spike Badge */}
                        {ing.isSpike && (
                          <span
                            onClick={() => toggleSpikeItem(ing.id)}
                            title="สินค้ากระแสพุ่ง (Safety stock คูณ 2) คลิกเพื่อเปิด/ปิด"
                            className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 cursor-pointer hover:bg-amber-200 transition-all"
                          >
                            <Flame className="w-3 h-3 text-amber-600" />
                            <span>Spike</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {/* Storage Zone Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 ${
                            ing.zone === 'chilled'
                              ? 'bg-sky-100 text-sky-900'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {ing.zone === 'chilled' ? (
                            <>
                              <Refrigerator className="w-2.5 h-2.5 text-sky-600" />
                              <span>แช่เย็น/ถังน้ำแข็ง</span>
                            </>
                          ) : (
                            <span>เคาน์เตอร์แห้ง</span>
                          )}
                        </span>

                        {/* Category Badge */}
                        <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md">
                          {ing.category === 'fruit' && '🍓 ผลไม้'}
                          {ing.category === 'dairy' && '🥛 นม/โยเกิร์ต'}
                          {ing.category === 'sweetener' && '🍯 ชา/ไซรัป'}
                          {ing.category === 'topping' && '🍮 ท็อปปิ้ง'}
                          {ing.category === 'packaging' && '🥤 บรรจุภัณฑ์'}
                        </span>
                      </div>
                    </div>

                    {/* Star / Favorite Toggle Button (Prominent & Easy to Click) */}
                    <button
                      type="button"
                      onClick={() => toggleFavoriteIngredient(ing.id)}
                      title={ing.isFavorite ? 'คลิกเพื่อนำออกจากรายการโปรด' : 'คลิกเพื่อตั้งเป็นรายการโปรด / ของที่หยิบบ่อย'}
                      className={`p-2 rounded-2xl border transition-all active:scale-90 cursor-pointer flex items-center justify-center ${
                        ing.isFavorite
                          ? 'bg-amber-50 border-amber-300 text-amber-500 shadow-xs hover:bg-amber-100'
                          : 'bg-stone-50 border-stone-200 text-stone-300 hover:text-stone-500 hover:bg-stone-100'
                      }`}
                    >
                      <Star
                        className={`w-4 h-4 transition-all ${
                          ing.isFavorite ? 'fill-amber-400 text-amber-500 scale-110' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Stock Metrics Row */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <div className="text-[10px] font-semibold text-stone-400">สต็อกคงเหลือปัจจุบัน</div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-black ${
                            isLow ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-stone-900'
                          }`}
                        >
                          {ing.currentStock.toLocaleString()}
                        </span>
                        <span className="text-xs font-semibold text-stone-500">{ing.unit}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-stone-400">เป้าหมายสัปดาห์ (100%)</div>
                      <div className="text-xs font-bold text-stone-700">
                        {ing.targetStock.toLocaleString()} {ing.unit}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        จุดสั่งซื้อ: <span className="font-semibold text-stone-600">{threshold} {ing.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Energy Bar / Stock Level Gauge */}
                  <div className="mt-2.5 space-y-1">
                    <div className="relative w-full bg-stone-100 rounded-full h-3.5 overflow-hidden">
                      {/* Gauge Fill */}
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isLow
                            ? 'bg-linear-to-r from-red-600 to-rose-500'
                            : isWarning
                            ? 'bg-linear-to-r from-amber-500 to-yellow-400'
                            : 'bg-linear-to-r from-emerald-600 to-teal-400'
                        }`}
                        style={{ width: `${Math.max(4, fillPct)}%` }}
                      />

                      {/* Safety Stock (Min Stock) Marker Pin */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-stone-900/50 pointer-events-none"
                        style={{ left: `${Math.min(98, thresholdPct)}%` }}
                        title={`จุดสั่งซื้อปลอดภัย: ${threshold} ${ing.unit}`}
                      />
                    </div>

                    {/* Gauge Legend */}
                    <div className="flex items-center justify-between text-[10px] text-stone-500 px-0.5">
                      <span className="flex items-center gap-1 font-bold">
                        {isLow ? (
                          <span className="text-red-600 flex items-center gap-0.5 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>🚨 ต่ำกว่าจุดสั่งซื้อ! รีบเติม</span>
                          </span>
                        ) : isWarning ? (
                          <span className="text-amber-700">⚠️ ใกล้จุดสั่งซื้อ</span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">🟢 สต็อกอยู่ในเกณฑ์ดี</span>
                        )}
                      </span>

                      <span className="font-bold text-stone-700">
                        {fillPct}% ของเป้าหมาย
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Quick +/- Inline Buttons & Stock-In Action */}
                  <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
                    {/* Inline Quick Adjust (+/-) */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-[10px] text-stone-400 mr-1 hidden sm:inline">ปรับด่วน:</span>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust(ing, ing.unit === 'g' || ing.unit === 'ml' ? -100 : -1)}
                        title={`ลดทีละ ${ing.unit === 'g' || ing.unit === 'ml' ? '100' : '1'} ${ing.unit}`}
                        className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 active:scale-90 text-stone-700 font-bold flex items-center justify-center transition-all cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust(ing, ing.unit === 'g' || ing.unit === 'ml' ? 100 : 1)}
                        title={`เพิ่มทีละ ${ing.unit === 'g' || ing.unit === 'ml' ? '100' : '1'} ${ing.unit}`}
                        className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 active:scale-90 text-stone-700 font-bold flex items-center justify-center transition-all cursor-pointer"
                      >
                        +
                      </button>

                      {adjustedId === ing.id && (
                        <span className="text-[10px] text-emerald-600 font-bold ml-1 animate-fade-in flex items-center gap-0.5">
                          <Check className="w-3 h-3" />
                          <span>บันทึกแล้ว</span>
                        </span>
                      )}
                    </div>

                    {/* Stock-In Button */}
                    <button
                      type="button"
                      onClick={() => onOpenStockIn(ing.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ รับของเข้า</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
