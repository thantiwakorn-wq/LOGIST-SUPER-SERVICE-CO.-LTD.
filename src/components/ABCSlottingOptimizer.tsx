import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Ingredient, WorkstationSlot, ABCClass } from '../types';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  Search,
  Layers,
  Clock,
  Footprints,
  TrendingDown,
  Info,
  Maximize2,
  RefreshCw,
  Zap,
} from 'lucide-react';

// Distances from blender in meters (one-way)
const SLOT_DISTANCES: Record<WorkstationSlot, number> = {
  golden_zone: 0.4, // เอื้อมมือถึง ไม่ต้องก้าวเดิน (~0.4 ม.)
  secondary_zone: 1.2, // ก้าว 1-2 ก้าว (~1.2 ม.)
  deep_storage: 3.5, // ก้าว 4-6 ก้าว หรือเดินไปหลังร้าน (~3.5 ม.)
};

const SLOT_NAMES: Record<WorkstationSlot, string> = {
  golden_zone: 'จุดเอื้อมมือ (Golden Zone 0 ก้าว)',
  secondary_zone: 'จุด 1 ก้าว (Secondary Zone 1.2 ม.)',
  deep_storage: 'จุดเก็บลึก/หลังร้าน (Deep Storage 3.5 ม.)',
};

const SLOT_SHORT_NAMES: Record<WorkstationSlot, string> = {
  golden_zone: '⚡ เอื้อมมือ (0 ก้าว)',
  secondary_zone: '🚶 1 ก้าว (1.2 ม.)',
  deep_storage: '📦 หลังร้าน (3.5 ม.)',
};

interface ABCItemAnalysis {
  ingredient: Ingredient;
  actualPicks: number;
  baselinePicks: number;
  totalPicks: number;
  pickSharePercent: number;
  cumulativePercent: number;
  abcClass: ABCClass;
  currentSlot: WorkstationSlot;
  optimalSlot: WorkstationSlot;
  currentDistanceMeters: number;
  optimalDistanceMeters: number;
  distanceSavedMeters: number;
  status: 'optimal' | 'critical' | 'warning' | 'clutter' | 'suboptimal';
  statusLabel: string;
}

export const ABCSlottingOptimizer: React.FC = () => {
  const { ingredients, orders, menuItems, updateIngredientSlot, applyOptimalSlotting } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<'all' | ABCClass | 'misplaced'>('all');
  const [activeViewMode, setActiveViewMode] = useState<'single_view' | 'blueprint' | 'table' | 'pareto'>('single_view');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 1. Calculate Picking Frequency from Actual Orders + Baseline Distribution
  const analysisData = useMemo(() => {
    // Count picks from completed/active orders
    const actualOrderPicks: Record<string, number> = {};
    ingredients.forEach((ing) => {
      actualOrderPicks[ing.id] = 0;
    });

    orders.forEach((order) => {
      if (order.status === 'voided') return;
      order.items.forEach((item) => {
        const menu = menuItems.find((m) => m.id === item.menuItemId);
        if (menu && Array.isArray(menu.bom)) {
          menu.bom.forEach((b) => {
            if (actualOrderPicks[b.ingredientId] !== undefined) {
              actualOrderPicks[b.ingredientId] += item.quantity;
            }
          });
        }
        if (Array.isArray(item.selectedToppings)) {
          item.selectedToppings.forEach((top) => {
            if (actualOrderPicks[top.ingredientId] !== undefined) {
              actualOrderPicks[top.ingredientId] += item.quantity;
            }
          });
        }
      });
    });

    // Default baseline pick count map (simulating a representative 200 cups operating cycle)
    const defaultBaselines: Record<string, number> = {
      'ing-cup': 240,
      'ing-straw': 220,
      'ing-ice': 230,
      'ing-coconut-meat': 180,
      'ing-coconut-water': 160,
      'ing-fresh-milk': 160,
      'ing-syrup': 140,
      'ing-condensed-milk': 130,
      'ing-bear-milk': 120,
      'ing-banana': 65,
      'ing-strawberry': 58,
      'ing-yogurt': 48,
      'ing-whip-cream': 40,
      'ing-cocoa': 35,
      'ing-matcha': 36,
      'ing-thai-tea': 32,
      'ing-boba': 30,
      'ing-cup-12oz': 25,
      'ing-pipo': 22,
      'ing-oreo': 24,
      'ing-honey': 15,
      'ing-chili-paste': 12,
      'ing-taro-powder': 10,
    };

    // Calculate total picks for each item
    const rawItems = ingredients.map((ing) => {
      const orderPicks = actualOrderPicks[ing.id] || 0;
      const baseline = ing.manualPickCount ?? (defaultBaselines[ing.id] || 18);
      const totalPicks = orderPicks + baseline;

      // Default slot if not set:
      let currentSlot: WorkstationSlot = ing.placementSlot || 'secondary_zone';
      // If cup or straw not set, default to deep_storage to illustrate realistic misplacement
      if (!ing.placementSlot) {
        if (ing.id === 'ing-cup' || ing.id === 'ing-straw') {
          currentSlot = 'deep_storage';
        } else if (ing.id === 'ing-taro-powder' || ing.id === 'ing-chili-paste') {
          currentSlot = 'golden_zone';
        } else if (ing.id === 'ing-coconut-meat' || ing.id === 'ing-ice' || ing.id === 'ing-fresh-milk' || ing.id === 'ing-syrup') {
          currentSlot = 'golden_zone';
        } else {
          currentSlot = 'secondary_zone';
        }
      }

      return {
        ingredient: ing,
        actualPicks: orderPicks,
        baselinePicks: baseline,
        totalPicks,
        currentSlot,
      };
    });

    // Sort descending by total picks
    rawItems.sort((a, b) => b.totalPicks - a.totalPicks);

    const sumTotalPicks = rawItems.reduce((acc, curr) => acc + curr.totalPicks, 0) || 1;

    // Calculate cumulative percentage and assign ABC class
    let runningSum = 0;
    const itemsWithABC: ABCItemAnalysis[] = rawItems.map((item) => {
      runningSum += item.totalPicks;
      const pickSharePercent = (item.totalPicks / sumTotalPicks) * 100;
      const cumulativePercent = (runningSum / sumTotalPicks) * 100;

      // ABC Classification rules (80-15-5 rule standard)
      let abcClass: ABCClass = 'C';
      if (cumulativePercent <= 75 || item.totalPicks >= 100) {
        abcClass = 'A';
      } else if (cumulativePercent <= 95 || item.totalPicks >= 30) {
        abcClass = 'B';
      } else {
        abcClass = 'C';
      }

      // Optimal slotting rule
      let optimalSlot: WorkstationSlot = 'deep_storage';
      if (abcClass === 'A') optimalSlot = 'golden_zone';
      else if (abcClass === 'B') optimalSlot = 'secondary_zone';
      else optimalSlot = 'deep_storage';

      // Distances (Round-trip = 2x one-way distance)
      const currentDistPerPick = 2 * SLOT_DISTANCES[item.currentSlot];
      const optimalDistPerPick = 2 * SLOT_DISTANCES[optimalSlot];

      const currentDistanceMeters = item.totalPicks * currentDistPerPick;
      const optimalDistanceMeters = item.totalPicks * optimalDistPerPick;
      const distanceSavedMeters = currentDistanceMeters - optimalDistanceMeters;

      // Status diagnosis
      let status: ABCItemAnalysis['status'] = 'optimal';
      let statusLabel = '✅ จัดวางเหมาะสมตรงจุด';

      if (item.currentSlot === optimalSlot) {
        status = 'optimal';
        statusLabel = '✅ จัดวางเหมาะสมตรงจุด';
      } else if (optimalSlot === 'golden_zone' && item.currentSlot === 'deep_storage') {
        status = 'critical';
        statusLabel = '🚨 วิกฤต! หยิบบ่อยมากแต่วางหลังร้าน';
      } else if (optimalSlot === 'golden_zone' && item.currentSlot === 'secondary_zone') {
        status = 'warning';
        statusLabel = '⚠️ ควรย้ายมาจุดเอื้อมมือ (Golden)';
      } else if (optimalSlot === 'deep_storage' && item.currentSlot === 'golden_zone') {
        status = 'clutter';
        statusLabel = '⚠️ หยิบน้อยแต่เกะกะจุดเอื้อมมือ';
      } else {
        status = 'suboptimal';
        statusLabel = 'ℹ️ ปรับโซนเพื่อลดก้าวเดิน';
      }

      return {
        ingredient: item.ingredient,
        actualPicks: item.actualPicks,
        baselinePicks: item.baselinePicks,
        totalPicks: item.totalPicks,
        pickSharePercent,
        cumulativePercent,
        abcClass,
        currentSlot: item.currentSlot,
        optimalSlot,
        currentDistanceMeters,
        optimalDistanceMeters,
        distanceSavedMeters,
        status,
        statusLabel,
      };
    });

    // Store-wide aggregates
    const totalCurrentDistance = itemsWithABC.reduce((sum, i) => sum + i.currentDistanceMeters, 0);
    const totalOptimalDistance = itemsWithABC.reduce((sum, i) => sum + i.optimalDistanceMeters, 0);
    const totalDistanceSaved = Math.max(0, totalCurrentDistance - totalOptimalDistance);
    const savedPercent = totalCurrentDistance > 0 ? (totalDistanceSaved / totalCurrentDistance) * 100 : 0;

    // Walking metrics (avg kitchen step length ~ 0.65m, walking speed ~ 1.0 m/s)
    const currentSteps = Math.round(totalCurrentDistance / 0.65);
    const optimalSteps = Math.round(totalOptimalDistance / 0.65);
    const savedSteps = Math.max(0, currentSteps - optimalSteps);
    const savedMinutesPerDay = (totalDistanceSaved / 1.0) / 60;

    // Misplaced count
    const misplacedItems = itemsWithABC.filter((i) => i.currentSlot !== i.optimalSlot);

    // Group breakdown
    const groupA = itemsWithABC.filter((i) => i.abcClass === 'A');
    const groupB = itemsWithABC.filter((i) => i.abcClass === 'B');
    const groupC = itemsWithABC.filter((i) => i.abcClass === 'C');

    return {
      items: itemsWithABC,
      sumTotalPicks,
      totalCurrentDistance,
      totalOptimalDistance,
      totalDistanceSaved,
      savedPercent,
      currentSteps,
      optimalSteps,
      savedSteps,
      savedMinutesPerDay,
      misplacedItems,
      groupA,
      groupB,
      groupC,
    };
  }, [ingredients, orders, menuItems]);

  // Handle 1-Click Apply Optimal Slotting
  const handleApplyAllOptimal = () => {
    const assignments = analysisData.items.map((item) => ({
      ingredientId: item.ingredient.id,
      slot: item.optimalSlot,
    }));

    applyOptimalSlotting(assignments);
    setSuccessToast(
      `จัดผังเคาน์เตอร์สำเร็จ! ปรับตำแหน่งวัตถุดิบ ${assignments.length} รายการ ประหยัดระยะทางเดินได้ถึง ${(
        analysisData.totalDistanceSaved
      ).toFixed(0)} เมตร/วัน (${analysisData.savedPercent.toFixed(1)}%)`
    );

    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
  };

  // Filtered items for display
  const filteredItems = useMemo(() => {
    return analysisData.items.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        item.ingredient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.ingredient.category.toLowerCase().includes(searchQuery.toLowerCase());

      let matchClass = true;
      if (classFilter === 'misplaced') {
        matchClass = item.currentSlot !== item.optimalSlot;
      } else if (classFilter !== 'all') {
        matchClass = item.abcClass === classFilter;
      }

      return matchSearch && matchClass;
    });
  }, [analysisData.items, searchQuery, classFilter]);

  // Items grouped by current workstation slot (for Blueprint map)
  const itemsInGoldenZone = useMemo(
    () => analysisData.items.filter((i) => i.currentSlot === 'golden_zone'),
    [analysisData.items]
  );
  const itemsInSecondaryZone = useMemo(
    () => analysisData.items.filter((i) => i.currentSlot === 'secondary_zone'),
    [analysisData.items]
  );
  const itemsInDeepStorage = useMemo(
    () => analysisData.items.filter((i) => i.currentSlot === 'deep_storage'),
    [analysisData.items]
  );

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {successToast && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between text-sm font-bold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-100 hover:text-white text-xs px-2 py-1 rounded-lg bg-emerald-700/50"
          >
            ปิด
          </button>
        </div>
      )}

      {/* Main Header & Overview Card */}
      <div className="bg-stone-900 text-stone-100 rounded-3xl p-5 sm:p-6 border border-stone-800 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Lean Bar & Slotting Optimizer
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                ลดระยะก้าวเดินหยิบของ
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              วิเคราะห์ความถี่การหยิบ ABC & ลดระยะทางหยิบสินค้า
            </h2>
            <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
              วิเคราะห์ความถี่การหยิบจริงจากสูตร BOM และยอดขาย แบ่งกลุ่ม A (หยิบบ่อยสุด 80%), B (ปานกลาง), C (นานๆ หยิบที)
              พร้อมจัดวางตำแหน่งให้อยู่ใน <strong>&quot;Golden Zone (จุดเอื้อมมือ 0 ก้าว)&quot;</strong> เพื่อลดระยะทางเดินซ้ำซ้อนในร้านน้ำปั่น
            </p>
          </div>

          {/* Quick Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleApplyAllOptimal}
              className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 px-4 py-3 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-stone-950 fill-stone-950" />
              <span>⚡ ปรับผังจัดวางตามคำแนะนำ ABC ทันที</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Impact Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-stone-800">
          {/* 1. Current Distance */}
          <div className="bg-stone-800/80 p-3.5 rounded-2xl border border-stone-700/60">
            <div className="flex items-center justify-between text-stone-400 text-xs font-semibold">
              <span>ระยะทางเดินปัจจุบัน</span>
              <Footprints className="w-3.5 h-3.5 text-stone-400" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-white mt-1">
              {(analysisData.totalCurrentDistance / 1000).toFixed(2)}{' '}
              <span className="text-xs font-normal text-stone-400">กม./วัน</span>
            </div>
            <div className="text-[11px] text-stone-400 mt-0.5">
              ≈ {analysisData.currentSteps.toLocaleString()} ก้าวเดิน
            </div>
          </div>

          {/* 2. Optimized Distance */}
          <div className="bg-stone-800/80 p-3.5 rounded-2xl border border-stone-700/60">
            <div className="flex items-center justify-between text-stone-400 text-xs font-semibold">
              <span>ระยะทางหลังจัดผัง</span>
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-emerald-400 mt-1">
              {(analysisData.totalOptimalDistance / 1000).toFixed(2)}{' '}
              <span className="text-xs font-normal text-stone-400">กม./วัน</span>
            </div>
            <div className="text-[11px] text-emerald-300 mt-0.5">
              ลดเหลือเพียง {analysisData.optimalSteps.toLocaleString()} ก้าว
            </div>
          </div>

          {/* 3. Distance Saved */}
          <div className="bg-amber-950/40 p-3.5 rounded-2xl border border-amber-500/30">
            <div className="flex items-center justify-between text-amber-300 text-xs font-semibold">
              <span>ระยะทางที่ประหยัดได้</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-amber-300 mt-1">
              -{analysisData.totalDistanceSaved.toFixed(0)}{' '}
              <span className="text-xs font-normal text-amber-200">ม./วัน</span>
            </div>
            <div className="text-[11px] text-amber-400 font-bold mt-0.5">
              ประหยัดได้ {analysisData.savedPercent.toFixed(1)}% ({analysisData.savedSteps.toLocaleString()} ก้าว)
            </div>
          </div>

          {/* 4. Time Saved & Misplaced */}
          <div className="bg-stone-800/80 p-3.5 rounded-2xl border border-stone-700/60">
            <div className="flex items-center justify-between text-stone-400 text-xs font-semibold">
              <span>เวลาปรุงที่ประหยัดได้</span>
              <Clock className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-sky-400 mt-1">
              ~{analysisData.savedMinutesPerDay.toFixed(1)}{' '}
              <span className="text-xs font-normal text-stone-400">นาที/วัน</span>
            </div>
            <div className="text-[11px] text-stone-300 mt-0.5">
              {analysisData.misplacedItems.length > 0 ? (
                <span className="text-red-400 font-bold">
                  ⚠️ วางผิดโซน {analysisData.misplacedItems.length} รายการ
                </span>
              ) : (
                <span className="text-emerald-400 font-bold">✅ ทุกชิ้นอยู่ในโซนดีที่สุด</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ABC Class Summary Cards (Group A, B, C) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Group A */}
        <div className="bg-red-50/70 border border-red-200 rounded-3xl p-4.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                A
              </span>
              <div>
                <h4 className="font-bold text-red-950 text-sm">กลุ่ม A: หยิบบ่อยมาก (Fast-Moving)</h4>
                <p className="text-[11px] text-red-700">~70-80% ของการหยิบทั้งหมดในร้าน</p>
              </div>
            </div>
            <span className="text-xs font-black text-red-800 bg-red-200/60 px-2 py-0.5 rounded-full">
              {analysisData.groupA.length} รายการ
            </span>
          </div>
          <div className="text-xs text-red-900 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-red-100">
            <strong>คำแนะนำจัดวาง:</strong> ต้องวางใน <strong>&quot;Golden Zone (0 ก้าว)&quot;</strong>{' '}
            หน้าโถปั่น/ตู้แช่บนสุด เอื้อมหยิบได้ทันทีโดยไม่ต้องก้าวขาเดิน
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {analysisData.groupA.slice(0, 5).map((item) => (
              <span
                key={item.ingredient.id}
                className="text-[11px] bg-red-100 text-red-900 border border-red-200 px-2 py-0.5 rounded-lg font-medium"
              >
                {item.ingredient.name} ({item.totalPicks} ครั้ง)
              </span>
            ))}
            {analysisData.groupA.length > 5 && (
              <span className="text-[11px] text-red-600 font-bold self-center">
                +{analysisData.groupA.length - 5} รายการ
              </span>
            )}
          </div>
        </div>

        {/* Group B */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-4.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-amber-500 text-stone-950 font-black text-sm flex items-center justify-center shadow-xs">
                B
              </span>
              <div>
                <h4 className="font-bold text-amber-950 text-sm">กลุ่ม B: ความถี่ปานกลาง</h4>
                <p className="text-[11px] text-amber-700">~15-20% ของการหยิบในร้าน</p>
              </div>
            </div>
            <span className="text-xs font-black text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">
              {analysisData.groupB.length} รายการ
            </span>
          </div>
          <div className="text-xs text-amber-900 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-amber-100">
            <strong>คำแนะนำจัดวาง:</strong> จัดวางใน <strong>&quot;Secondary Zone (1 ก้าว)&quot;</strong>{' '}
            เคาน์เตอร์ปีกข้าง หรือตู้แช่แถวสอง ห่างจุดปรุงประมาณ 1.2 เมตร
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {analysisData.groupB.slice(0, 5).map((item) => (
              <span
                key={item.ingredient.id}
                className="text-[11px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg font-medium"
              >
                {item.ingredient.name} ({item.totalPicks} ครั้ง)
              </span>
            ))}
            {analysisData.groupB.length > 5 && (
              <span className="text-[11px] text-amber-600 font-bold self-center">
                +{analysisData.groupB.length - 5} รายการ
              </span>
            )}
          </div>
        </div>

        {/* Group C */}
        <div className="bg-stone-100 border border-stone-200 rounded-3xl p-4.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-stone-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                C
              </span>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">กลุ่ม C: ความถี่ต่ำ (Slow-Moving)</h4>
                <p className="text-[11px] text-stone-600">~5-10% ของการหยิบ (นานๆ หยิบที)</p>
              </div>
            </div>
            <span className="text-xs font-black text-stone-700 bg-stone-200 px-2 py-0.5 rounded-full">
              {analysisData.groupC.length} รายการ
            </span>
          </div>
          <div className="text-xs text-stone-800 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-stone-200">
            <strong>คำแนะนำจัดวาง:</strong> จัดเก็บใน <strong>&quot;Deep Storage (3.5 ม.)&quot;</strong>{' '}
            ใต้เคาน์เตอร์ลึก หรือชั้นวางของหลังร้าน เพื่อไม่ให้กินพื้นที่จุดปรุงหน้าโถปั่น
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {analysisData.groupC.slice(0, 5).map((item) => (
              <span
                key={item.ingredient.id}
                className="text-[11px] bg-stone-200/80 text-stone-800 px-2 py-0.5 rounded-lg font-medium"
              >
                {item.ingredient.name} ({item.totalPicks} ครั้ง)
              </span>
            ))}
            {analysisData.groupC.length > 5 && (
              <span className="text-[11px] text-stone-600 font-bold self-center">
                +{analysisData.groupC.length - 5} รายการ
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs & Search Filter */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* View Modes */}
          <div className="flex flex-wrap items-center gap-1.5 bg-stone-100 p-1 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setActiveViewMode('single_view')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewMode === 'single_view'
                  ? 'bg-amber-500 text-stone-950 shadow-xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-stone-950" />
              <span>✨ เมนูเดียวดูง่าย (One-Page Easy View)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('blueprint')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewMode === 'blueprint'
                  ? 'bg-white text-stone-900 shadow-xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
              <span>🗺️ แผนผังเคาน์เตอร์บาร์</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('table')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewMode === 'table'
                  ? 'bg-white text-stone-900 shadow-xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-stone-700" />
              <span>📋 ตารางแจกแจง ABC</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('pareto')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewMode === 'pareto'
                  ? 'bg-white text-stone-900 shadow-xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-red-600" />
              <span>📊 กราฟพาเรโต 80/20</span>
            </button>
          </div>

          {/* Group Filter */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <span className="text-stone-600 mr-1 text-[11px]">ตัวกรอง:</span>
            <button
              type="button"
              onClick={() => setClassFilter('all')}
              className={`px-2.5 py-1 rounded-xl transition-all ${
                classFilter === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              ทั้งหมด ({analysisData.items.length})
            </button>
            <button
              type="button"
              onClick={() => setClassFilter('misplaced')}
              className={`px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 ${
                classFilter === 'misplaced'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>วางผิดโซน ({analysisData.misplacedItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setClassFilter('A')}
              className={`px-2.5 py-1 rounded-xl transition-all ${
                classFilter === 'A'
                  ? 'bg-red-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              กลุ่ม A ({analysisData.groupA.length})
            </button>
            <button
              type="button"
              onClick={() => setClassFilter('B')}
              className={`px-2.5 py-1 rounded-xl transition-all ${
                classFilter === 'B'
                  ? 'bg-amber-500 text-stone-950 font-black'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              กลุ่ม B ({analysisData.groupB.length})
            </button>
            <button
              type="button"
              onClick={() => setClassFilter('C')}
              className={`px-2.5 py-1 rounded-xl transition-all ${
                classFilter === 'C'
                  ? 'bg-stone-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              กลุ่ม C ({analysisData.groupC.length})
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาวัตถุดิบเพื่อตรวจสอบความถี่และการจัดวาง..."
            className="w-full pl-9.5 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
      </div>

      {/* VIEW 0: ONE-PAGE EASY VIEW (ขอให้ตรงวิเคราะห์abcดูง่ายมีเมนูเดียว) */}
      {activeViewMode === 'single_view' && (
        <div className="space-y-4">
          {/* Quick Summary Strip */}
          <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-stone-100 p-4 rounded-3xl border border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-black text-sm flex items-center justify-center">
                ✨
              </span>
              <div>
                <h3 className="text-sm font-black text-stone-900">
                  สรุปการจัดวาง ABC ในหน้าเดียว (ดูง่าย ปรับได้ทันที)
                </h3>
                <p className="text-xs text-stone-500">
                  ระบบจัดกลุ่มตามความถี่การใช้งานจริง: กลุ่ม A (เอื้อมมือ), กลุ่ม B (1 ก้าว), กลุ่ม C (หลังร้าน)
                </p>
              </div>
            </div>

            {analysisData.misplacedItems.length > 0 && (
              <button
                type="button"
                onClick={handleApplyAllOptimal}
                className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>ปรับผังทั้งหมดให้เหมาะสมทันที ({analysisData.misplacedItems.length} รายการ)</span>
              </button>
            )}
          </div>

          {/* 3 Clear Columns / Cards for Group A, B, C */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* COLUMN A */}
            <div className="bg-white rounded-3xl border-2 border-red-300 p-4.5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-red-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center">
                    A
                  </span>
                  <div>
                    <h4 className="font-black text-stone-900 text-sm">กลุ่ม A (หยิบบ่อยมาก)</h4>
                    <p className="text-[11px] text-red-600 font-bold">~75-80% ของการหยิบ</p>
                  </div>
                </div>
                <span className="text-xs font-black bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                  {analysisData.groupA.length} รายการ
                </span>
              </div>

              <div className="bg-red-50/60 p-2.5 rounded-2xl text-[11px] text-red-900 leading-snug">
                📍 <strong>ตำแหน่งที่แนะนำ:</strong> วางตรง <strong>จุดเอื้อมมือ (0 ก้าว)</strong> หน้าโถปั่นน้ำ
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {analysisData.groupA.map((item) => {
                  const isMisplaced = item.currentSlot !== item.optimalSlot;
                  return (
                    <div
                      key={item.ingredient.id}
                      className={`p-2.5 rounded-2xl border transition-all ${
                        isMisplaced
                          ? 'bg-red-50/90 border-red-300'
                          : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-stone-900 truncate">
                          {item.ingredient.name}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-stone-600 shrink-0">
                          {item.totalPicks} ครั้ง
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-stone-100">
                        <span className="text-stone-500">ที่วาง:</span>
                        <select
                          value={item.currentSlot}
                          onChange={(e) =>
                            updateIngredientSlot(item.ingredient.id, e.target.value as WorkstationSlot)
                          }
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer ${
                            item.currentSlot === 'golden_zone'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-red-100 text-red-900 border-red-300'
                          }`}
                        >
                          <option value="golden_zone">⚡ เอื้อมมือ (0 ก้าว)</option>
                          <option value="secondary_zone">🚶 1 ก้าว (1.2 ม.)</option>
                          <option value="deep_storage">📦 หลังร้าน (3.5 ม.)</option>
                        </select>
                      </div>

                      {isMisplaced && (
                        <div className="mt-1.5 flex items-center justify-between text-[10px]">
                          <span className="text-red-600 font-bold">⚠️ วางผิดจุด</span>
                          <button
                            type="button"
                            onClick={() => updateIngredientSlot(item.ingredient.id, 'golden_zone')}
                            className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-md font-bold cursor-pointer"
                          >
                            ย้ายมาเอื้อมมือ
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN B */}
            <div className="bg-white rounded-3xl border-2 border-amber-300 p-4.5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-amber-500 text-stone-950 font-black text-sm flex items-center justify-center">
                    B
                  </span>
                  <div>
                    <h4 className="font-black text-stone-900 text-sm">กลุ่ม B (หยิบปานกลาง)</h4>
                    <p className="text-[11px] text-amber-700 font-bold">~15-20% ของการหยิบ</p>
                  </div>
                </div>
                <span className="text-xs font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                  {analysisData.groupB.length} รายการ
                </span>
              </div>

              <div className="bg-amber-50/60 p-2.5 rounded-2xl text-[11px] text-amber-900 leading-snug">
                📍 <strong>ตำแหน่งที่แนะนำ:</strong> วางตรง <strong>จุด 1 ก้าว (1.2 ม.)</strong> เคาน์เตอร์ปีกข้าง
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {analysisData.groupB.map((item) => {
                  const isMisplaced = item.currentSlot !== item.optimalSlot;
                  return (
                    <div
                      key={item.ingredient.id}
                      className={`p-2.5 rounded-2xl border transition-all ${
                        isMisplaced
                          ? 'bg-amber-50/80 border-amber-300'
                          : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-stone-900 truncate">
                          {item.ingredient.name}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-stone-600 shrink-0">
                          {item.totalPicks} ครั้ง
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-stone-100">
                        <span className="text-stone-500">ที่วาง:</span>
                        <select
                          value={item.currentSlot}
                          onChange={(e) =>
                            updateIngredientSlot(item.ingredient.id, e.target.value as WorkstationSlot)
                          }
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer ${
                            item.currentSlot === 'secondary_zone'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-stone-100 text-stone-800 border-stone-300'
                          }`}
                        >
                          <option value="golden_zone">⚡ เอื้อมมือ (0 ก้าว)</option>
                          <option value="secondary_zone">🚶 1 ก้าว (1.2 ม.)</option>
                          <option value="deep_storage">📦 หลังร้าน (3.5 ม.)</option>
                        </select>
                      </div>

                      {isMisplaced && (
                        <div className="mt-1.5 flex items-center justify-between text-[10px]">
                          <span className="text-amber-700 font-bold">ℹ️ ปรับโซนได้</span>
                          <button
                            type="button"
                            onClick={() => updateIngredientSlot(item.ingredient.id, 'secondary_zone')}
                            className="bg-amber-500 hover:bg-amber-600 text-stone-950 px-2 py-0.5 rounded-md font-bold cursor-pointer"
                          >
                            ย้ายไป 1 ก้าว
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN C */}
            <div className="bg-white rounded-3xl border-2 border-stone-300 p-4.5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-stone-600 text-white font-black text-sm flex items-center justify-center">
                    C
                  </span>
                  <div>
                    <h4 className="font-black text-stone-900 text-sm">กลุ่ม C (หยิบน้อย/นานๆ ที)</h4>
                    <p className="text-[11px] text-stone-500 font-bold">~5-10% ของการหยิบ</p>
                  </div>
                </div>
                <span className="text-xs font-black bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">
                  {analysisData.groupC.length} รายการ
                </span>
              </div>

              <div className="bg-stone-100 p-2.5 rounded-2xl text-[11px] text-stone-700 leading-snug">
                📍 <strong>ตำแหน่งที่แนะนำ:</strong> เก็บไว้ <strong>หลังร้าน / ชั้นล่าง (3.5 ม.)</strong> เพื่อไม่ให้เกะกะ
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {analysisData.groupC.map((item) => {
                  const isMisplaced = item.currentSlot !== item.optimalSlot;
                  return (
                    <div
                      key={item.ingredient.id}
                      className={`p-2.5 rounded-2xl border transition-all ${
                        isMisplaced && item.currentSlot === 'golden_zone'
                          ? 'bg-orange-50 border-orange-300'
                          : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-stone-900 truncate">
                          {item.ingredient.name}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-stone-600 shrink-0">
                          {item.totalPicks} ครั้ง
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-stone-100">
                        <span className="text-stone-500">ที่วาง:</span>
                        <select
                          value={item.currentSlot}
                          onChange={(e) =>
                            updateIngredientSlot(item.ingredient.id, e.target.value as WorkstationSlot)
                          }
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer ${
                            item.currentSlot === 'deep_storage'
                              ? 'bg-stone-200 text-stone-900 border-stone-300'
                              : 'bg-orange-100 text-orange-900 border-orange-300'
                          }`}
                        >
                          <option value="golden_zone">⚡ เอื้อมมือ (0 ก้าว)</option>
                          <option value="secondary_zone">🚶 1 ก้าว (1.2 ม.)</option>
                          <option value="deep_storage">📦 หลังร้าน (3.5 ม.)</option>
                        </select>
                      </div>

                      {isMisplaced && item.currentSlot === 'golden_zone' && (
                        <div className="mt-1.5 flex items-center justify-between text-[10px]">
                          <span className="text-orange-700 font-bold">⚠️ เกะกะหน้าโถปั่น</span>
                          <button
                            type="button"
                            onClick={() => updateIngredientSlot(item.ingredient.id, 'deep_storage')}
                            className="bg-stone-700 hover:bg-stone-800 text-white px-2 py-0.5 rounded-md font-bold cursor-pointer"
                          >
                            ย้ายไปหลังร้าน
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: INTERACTIVE WORKSTATION BLUEPRINT LAYOUT */}
      {activeViewMode === 'blueprint' && (
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div>
              <h3 className="font-black text-stone-900 text-base flex items-center gap-2">
                <span>🥤 แผนผังจำลองจุดจัดวางเคาน์เตอร์บาร์น้ำปั่น (Prep Station Blueprint)</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                ศูนย์กลางคือ <strong>โถปั่นน้ำ (Blender Hub)</strong> วัตถุดิบกลุ่ม A ควรอยู่ในระยะเอื้อมมือ
                เพื่อไม่ให้พนักงานต้องก้าวเท้าเดิน
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-stone-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> เอื้อมมือ 0.4m
              </span>
              <span className="flex items-center gap-1.5 text-stone-600">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> ก้าว 1.2m
              </span>
              <span className="flex items-center gap-1.5 text-stone-600">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-400"></span> หลังร้าน 3.5m
              </span>
            </div>
          </div>

          {/* Visual Blueprint Zones Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* ZONE 1: GOLDEN ZONE (0 ก้าว, 0.4 ม. - หน้าโถปั่น / ถาดผลไม้หลัก) */}
            <div className="lg:col-span-12 bg-gradient-to-br from-emerald-50/80 via-emerald-50/40 to-white border-2 border-emerald-400/70 rounded-3xl p-4.5 relative shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <h4 className="font-black text-emerald-950 text-sm flex items-center gap-1.5">
                      <span>⚡ จุดเอื้อมมือ (Golden Zone - ระยะ 0 ก้าว / 0.4 เมตร)</span>
                      <span className="bg-emerald-200/80 text-emerald-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        หน้าโถปั่น & ตู้แช่บน
                      </span>
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      โซนที่ดีที่สุด! เหมาะสำหรับวัตถุดิบ <strong>กลุ่ม A</strong> (หยิบบ่อยสุด)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-xl">
                    มี {itemsInGoldenZone.length} รายการ
                  </span>
                </div>
              </div>

              {/* Items currently in Golden Zone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {itemsInGoldenZone.map((item) => (
                  <div
                    key={item.ingredient.id}
                    className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                      item.abcClass === 'A'
                        ? 'bg-white border-emerald-300 shadow-xs'
                        : item.abcClass === 'C'
                        ? 'bg-red-50/90 border-red-300 ring-2 ring-red-400/40'
                        : 'bg-white border-stone-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                            item.abcClass === 'A'
                              ? 'bg-red-600 text-white'
                              : item.abcClass === 'B'
                              ? 'bg-amber-400 text-stone-900'
                              : 'bg-stone-500 text-white'
                          }`}
                        >
                          กลุ่ม {item.abcClass}
                        </span>
                        <span className="text-[11px] font-bold text-stone-600">
                          {item.totalPicks} ครั้ง/รอบ
                        </span>
                      </div>
                      <div className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                        {item.ingredient.name}
                      </div>
                      {item.abcClass === 'C' && (
                        <div className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>เกะกะบาร์! ควรย้ายไปหลังร้าน</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Move Selector */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                      <span className="text-stone-600 font-medium">ย้ายโซน:</span>
                      <select
                        value={item.currentSlot}
                        onChange={(e) =>
                          updateIngredientSlot(item.ingredient.id, e.target.value as WorkstationSlot)
                        }
                        className="bg-stone-100 border border-stone-200 text-stone-800 text-[11px] font-bold rounded-lg px-2 py-1 cursor-pointer focus:outline-none"
                      >
                        <option value="golden_zone">⚡ เอื้อมมือ</option>
                        <option value="secondary_zone">🚶 1 ก้าว</option>
                        <option value="deep_storage">📦 หลังร้าน</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ZONE 2: SECONDARY ZONE (1-2 ก้าว, 1.2 ม. - ปีกข้าง / ตู้แช่แถวล่าง) */}
            <div className="lg:col-span-7 bg-amber-50/40 border border-amber-300/80 rounded-3xl p-4.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500 text-stone-950 font-black text-xs flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <h4 className="font-black text-amber-950 text-sm">
                      🚶 จุด 1 ก้าว (Secondary Zone - 1.2 เมตร)
                    </h4>
                    <p className="text-[11px] text-amber-800">
                      เคาน์เตอร์ปีกซ้าย-ขวา / ตู้แช่แถวล่าง เหมาะสำหรับวัตถุดิบ <strong>กลุ่ม B</strong>
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-xl">
                  มี {itemsInSecondaryZone.length} รายการ
                </span>
              </div>

              {/* Items in Secondary Zone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {itemsInSecondaryZone.map((item) => (
                  <div
                    key={item.ingredient.id}
                    className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                      item.abcClass === 'A'
                        ? 'bg-red-50/80 border-red-300 ring-2 ring-red-400/40'
                        : 'bg-white border-stone-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                            item.abcClass === 'A'
                              ? 'bg-red-600 text-white'
                              : item.abcClass === 'B'
                              ? 'bg-amber-400 text-stone-900'
                              : 'bg-stone-500 text-white'
                          }`}
                        >
                          กลุ่ม {item.abcClass}
                        </span>
                        <span className="text-[11px] font-bold text-stone-600">
                          {item.totalPicks} ครั้ง
                        </span>
                      </div>
                      <div className="font-bold text-stone-900 text-xs truncate">
                        {item.ingredient.name}
                      </div>
                      {item.abcClass === 'A' && (
                        <div className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>หยิบบ่อย! ควรย้ายไปจุดเอื้อมมือ</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between text-[11px]">
                      <span className="text-stone-600 font-medium">ย้าย:</span>
                      <select
                        value={item.currentSlot}
                        onChange={(e) =>
                          updateIngredientSlot(item.ingredient.id, e.target.value as WorkstationSlot)
                        }
                        className="bg-stone-100 border border-stone-200 text-stone-800 text-[11px] font-bold rounded-lg px-2 py-0.5 cursor-pointer focus:outline-none"
                      >
                        <option value="golden_zone">⚡ เอื้อมมือ</option>
                        <option value="secondary_zone">🚶 1 ก้าว</option>
                        <option value="deep_storage">📦 หลังร้าน</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ZONE 3: DEEP STORAGE (4-6 ก้าว, 3.5 ม. - หลังร้าน / ใต้โต๊ะลึก) */}
            <div className="lg:col-span-5 bg-stone-100/90 border border-stone-300 rounded-3xl p-4.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-stone-600 text-white font-black text-xs flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <h4 className="font-black text-stone-900 text-sm">
                      📦 จุดเก็บลึก/หลังร้าน (Deep Storage - 3.5 เมตร)
                    </h4>
                    <p className="text-[11px] text-stone-600">
                      ชั้นวางสต็อกหลังร้าน / ใต้โต๊ะลึก เหมาะกับ <strong>กลุ่ม C</strong>
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-stone-800 bg-stone-200 px-2.5 py-1 rounded-xl">
                  มี {itemsInDeepStorage.length} รายการ
                </span>
              </div>

              {/* Items in Deep Storage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {itemsInDeepStorage.map((item) => (
                  <div
                    key={item.ingredient.id}
                    className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                      item.abcClass === 'A'
                        ? 'bg-red-50 border-red-400 ring-2 ring-red-500/50'
                        : 'bg-white border-stone-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                            item.abcClass === 'A'
                              ? 'bg-red-600 text-white'
                              : item.abcClass === 'B'
                              ? 'bg-amber-400 text-stone-900'
                              : 'bg-stone-500 text-white'
                          }`}
                        >
                          กลุ่ม {item.abcClass}
                        </span>
                        <span className="text-[11px] font-bold text-stone-600">
                          {item.totalPicks} ครั้ง
                        </span>
                      </div>
                      <div className="font-bold text-stone-900 text-xs truncate">
                        {item.ingredient.name}
                      </div>
                      {item.abcClass === 'A' && (
                        <div className="text-[10px] text-red-600 font-black mt-1 flex items-center gap-1 animate-pulse">
                          <AlertOctagon className="w-3 h-3" />
                          <span>🚨 วิกฤต! เสียเวลาเดิน 3.5m ทุกรอบ</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between text-[11px]">
                      <span className="text-stone-600 font-medium">ย้าย:</span>
                      <select
                        value={item.currentSlot}
                        onChange={(e) =>
                          updateIngredientSlot(item.ingredient.id, e.target.value as WorkstationSlot)
                        }
                        className="bg-stone-100 border border-stone-200 text-stone-800 text-[11px] font-bold rounded-lg px-2 py-0.5 cursor-pointer focus:outline-none"
                      >
                        <option value="golden_zone">⚡ เอื้อมมือ</option>
                        <option value="secondary_zone">🚶 1 ก้าว</option>
                        <option value="deep_storage">📦 หลังร้าน</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: PARETO 80/20 CURVE & DISTRIBUTION */}
      {activeViewMode === 'pareto' && (
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="font-black text-stone-900 text-base flex items-center gap-2">
              <span>📊 แผนภูมิวิเคราะห์พาเรโต (Pareto Distribution Chart)</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              วัตถุดิบ 20% แรก (กลุ่ม A) สร้างกิจกรรมการหยิบถึง 75-80% ของร้านน้ำปั่นทั้งหมด
            </p>
          </div>

          {/* Pareto Chart Visualizer using SVG */}
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 overflow-x-auto">
            <div className="min-w-[650px] h-64 flex flex-col justify-between">
              {/* Top 15 items distribution bars */}
              <div className="flex items-end justify-between gap-2 h-44 pt-4 px-2 border-b border-stone-300">
                {analysisData.items.slice(0, 16).map((item) => {
                  const barHeightPercent = Math.max(
                    8,
                    (item.totalPicks / (analysisData.items[0]?.totalPicks || 1)) * 100
                  );
                  return (
                    <div
                      key={item.ingredient.id}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 bg-stone-900 text-white text-[10px] py-1 px-2 rounded-lg pointer-events-none transition-all z-20 whitespace-nowrap shadow-md">
                        {item.ingredient.name}: {item.totalPicks} ครั้ง ({item.pickSharePercent.toFixed(1)}%)
                      </div>
                      <div
                        style={{ height: `${barHeightPercent}%` }}
                        className={`w-full max-w-[28px] rounded-t-lg transition-all ${
                          item.abcClass === 'A'
                            ? 'bg-red-500 hover:bg-red-600'
                            : item.abcClass === 'B'
                            ? 'bg-amber-400 hover:bg-amber-500'
                            : 'bg-stone-400 hover:bg-stone-500'
                        }`}
                      ></div>
                      <span className="text-[10px] font-black text-stone-700 mt-1">
                        {item.abcClass}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Labels */}
              <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2 px-2">
                <span>← ความถี่การหยิบสูงมาก (กลุ่ม A)</span>
                <span className="font-bold text-stone-700">16 อันดับแรกที่หยิบบ่อยที่สุดในร้าน</span>
                <span>ความถี่การหยิบต่ำ (กลุ่ม C) →</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: DETAILED ABC SLOTTING TABLE */}
      {activeViewMode === 'table' && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-stone-900 text-base">
                ตารางแจกแจงความถี่การหยิบ & ระยะทางเดิน (ABC Slotting Matrix)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                แสดงจำนวนครั้งที่หยิบต่อรอบ, ตำแหน่งปัจจุบัน, ตำแหน่งที่แนะนำ, และระยะทางที่ลดได้
              </p>
            </div>
            <span className="text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-xl">
              แสดง {filteredItems.length} จาก {analysisData.items.length} รายการ
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 text-stone-700 text-xs uppercase font-bold border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3.5">วัตถุดิบ</th>
                  <th className="px-3 py-3.5 text-center">กลุ่ม ABC</th>
                  <th className="px-3 py-3.5 text-right">ความถี่หยิบ (ครั้ง)</th>
                  <th className="px-3 py-3.5 text-right">% สะสม</th>
                  <th className="px-4 py-3.5">ตำแหน่งปัจจุบัน</th>
                  <th className="px-4 py-3.5">ตำแหน่งแนะนำ</th>
                  <th className="px-3 py-3.5 text-right">ระยะเดิน (ปัจจุบัน)</th>
                  <th className="px-3 py-3.5 text-right">ประหยัดได้</th>
                  <th className="px-4 py-3.5 text-center">สถานะ</th>
                  <th className="px-3 py-3.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-900">
                {filteredItems.map((item) => (
                  <tr
                    key={item.ingredient.id}
                    className={`hover:bg-stone-50/80 transition-colors ${
                      item.status === 'critical'
                        ? 'bg-red-50/50'
                        : item.status === 'warning'
                        ? 'bg-amber-50/30'
                        : ''
                    }`}
                  >
                    {/* Name */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-stone-950 flex items-center gap-1.5">
                        {item.ingredient.isFavorite && (
                          <span className="text-amber-500 text-xs">⭐</span>
                        )}
                        <span>{item.ingredient.name}</span>
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {item.ingredient.category} • คงเหลือ: {item.ingredient.currentStock.toLocaleString()}{' '}
                        {item.ingredient.unit}
                      </div>
                    </td>

                    {/* ABC Class Badge */}
                    <td className="px-3 py-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black ${
                          item.abcClass === 'A'
                            ? 'bg-red-600 text-white shadow-xs'
                            : item.abcClass === 'B'
                            ? 'bg-amber-400 text-stone-950 font-black'
                            : 'bg-stone-200 text-stone-800'
                        }`}
                      >
                        กลุ่ม {item.abcClass}
                      </span>
                    </td>

                    {/* Total Picks */}
                    <td className="px-3 py-3.5 text-right font-mono font-bold">
                      {item.totalPicks.toLocaleString()}{' '}
                      <span className="text-[11px] font-normal text-stone-500">ครั้ง</span>
                    </td>

                    {/* Cumulative % */}
                    <td className="px-3 py-3.5 text-right font-mono text-stone-600">
                      {item.cumulativePercent.toFixed(1)}%
                    </td>

                    {/* Current Slot */}
                    <td className="px-4 py-3.5">
                      <select
                        value={item.currentSlot}
                        onChange={(e) =>
                          updateIngredientSlot(item.ingredient.id, e.target.value as WorkstationSlot)
                        }
                        className={`text-xs font-bold px-2.5 py-1 rounded-xl border cursor-pointer focus:outline-none ${
                          item.currentSlot === 'golden_zone'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : item.currentSlot === 'secondary_zone'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-stone-100 text-stone-800 border-stone-300'
                        }`}
                      >
                        <option value="golden_zone">{SLOT_SHORT_NAMES.golden_zone}</option>
                        <option value="secondary_zone">{SLOT_SHORT_NAMES.secondary_zone}</option>
                        <option value="deep_storage">{SLOT_SHORT_NAMES.deep_storage}</option>
                      </select>
                    </td>

                    {/* Optimal Slot */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block text-xs font-bold px-2.5 py-1 rounded-xl ${
                          item.optimalSlot === 'golden_zone'
                            ? 'bg-emerald-100 text-emerald-900'
                            : item.optimalSlot === 'secondary_zone'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-stone-200 text-stone-800'
                        }`}
                      >
                        {SLOT_SHORT_NAMES[item.optimalSlot]}
                      </span>
                    </td>

                    {/* Current Walk Distance */}
                    <td className="px-3 py-3.5 text-right font-mono text-stone-700">
                      {item.currentDistanceMeters.toFixed(0)} ม.
                    </td>

                    {/* Saved Distance */}
                    <td className="px-3 py-3.5 text-right font-mono font-bold">
                      {item.distanceSavedMeters > 0 ? (
                        <span className="text-emerald-600">
                          -{item.distanceSavedMeters.toFixed(0)} ม.
                        </span>
                      ) : item.distanceSavedMeters < 0 ? (
                        <span className="text-stone-400">0 ม.</span>
                      ) : (
                        <span className="text-stone-400">0 ม.</span>
                      )}
                    </td>

                    {/* Status Label */}
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                          item.status === 'optimal'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'critical'
                            ? 'bg-red-100 text-red-800 border border-red-200 animate-pulse'
                            : item.status === 'warning'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : item.status === 'clutter'
                            ? 'bg-orange-100 text-orange-800 border border-orange-200'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {item.statusLabel}
                      </span>
                    </td>

                    {/* Action: Quick Move to Optimal */}
                    <td className="px-3 py-3.5 text-center">
                      {item.currentSlot !== item.optimalSlot ? (
                        <button
                          type="button"
                          onClick={() => updateIngredientSlot(item.ingredient.id, item.optimalSlot)}
                          className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                        >
                          ย้ายทันที
                        </button>
                      ) : (
                        <span className="text-emerald-600 text-xs font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Educational Guide Box (Lean Manufacturing in Beverage Bar) */}
      <div className="bg-stone-50 border border-stone-200 rounded-3xl p-5 text-xs text-stone-600 space-y-2">
        <h4 className="font-bold text-stone-900 flex items-center gap-1.5 text-sm">
          <Info className="w-4 h-4 text-amber-600" />
          <span>หลักการ Ergonomics & Lean Bar Layout (ลดระยะทางหยิบสินค้า)</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="bg-white p-3 rounded-2xl border border-stone-200">
            <strong className="text-stone-900 block mb-1">1. Golden Zone (เอื้อมมือ 0 ก้าว)</strong>
            วางของกลุ่ม A (เนื้อมะพร้าว, นมสด, แก้ว, น้ำแข็ง, น้ำเชื่อม) ไว้ตรงหน้าโถปั่นและระดับสายตา ช่วยตัดการก้าวเดินที่ไม่จำเป็นออกได้ถึง 60-70%
          </div>
          <div className="bg-white p-3 rounded-2xl border border-stone-200">
            <strong className="text-stone-900 block mb-1">2. Secondary Zone (1 ก้าว)</strong>
            วางของกลุ่ม B (ผลไม้ปั่นรสรอง เช่น สตรอว์เบอร์รี่, กล้วย, โยเกิร์ต, ชาเขียว) ไว้ปีกข้างเคาน์เตอร์ ก้าวเพียง 1 ก้าวก็หยิบได้
          </div>
          <div className="bg-white p-3 rounded-2xl border border-stone-200">
            <strong className="text-stone-900 block mb-1">3. ป้องกัน Golden Zone Clutter</strong>
            อย่านำของกลุ่ม C (ของที่นานๆ มีคนสั่ง เช่น ท็อปปิ้งพิเศษ ไซรัปกลิ่นแปลก) มาวางเกะกะบนโต๊ะปรุง ให้เก็บไว้ชั้นล่างหรือหลังร้าน
          </div>
        </div>
      </div>
    </div>
  );
};
