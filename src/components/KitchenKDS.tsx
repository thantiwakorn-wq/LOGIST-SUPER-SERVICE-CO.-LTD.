import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Order, OrderItem, BOMRequirement } from '../types';
import { calculateAdjustedBOM } from '../utils/helpers';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Play,
  RotateCw,
  Sparkles,
  Bike,
  Store,
  BookOpen,
  Info,
  Layers,
} from 'lucide-react';

export const KitchenKDS: React.FC = () => {
  const { orders, updateOrderStatus, menuItems, ingredients } = useApp();

  // Active filter: All, Blending only, Queued only
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [showRecipeModal, setShowRecipeModal] = useState<OrderItem | null>(null);

  // Filter orders that need kitchen work (queued or blending) or recently blended
  const kitchenOrders = orders
    .filter((o) => {
      if (o.status === 'voided') return false;
      if (filter === 'active') {
        return o.status === 'queued' || o.status === 'blending';
      }
      return o.status !== 'voided';
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Helper to get recipe ingredients for an item
  const getRecipeDetails = (item: OrderItem) => {
    const menu = menuItems.find((m) => m.id === item.menuItemId);
    if (!menu) return [];

    return menu.bom.map((b) => {
      const ing = ingredients.find((i) => i.id === b.ingredientId);
      const adjustedAmount = calculateAdjustedBOM(b, item.sweetness);
      return {
        name: ing?.name || 'วัตถุดิบ',
        amount: adjustedAmount,
        unit: b.unit,
        zone: ing?.zone === 'chilled' ? 'ตู้เย็น/ถังน้ำแข็ง' : 'เคาน์เตอร์',
      };
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-4 space-y-4">
      {/* Top Header */}
      <div className="bg-stone-900 text-white p-3.5 sm:p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-xl">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base leading-tight">
              Kitchen Display System (KDS) • จอคิวปั่นน้ำโซนครัว
            </h1>
            <p className="text-xs text-stone-400">
              รวมคิวหน้าร้าน + ออนไลน์อัตโนมัติ พร้อม Recipe Helper บอกสัดส่วนวัตถุดิบ
            </p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'active'
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            คิวที่ต้องทำ ({orders.filter((o) => ['queued', 'blending'].includes(o.status)).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            ทั้งหมด
          </button>
        </div>
      </div>

      {/* Unified Queue Grid */}
      {kitchenOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 shadow-xs">
          <div className="text-4xl mb-2">🍹</div>
          <h2 className="text-stone-700 font-bold text-sm">ไม่มีคิวน้ำปั่นค้างอยู่ในขณะนี้</h2>
          <p className="text-xs text-stone-400 mt-1">
            ออเดอร์ใหม่จากหน้าร้าน (POS) และสั่งออนไลน์จะปรากฏที่นี่ทันทีตามลำดับเวลา
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {kitchenOrders.map((order) => {
            const isDelivery = order.isDelivery;
            const elapsedMinutes = Math.floor(
              (Date.now() - new Date(order.createdAt).getTime()) / 60000
            );

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border flex flex-col justify-between shadow-xs transition-all overflow-hidden ${
                  order.status === 'blending'
                    ? 'border-amber-400 ring-2 ring-amber-400/20'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                {/* Card Header */}
                <div
                  className={`p-3 border-b flex items-center justify-between text-xs ${
                    order.status === 'blending'
                      ? 'bg-amber-50/80 border-amber-200'
                      : 'bg-stone-50 border-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-stone-900">{order.orderNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                        isDelivery
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isDelivery ? <Bike className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                      {isDelivery ? 'จัดส่ง' : 'หน้าร้าน'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-medium text-stone-500">
                    <Clock className="w-3 h-3" />
                    <span>{elapsedMinutes} นาทีที่แล้ว</span>
                  </div>
                </div>

                {/* Items & Recipe Helper */}
                <div className="p-3.5 space-y-3 flex-1">
                  {order.items.map((item, idx) => {
                    const recipe = getRecipeDetails(item);

                    return (
                      <div
                        key={idx}
                        className="bg-stone-50/70 p-2.5 rounded-xl border border-stone-200/80 space-y-1.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="font-bold text-stone-900 text-xs">
                            {item.quantity}x {item.menuItemName}
                          </div>
                          <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                            หวาน {item.sweetness}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              item.drinkType === 'blended'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-sky-100 text-sky-900 border border-sky-300'
                            }`}
                          >
                            {item.drinkType === 'blended' ? '🥤 ปั่นเนียน' : '🧊 เสิร์ฟเย็น (ไม่ปั่น)'}
                          </span>
                          {item.selectedToppings.length > 0 && (
                            <span className="text-amber-800 font-medium text-[11px]">
                              • ใส่: {item.selectedToppings.map((t) => t.name).join(', ')}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <div className="text-[10px] bg-amber-50 text-amber-900 p-1 rounded border border-amber-200">
                            โน้ตลูกค้า: {item.notes}
                          </div>
                        )}

                        {/* Recipe Helper (แสดงสูตรชั่งตวงแม่นยำ) */}
                        <div className="mt-1 pt-1.5 border-t border-dashed border-stone-200">
                          <div className="text-[10px] font-bold text-stone-500 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-orange-600" />
                              สูตรชั่งตวง (คำนวณตามหวาน {item.sweetness}):
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            {recipe.map((r, rIdx) => (
                              <div
                                key={rIdx}
                                className={`px-1.5 py-0.5 rounded text-[10px] flex justify-between ${
                                  r.zone === 'ตู้เย็น/ถังน้ำแข็ง'
                                    ? 'bg-sky-50 text-sky-950 border border-sky-100'
                                    : 'bg-stone-100 text-stone-800'
                                }`}
                              >
                                <span className="truncate pr-1">{r.name}</span>
                                <span className="font-bold whitespace-nowrap">
                                  {r.amount} {r.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Status Update Button Actions */}
                <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center gap-2">
                  {order.status === 'queued' && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(order.id, 'blending')}
                      className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>เริ่มปั่น (Start Blending)</span>
                    </button>
                  )}

                  {order.status === 'blending' && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(order.id, 'blended')}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ปั่นเสร็จแล้ว (ส่งต่อไรเดอร์/เรียกคิว)</span>
                    </button>
                  )}

                  {order.status === 'blended' && (
                    <div className="w-full py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-center text-xs font-semibold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        {isDelivery ? 'พร้อมให้ไรเดอร์ไปส่ง' : 'รอเรียกลูกค้าหน้าร้าน'}
                      </span>
                    </div>
                  )}

                  {['out_for_delivery', 'completed'].includes(order.status) && (
                    <div className="w-full py-1.5 bg-stone-100 text-stone-500 rounded-xl text-center text-xs">
                      {order.status === 'out_for_delivery'
                        ? 'ไรเดอร์กำลังนำส่ง'
                        : 'เสร็จสิ้นเรียบร้อย'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
