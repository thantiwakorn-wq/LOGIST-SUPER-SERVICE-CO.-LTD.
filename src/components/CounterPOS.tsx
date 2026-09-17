import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MenuItem, SweetnessLevel, OrderItem, PaymentMethod, DrinkType } from '../types';
import { TOPPINGS } from '../data/mockData';
import { checkMenuAvailability } from '../utils/helpers';
import { PromptPayQR } from './PromptPayQR';
import { MonthlyReportModal } from './MonthlyReportModal';
import {
  Zap,
  RotateCcw,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  Clock,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react';

export const CounterPOS: React.FC = () => {
  const { menuItems, ingredients, createOrder, orders, voidOrder, shopLocation } = useApp();

  // Current Fast Order Items
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSweetness, setSelectedSweetness] = useState<SweetnessLevel>('50%');
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>('blended');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showQRPopup, setShowQRPopup] = useState(false);
  const [lastCreatedOrderNum, setLastCreatedOrderNum] = useState<string | null>(null);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);

  // Void modal
  const [orderToVoidId, setOrderToVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('ลูกค้าเปลี่ยนใจ / คีย์รายการผิด');

  const posCategories = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'coconut', label: '🥥 มะพร้าว' },
    { id: 'fresh_milk', label: '🥛 นมสด' },
    { id: 'yogurt', label: '🍓 โยเกิร์ต' },
    { id: 'bear_milk', label: '🧸 นมหมี' },
    { id: 'tea_coffee', label: '☕ ชา-กาแฟ' },
    { id: 'italian_soda', label: '🍹 โซดา' },
    { id: 'smoothie', label: '🥤 สมูทตี้' },
    { id: 'whip_cream', label: '🍦 วิปครีม' },
    { id: 'toast', label: '🍞 ขนมปัง' },
  ];

  // Quick 1-tap add menu with current sweetness & drink type
  const handleQuickAdd = (menu: MenuItem) => {
    const avail = checkMenuAvailability(menu.bom, ingredients);
    if (!avail.available) {
      alert(`ไม่สามารถเพิ่มได้: วัตถุดิบ ${avail.missingIngredientName || ''} หมด`);
      return;
    }

    const effectiveDrinkType = menu.allowIcedOrBlended === false ? 'blended' : selectedDrinkType;
    const effectivePrice =
      menu.blendedPrice && effectiveDrinkType === 'blended'
        ? menu.blendedPrice
        : menu.basePrice;

    const existingIdx = cartItems.findIndex(
      (it) => it.menuItemId === menu.id && it.sweetness === selectedSweetness && it.drinkType === effectiveDrinkType
    );

    if (existingIdx >= 0) {
      const updated = [...cartItems];
      updated[existingIdx].quantity += 1;
      setCartItems(updated);
    } else {
      const newItem: OrderItem = {
        menuItemId: menu.id,
        menuItemName: menu.name,
        price: effectivePrice,
        quantity: 1,
        sweetness: menu.category === 'toast' || menu.category === 'whip_cream' ? '100%' : selectedSweetness,
        drinkType: effectiveDrinkType,
        selectedToppings: [],
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  const handleUpdateQty = (index: number, delta: number) => {
    const item = cartItems[index];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCartItems(cartItems.filter((_, i) => i !== index));
    } else {
      const updated = [...cartItems];
      updated[index].quantity = newQty;
      setCartItems(updated);
    }
  };

  // Add Topping to specific cart item
  const handleAddToppingToItem = (itemIndex: number, toppingId: string) => {
    const topping = TOPPINGS.find((t) => t.id === toppingId);
    if (!topping) return;

    const updated = [...cartItems];
    const item = updated[itemIndex];
    if (item.selectedToppings.some((t) => t.id === topping.id)) {
      item.selectedToppings = item.selectedToppings.filter((t) => t.id !== topping.id);
    } else {
      item.selectedToppings.push(topping);
    }
    setCartItems(updated);
  };

  const subtotal = cartItems.reduce((sum, item) => {
    const toppingTotal = item.selectedToppings.reduce((tSum, top) => tSum + top.price, 0);
    return sum + (item.price + toppingTotal) * item.quantity;
  }, 0);

  // Quick Checkout in 3-5 seconds
  const handleCheckout = () => {
    if (cartItems.length === 0) return;

    if (paymentMethod === 'promptpay') {
      setShowQRPopup(true);
      return;
    }

    finalizeCheckout();
  };

  const finalizeCheckout = () => {
    // Generate daily counter order number like #A01, #A02...
    const counterOrdersCount = orders.filter((o) => o.channel === 'counter').length;
    const orderNumber = `#A${(counterOrdersCount + 1).toString().padStart(2, '0')}`;

    const newOrder = createOrder({
      orderNumber,
      channel: 'counter',
      items: cartItems,
      subtotal,
      deliveryFee: 0,
      discount: 0,
      totalAmount: subtotal,
      paymentMethod,
      paymentStatus: 'paid',
      isDelivery: false,
    });

    setLastCreatedOrderNum(newOrder.orderNumber);
    setCartItems([]);
    setShowQRPopup(false);

    // Auto hide success badge after 4 seconds
    setTimeout(() => {
      setLastCreatedOrderNum(null);
    }, 4000);
  };

  // Void confirmation
  const handleConfirmVoid = () => {
    if (!orderToVoidId) return;
    voidOrder(orderToVoidId, voidReason);
    setOrderToVoidId(null);
  };

  // Recent counter orders for fast Void
  const recentCounterOrders = orders.filter((o) => o.channel === 'counter').slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-4">
      {/* Top Banner / Quick Stats */}
      <div className="bg-stone-900 text-white p-3 sm:p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-xl">
            ⚡
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base leading-tight">
              Counter POS • หน้าจอพนักงานแคชเชียร์
            </h1>
            <p className="text-xs text-stone-400">
              แตะเมนู \u2192 เลือกความหวาน \u2192 คิดเงิน (เสร็จไวใน 3–5 วินาที ตัดสต็อกทันที)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Monthly Report & Google Sheets Quick Button */}
          <button
            type="button"
            onClick={() => setShowMonthlyReport(true)}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span>📊 สรุปยอดรายเดือน & Google Sheets</span>
          </button>

          {/* Drink Type Preset */}
          <div className="flex items-center gap-1 bg-stone-800 p-1 rounded-xl border border-stone-700">
            <button
              type="button"
              onClick={() => setSelectedDrinkType('blended')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                selectedDrinkType === 'blended'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:bg-stone-700'
              }`}
            >
              <span>🥤</span>
              <span>ปั่น</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDrinkType('iced')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                selectedDrinkType === 'iced'
                  ? 'bg-sky-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:bg-stone-700'
              }`}
            >
              <span>🧊</span>
              <span>เย็น</span>
            </button>
          </div>

          {/* Sweetness Quick Selector Preset */}
          <div className="flex items-center gap-1 bg-stone-800 p-1 rounded-xl border border-stone-700">
            <span className="text-[11px] text-stone-400 pl-1">หวาน:</span>
            {(['0%', '25%', '50%', '100%'] as SweetnessLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedSweetness(lvl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedSweetness === lvl
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-300 hover:bg-stone-700'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Success Notification Bar */}
      {lastCreatedOrderNum && (
        <div className="bg-emerald-500 text-white p-3 rounded-xl shadow-md flex items-center justify-between text-xs sm:text-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-bold">
              คิดเงินออเดอร์ {lastCreatedOrderNum} เรียบร้อย! ตัดสต็อกวัตถุดิบ (BOM) เรียบร้อย
            </span>
          </div>
          <span className="text-xs bg-emerald-700 px-2 py-0.5 rounded-md">ส่งเข้าจอ KDS แล้ว</span>
        </div>
      )}

      {/* Main Grid: Left is Menu Items (Quick-Touch), Right is Order Ticket */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Quick-Touch Menu Grid (Cols 7 or 8) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {posCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-200/80 text-stone-700 hover:bg-stone-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-stone-700">
            <span>แตะเมนูเพื่อใส่รายการ (หวานที่เลือก: {selectedSweetness} • {selectedDrinkType === 'blended' ? 'ปั่น' : 'เย็น'})</span>
            <span className="text-[11px] text-stone-500">
              {menuItems.filter((m) => selectedCategory === 'all' || m.category === selectedCategory).length} รายการ
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {menuItems
              .filter((m) => selectedCategory === 'all' || m.category === selectedCategory)
              .map((menu) => {
                const avail = checkMenuAvailability(menu.bom, ingredients);
                const isOut = !avail.available;

                return (
                  <button
                    key={menu.id}
                    type="button"
                    disabled={isOut}
                    onClick={() => handleQuickAdd(menu)}
                    className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-28 active:scale-95 ${
                      isOut
                        ? 'bg-stone-100 border-stone-200 opacity-50 cursor-not-allowed'
                        : 'bg-white border-stone-200/90 hover:border-amber-500 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{menu.image}</span>
                      <span className="font-bold text-amber-800 text-xs bg-amber-50 px-2 py-0.5 rounded-lg">
                        {menu.blendedPrice ? `฿${menu.basePrice}/฿${menu.blendedPrice}` : `฿${menu.basePrice}`}
                      </span>
                    </div>

                    <div className="mt-2">
                      <div className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                        {menu.name}
                      </div>
                      {isOut ? (
                        <span className="text-[10px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded block mt-0.5">
                          ⚠️ {avail.missingIngredientName || 'ของหมด'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-400">
                          {menu.allowIcedOrBlended === false ? (menu.category === 'toast' ? '🍞 ขนมปัง 2 แผ่น' : '🍦 วิปครีม 12 oz.') : 'แตะเพื่อสั่ง'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>

          {/* Quick Custom Topping Toggle Bar */}
          <div className="bg-stone-100 p-3 rounded-2xl border border-stone-200 text-xs">
            <span className="font-bold text-stone-700 block mb-1.5">
              ท็อปปิ้งเสริมหน้าร้าน (กดใส่ในรายการด้านขวา):
            </span>
            <div className="flex flex-wrap gap-2">
              {TOPPINGS.map((top) => (
                <div
                  key={top.id}
                  className="bg-white px-2.5 py-1 rounded-xl border border-stone-200 text-[11px] flex items-center gap-1.5 text-stone-700"
                >
                  <span>{top.name}</span>
                  <span className="font-bold text-amber-700">+฿{top.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Active POS Ticket & Payment (Cols 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-col justify-between min-h-[420px]">
          <div>
            {/* Header Ticket */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 text-sm">รายการออเดอร์ปัจจุบัน</span>
                <span className="text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                  {cartItems.reduce((s, i) => s + i.quantity, 0)} แก้ว
                </span>
              </div>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="text-stone-400 hover:text-red-500 text-xs"
                >
                  ล้างรายการ
                </button>
              )}
            </div>

            {/* Cart Items */}
            <div className="py-2 space-y-2 max-h-64 overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  ยังไม่มีรายการ แตะเมนูทางซ้ายเพื่อเพิ่มรายการใน 1 วินาที
                </div>
              ) : (
                cartItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900">{item.menuItemName}</span>
                      <span className="font-bold text-amber-800">
                        ฿
                        {(item.price +
                          item.selectedToppings.reduce((s, t) => s + t.price, 0)) *
                          item.quantity}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-600">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...cartItems];
                            updated[idx].drinkType =
                              updated[idx].drinkType === 'blended' ? 'iced' : 'blended';
                            setCartItems(updated);
                          }}
                          title="แตะเพื่อสลับ ปั่น / เย็น"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            item.drinkType === 'blended'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-sky-100 text-sky-900 border-sky-300'
                          }`}
                        >
                          {item.drinkType === 'blended' ? '🥤 ปั่น' : '🧊 เย็น'}
                        </button>
                        <span>หวาน {item.sweetness}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="w-5 h-5 rounded bg-stone-200 flex items-center justify-center font-bold"
                        >
                          -
                        </button>
                        <span className="font-bold min-w-4 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="w-5 h-5 rounded bg-stone-200 flex items-center justify-center font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Quick topping buttons for this item */}
                    <div className="flex gap-1 overflow-x-auto pt-1">
                      {TOPPINGS.map((top) => {
                        const hasTop = item.selectedToppings.some((t) => t.id === top.id);
                        return (
                          <button
                            key={top.id}
                            type="button"
                            onClick={() => handleAddToppingToItem(idx, top.id)}
                            className={`px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap border ${
                              hasTop
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-stone-600 border-stone-200'
                            }`}
                          >
                            + {top.name} (฿{top.price})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payment Method & Checkout Button */}
          <div className="pt-3 border-t border-stone-200 space-y-2.5">
            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>เงินสด (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('promptpay')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  paymentMethod === 'promptpay'
                    ? 'bg-[#003B6B] text-white border-[#003B6B] shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>พร้อมเพย์ QR</span>
              </button>
            </div>

            {/* Total and Submit */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-stone-500 font-medium">ยอดรวมสุทธิ</span>
              <span className="text-xl font-black text-stone-900">฿{subtotal}</span>
            </div>

            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={handleCheckout}
              className="w-full bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>คิดเงิน & ตัดสต็อกทันที (฿{subtotal})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders Section with VOID ORDER Button (ปุ่มยกเลิกออเดอร์ คืนวัตถุดิบเข้าคลังอัตโนมัติ) */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-500" />
            <h2 className="font-bold text-stone-900 text-xs sm:text-sm">
              ประวัติออเดอร์หน้าร้านล่าสุด (รองรับปุ่ม Void คืนสต็อก)
            </h2>
          </div>
          <span className="text-[11px] text-stone-400">
            หากกดผิด กดปุ่ม Void เพื่อคืนวัตถุดิบเข้าคลังอัตโนมัติ
          </span>
        </div>

        <div className="space-y-2">
          {recentCounterOrders.map((ord) => (
            <div
              key={ord.id}
              className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                ord.status === 'voided'
                  ? 'bg-red-50/50 border-red-200 text-stone-400'
                  : 'bg-stone-50 border-stone-200 text-stone-800'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-stone-900">{ord.orderNumber}</span>
                  <span className="text-[11px] text-stone-500">
                    {new Date(ord.createdAt).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                      ord.status === 'voided'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {ord.status === 'voided' ? 'ยกเลิกแล้ว (คืนสต็อกแล้ว)' : 'ปกติ'}
                  </span>
                </div>
                <div className="text-[11px] text-stone-600 mt-1">
                  {ord.items.map((i) => `${i.menuItemName} x${i.quantity}`).join(', ')}
                </div>
                {ord.voidReason && (
                  <div className="text-[10px] text-red-600 italic">
                    เหตุผล Void: {ord.voidReason}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="font-bold text-stone-900 text-sm">฿{ord.totalAmount}</span>

                {ord.status !== 'voided' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOrderToVoidId(ord.id);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Void ยกเลิกออเดอร์</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400">คืนของแล้ว</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PromptPay QR Popup Modal for Counter */}
      {showQRPopup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-stone-100">
              <h3 className="font-bold text-stone-800 text-sm">สแกนชำระเงินที่เคาน์เตอร์</h3>
              <button
                type="button"
                onClick={() => setShowQRPopup(false)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <PromptPayQR
              amount={subtotal}
              phoneOrId={shopLocation.promptPayId}
              shopName={shopLocation.name}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowQRPopup(false)}
                className="px-3.5 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold hover:bg-stone-100 active:scale-95 text-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-stone-600" />
                <span>กลับ</span>
              </button>
              <button
                type="button"
                onClick={finalizeCheckout}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2.5 px-3 rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>ลูกค้าชำระเงินแล้ว (ตัดสต็อก)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {orderToVoidId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm">ยืนยันการยกเลิกออเดอร์ (Void)</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              การ Void ออเดอร์จะทำการ <b>คืนวัตถุดิบทั้งหมด</b> (มะม่วง, นม, แก้ว, หลอด, ท็อปปิ้ง) กลับคืนเข้าสู่สต็อกคลังกลางทันที
            </p>

            <div>
              <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                ระบุเหตุผลการ Void:
              </label>
              <select
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs"
              >
                <option value="ลูกค้าเปลี่ยนใจ / ยกเลิก">ลูกค้าเปลี่ยนใจ / ขอยกเลิก</option>
                <option value="พนักงานคีย์รายการผิด">พนักงานคีย์รายการผิด</option>
                <option value="เครื่องปั่นมีปัญหา">เครื่องปั่นมีปัญหาชั่วคราว</option>
                <option value="ชำระเงินไม่สำเร็จ">ลูกค้าชำระเงินไม่สำเร็จ</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderToVoidId(null)}
                className="py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold text-xs hover:bg-stone-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
              >
                ยืนยัน Void & คืนสต็อก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MONTHLY REPORT MODAL */}
      {showMonthlyReport && (
        <MonthlyReportModal
          isOpen={true}
          onClose={() => setShowMonthlyReport(false)}
          isEmbedded={false}
        />
      )}
    </div>
  );
};
