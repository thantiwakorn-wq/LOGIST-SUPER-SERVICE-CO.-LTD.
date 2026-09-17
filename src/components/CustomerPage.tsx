import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MenuItem, OrderItem, SweetnessLevel, DrinkType, Topping } from '../types';
import { TOPPINGS, SHOP_LOCATION } from '../data/mockData';
import { checkMenuAvailability } from '../utils/helpers';
import { DeliveryMap } from './DeliveryMap';
import { PromptPayQR } from './PromptPayQR';
import { CustomerOrderQRModal } from './CustomerOrderQRModal';
import { ShopLocationModal } from './ShopLocationModal';
import {
  ShoppingBag,
  Plus,
  Minus,
  Check,
  MapPin,
  Clock,
  Sparkles,
  Phone,
  Upload,
  AlertCircle,
  X,
  Bike,
  CheckCircle2,
  Share2,
  QrCode,
  Store,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react';

export const CustomerPage: React.FC = () => {
  const {
    menuItems,
    ingredients,
    createOrder,
    orders,
    activeCustomerOrderId,
    setActiveCustomerOrderId,
    shopLocation,
    isCustomerOnlyView,
    setIsCustomerOnlyView,
  } = useApp();

  // Selected Category
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // QR Modal & Shop Location Modal State
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isShopLocationModalOpen, setIsShopLocationModalOpen] = useState(false);

  // Customization Modal State
  const [selectedMenuForCustomization, setSelectedMenuForCustomization] = useState<MenuItem | null>(null);
  const [sweetness, setSweetness] = useState<SweetnessLevel>('50%');
  const [drinkType, setDrinkType] = useState<DrinkType>('blended');
  const [selectedSauce, setSelectedSauce] = useState<string>('ช็อกโกแลต');
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
  const [itemNotes, setItemNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Cart State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout Form State (Manual Address & Optional Map)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  const [deliveryLat, setDeliveryLat] = useState(shopLocation.lat || 15.1192);
  const [deliveryLng, setDeliveryLng] = useState(shopLocation.lng || 104.9036);
  const [deliveryLocationName, setDeliveryLocationName] = useState('รับหน้าร้าน (หน้า ม. แถวบิวตี้)');
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState(0.0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [slipFile, setSlipFile] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active tracking order
  const activeOrder = orders.find((o) => o.id === activeCustomerOrderId);

  // Calculate cart totals
  const subtotal = cart.reduce((sum, item) => {
    const toppingTotal = item.selectedToppings.reduce((tSum, top) => tSum + top.price, 0);
    return sum + (item.price + toppingTotal) * item.quantity;
  }, 0);
  const totalAmount = subtotal + (cart.length > 0 ? deliveryFee : 0);

  // Open customization modal with drinkType option (Blended or Iced)
  const handleOpenCustomize = (menu: MenuItem, initialType: DrinkType = 'blended') => {
    const avail = checkMenuAvailability(menu.bom, ingredients);
    if (!avail.available) return; // Cannot order out-of-stock

    setSelectedMenuForCustomization(menu);
    setSweetness(menu.defaultSweetness);
    setDrinkType(menu.allowIcedOrBlended === false ? 'blended' : initialType);
    setSelectedToppings([]);
    setItemNotes('');
    setQuantity(1);
    if (menu.sauceOptions && menu.sauceOptions.length > 0) {
      setSelectedSauce(menu.sauceOptions[0]);
    } else {
      setSelectedSauce('');
    }
  };

  // Toggle topping
  const handleToggleTopping = (topping: Topping) => {
    if (selectedToppings.some((t) => t.id === topping.id)) {
      setSelectedToppings(selectedToppings.filter((t) => t.id !== topping.id));
    } else {
      setSelectedToppings([...selectedToppings, topping]);
    }
  };

  // Add to cart
  const handleAddToCart = () => {
    if (!selectedMenuForCustomization) return;

    const effectivePrice =
      selectedMenuForCustomization.blendedPrice && drinkType === 'blended'
        ? selectedMenuForCustomization.blendedPrice
        : selectedMenuForCustomization.basePrice;

    const fullNotes = [
      selectedSauce ? `ซอส: ${selectedSauce}` : '',
      itemNotes.trim(),
    ].filter(Boolean).join(' • ');

    const newItem: OrderItem = {
      menuItemId: selectedMenuForCustomization.id,
      menuItemName: selectedMenuForCustomization.name,
      price: effectivePrice,
      quantity,
      sweetness,
      drinkType: selectedMenuForCustomization.allowIcedOrBlended === false ? 'blended' : drinkType,
      selectedToppings,
      notes: fullNotes,
      selectedSauce: selectedSauce || undefined,
    };

    setCart([...cart, newItem]);
    setSelectedMenuForCustomization(null);
    setIsCartOpen(true);
  };

  // Remove from cart
  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Handle mock slip upload
  const handleSlipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Order
  const handlePlaceOrder = () => {
    if (!customerName.trim() || !customerPhone.trim() || !addressDetails.trim()) {
      alert('กรุณากรอกชื่อ เบอร์โทร และรายละเอียดที่อยู่จัดส่งให้ครบถ้วน');
      return;
    }
    if (cart.length === 0) return;

    setIsSubmitting(true);

    const orderNumber = `#D${Math.floor(10 + Math.random() * 90)}`;
    const newOrder = createOrder({
      orderNumber,
      channel: 'online',
      items: cart,
      subtotal,
      deliveryFee,
      discount: 0,
      totalAmount,
      paymentMethod: 'promptpay',
      paymentStatus: 'paid',
      isDelivery: true,
      deliveryInfo: {
        customerName: customerName.trim(),
        phone: customerPhone.trim(),
        address: `${deliveryLocationName} - ${addressDetails.trim()}`,
        landmarkName: deliveryLocationName,
        latitude: deliveryLat,
        longitude: deliveryLng,
        distanceKm: deliveryDistanceKm,
        deliveryFee,
        slipImage: slipFile || undefined,
      },
    });

    setActiveCustomerOrderId(newOrder.id);
    setCart([]);
    setIsCartOpen(false);
    setIsSubmitting(false);
  };

  const categories = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'coconut', label: '🥥 ปั่นมะพร้าว' },
    { id: 'fresh_milk', label: '🥛 ปั่นนมสด' },
    { id: 'yogurt', label: '🍓 ปั่นโยเกิร์ต' },
    { id: 'bear_milk', label: '🧸 ปั่นนมหมี' },
    { id: 'tea_coffee', label: '☕ ชา–กาแฟ' },
    { id: 'italian_soda', label: '🍹 อิตาเลียนโซดา' },
    { id: 'smoothie', label: '🥤 สมูทตี้' },
    { id: 'whip_cream', label: '🍦 วิปครีม' },
    { id: 'toast', label: '🍞 เมนูปัง' },
  ];

  const filteredMenu =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((m) => m.category === selectedCategory);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-stone-50 pb-24">
      {/* Top Banner & Shop Info */}
      <header className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white p-4 rounded-b-3xl shadow-sm">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <span className="text-3xl mt-0.5">🥤</span>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">
                {shopLocation.name}
              </h1>
              <p className="text-xs text-amber-100 flex items-center gap-1 mt-0.5 line-clamp-2">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-amber-200" />
                <span>{shopLocation.address}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
              <span>เปิดรับออเดอร์</span>
            </div>

            {isCustomerOnlyView ? (
              <button
                type="button"
                onClick={() => setIsCustomerOnlyView(false)}
                className="bg-white/20 hover:bg-white/30 active:scale-95 text-white px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all border border-white/20"
                title="กลับสู่ระบบร้านค้า"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>กลับหน้าร้าน</span>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsQRModalOpen(true)}
                  title="คิวอาร์สั่งซื้อสำหรับลูกค้า"
                  className="bg-white/20 hover:bg-white/30 active:scale-95 text-white px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QR สั่ง</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsShopLocationModalOpen(true)}
                  title="กรอกข้อมูลที่ตั้งร้านเอง (ไม่ต้องปักหมุด)"
                  className="bg-white/20 hover:bg-white/30 active:scale-95 text-white px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>ที่ตั้งร้าน</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Promo / Delivery info */}
        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Bike className="w-4 h-4 text-amber-200" />
            <span>มีทั้งเมนูปั่น & เย็น • ส่งด่วนรอบ ม.อุบล</span>
          </div>
          <span className="text-amber-200 font-semibold bg-white/20 px-2 py-0.5 rounded-md text-[11px]">
            ส่งฟรีระยะ 0-500 ม.
          </span>
        </div>
      </header>

      {/* Floating Order Tracking Bar if user has active order */}
      {activeOrder && activeOrder.status !== 'voided' && (
        <div className="mx-4 -mt-3 mb-4 bg-white rounded-2xl p-3.5 shadow-md border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                ออเดอร์ {activeOrder.orderNumber}
              </span>
              <span className="text-xs text-stone-500">
                {new Date(activeOrder.createdAt).toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <span className="text-xs font-semibold text-stone-800">
              ฿{activeOrder.totalAmount}
            </span>
          </div>

          {/* Status Tracker Steps */}
          <div className="flex items-center justify-between text-[11px] pt-1">
            <div
              className={`flex flex-col items-center gap-1 ${
                activeOrder.status === 'queued' ? 'text-amber-600 font-bold' : 'text-stone-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  ['queued', 'blending', 'blended', 'out_for_delivery', 'completed'].includes(
                    activeOrder.status
                  )
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-200'
                }`}
              >
                1
              </div>
              <span>รับคิว</span>
            </div>
            <div className="h-0.5 w-6 bg-stone-200"></div>

            <div
              className={`flex flex-col items-center gap-1 ${
                activeOrder.status === 'blending' ? 'text-amber-600 font-bold' : 'text-stone-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  ['blending', 'blended', 'out_for_delivery', 'completed'].includes(activeOrder.status)
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-200'
                }`}
              >
                2
              </div>
              <span>กำลังปั่น</span>
            </div>
            <div className="h-0.5 w-6 bg-stone-200"></div>

            <div
              className={`flex flex-col items-center gap-1 ${
                activeOrder.status === 'out_for_delivery'
                  ? 'text-sky-600 font-bold'
                  : 'text-stone-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  ['out_for_delivery', 'completed'].includes(activeOrder.status)
                    ? 'bg-sky-600 text-white'
                    : 'bg-stone-200'
                }`}
              >
                3
              </div>
              <span>ไรเดอร์นำส่ง</span>
            </div>
            <div className="h-0.5 w-6 bg-stone-200"></div>

            <div
              className={`flex flex-col items-center gap-1 ${
                activeOrder.status === 'completed'
                  ? 'text-emerald-600 font-bold'
                  : 'text-stone-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  activeOrder.status === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-200'
                }`}
              >
                ✓
              </div>
              <span>จัดส่งสำเร็จ</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
            <span>
              {activeOrder.status === 'queued' && '⏳ คิวกำลังรอปั่นตามลำดับ'}
              {activeOrder.status === 'blending' && '🥤 พนักงานกำลังปั่นน้ำสมูทตี้สดใหม่'}
              {activeOrder.status === 'blended' && '✨ ปั่นเสร็จแล้ว พร้อมส่งต่อไรเดอร์'}
              {activeOrder.status === 'out_for_delivery' && '🛵 ไรเดอร์กำลังเดินทางไปส่งคุณ'}
              {activeOrder.status === 'completed' && '🎉 ได้รับเรียบร้อย อร่อยสดชื่นนะครับ!'}
            </span>
            <button
              type="button"
              onClick={() => setActiveCustomerOrderId(null)}
              className="text-[11px] text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors"
              title="สั่งรายการเพิ่มหรือกลับไปดูเมนู"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>สั่งเพิ่ม / ดูเมนู</span>
            </button>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="px-4 grid grid-cols-1 gap-3">
        {filteredMenu.map((item) => {
          const avail = checkMenuAvailability(item.bom, ingredients);
          const isOutOfStock = !avail.available;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl p-3.5 border transition-all flex gap-3.5 relative overflow-hidden ${
                isOutOfStock
                  ? 'border-stone-200 opacity-60 bg-stone-50'
                  : 'border-stone-200/80 shadow-xs hover:border-amber-400'
              }`}
            >
              {/* Product Emoji / Visual */}
              <div className="w-20 h-20 bg-amber-50 rounded-xl flex-shrink-0 flex items-center justify-center text-4xl border border-amber-100/60">
                {item.image}
              </div>

              {/* Product Info */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <h2 className="font-semibold text-stone-900 text-sm truncate leading-snug">
                      {item.name}
                    </h2>
                    <span className="font-bold text-amber-700 text-sm whitespace-nowrap">
                      {item.blendedPrice ? `฿${item.basePrice} / ฿${item.blendedPrice}` : `฿${item.basePrice}`}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 mt-2 pt-1 border-t border-stone-100">
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                    <span>{item.baseCalories} kcal</span>
                    <span className="text-stone-300">•</span>
                    {item.allowIcedOrBlended === false ? (
                      <span className="text-amber-800 font-medium">
                        {item.category === 'toast' ? '🍞 ขนมปังปิ้ง' : '🍦 วิปครีม 12 oz.'}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        {item.blendedPrice ? `เย็น ฿${item.basePrice} / ปั่น ฿${item.blendedPrice}` : 'ปั่นหรือเย็น'}
                      </span>
                    )}
                  </div>

                  {isOutOfStock ? (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {avail.missingIngredientName ? `${avail.missingIngredientName} หมด` : 'สินค้าหมด'}
                    </span>
                  ) : item.allowIcedOrBlended === false ? (
                    <button
                      type="button"
                      onClick={() => handleOpenCustomize(item, 'blended')}
                      className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1"
                    >
                      <span>สั่งซื้อ ฿{item.basePrice}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenCustomize(item, 'blended')}
                        title="สั่งแบบปั่นสมูทตี้"
                        className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1"
                      >
                        <span>🥤 ปั่น {item.blendedPrice ? `฿${item.blendedPrice}` : ''}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCustomize(item, 'iced')}
                        title="สั่งแบบเย็นใส่น้ำแข็ง ไม่ปั่น"
                        className="bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1"
                      >
                        <span>🧊 เย็น ฿{item.basePrice}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Customization Modal */}
      {selectedMenuForCustomization && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
            {/* Modal Header */}
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedMenuForCustomization.image}</span>
                <div>
                  <h2 className="font-bold text-stone-900 text-sm">
                    {selectedMenuForCustomization.name}
                  </h2>
                  <span className="text-xs font-bold text-amber-700">
                    {selectedMenuForCustomization.blendedPrice
                      ? `เย็น ฿${selectedMenuForCustomization.basePrice} / ปั่น ฿${selectedMenuForCustomization.blendedPrice}`
                      : `฿${selectedMenuForCustomization.basePrice}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMenuForCustomization(null)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customization Options Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Sauce Options (e.g. Whip Cream) */}
              {selectedMenuForCustomization.sauceOptions && selectedMenuForCustomization.sauceOptions.length > 0 && (
                <div>
                  <label className="font-bold text-stone-800 block mb-2">
                    เลือกซอสราด (ฟรี 1 อย่าง)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedMenuForCustomization.sauceOptions.map((sauce) => (
                      <button
                        key={sauce}
                        type="button"
                        onClick={() => setSelectedSauce(sauce)}
                        className={`py-2 px-1 rounded-xl border text-center font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                          selectedSauce === sauce
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {selectedSauce === sauce && <Check className="w-3.5 h-3.5" />}
                        <span>{sauce}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Toast info note */}
              {selectedMenuForCustomization.category === 'toast' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-800 text-[11px] flex items-center gap-2">
                  <span>🍞</span>
                  <span>เมนูปังปิ้งเสิร์ฟ 2 แผ่น ปิ้งกรอบนอกนุ่มใน ทาเนยหอมๆ ฉ่ำๆ</span>
                </div>
              )}

              {/* Sweetness Level - for drinks */}
              {selectedMenuForCustomization.category !== 'toast' && selectedMenuForCustomization.category !== 'whip_cream' && (
                <div>
                  <label className="font-bold text-stone-800 block mb-2">
                    เลือกระดับความหวาน (Sweetness Level)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['0%', '25%', '50%', '100%'] as SweetnessLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSweetness(level)}
                        className={`py-2 rounded-xl border text-center transition-all font-medium ${
                          sweetness === level
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <div className="text-xs font-bold">{level}</div>
                        <div className="text-[10px] opacity-80">
                          {level === '0%' && 'ไม่หวาน'}
                          {level === '25%' && 'หวาน 25%'}
                          {level === '50%' && 'หวาน 50%'}
                          {level === '100%' && 'หวานปกติ'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type: Blended or Iced - if drink supports both */}
              {selectedMenuForCustomization.allowIcedOrBlended !== false && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-bold text-stone-800">
                      ประเภทเครื่องดื่ม (ปั่น หรือ เย็น)
                    </label>
                    <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                      {selectedMenuForCustomization.blendedPrice
                        ? `ปั่น ฿${selectedMenuForCustomization.blendedPrice} / เย็น ฿${selectedMenuForCustomization.basePrice}`
                        : 'ราคาเท่ากันทั้ง 2 แบบ'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDrinkType('blended')}
                      className={`py-3 px-2 rounded-2xl border text-center transition-all font-semibold flex flex-col items-center justify-center gap-1 ${
                        drinkType === 'blended'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <span className="text-xl">🥤</span>
                      <span className="text-xs">ปั่นเนื้อเนียน {selectedMenuForCustomization.blendedPrice ? `(฿${selectedMenuForCustomization.blendedPrice})` : ''}</span>
                      <span
                        className={`text-[10px] ${
                          drinkType === 'blended' ? 'text-amber-100' : 'text-stone-400'
                        }`}
                      >
                        สมูทตี้ปั่นสด
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrinkType('iced')}
                      className={`py-3 px-2 rounded-2xl border text-center transition-all font-semibold flex flex-col items-center justify-center gap-1 ${
                        drinkType === 'iced'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-300'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <span className="text-xl">🧊</span>
                      <span className="text-xs">เสิร์ฟเย็น (฿{selectedMenuForCustomization.basePrice})</span>
                      <span
                        className={`text-[10px] ${
                          drinkType === 'iced' ? 'text-sky-100' : 'text-stone-400'
                        }`}
                      >
                        ใส่น้ำแข็ง ไม่ปั่น
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Add Toppings */}
              <div>
                <label className="font-bold text-stone-800 block mb-2">
                  เพิ่มท็อปปิ้ง (Topping Extra)
                </label>
                <div className="space-y-1.5">
                  {TOPPINGS.map((top) => {
                    const isChecked = selectedToppings.some((t) => t.id === top.id);
                    return (
                      <button
                        key={top.id}
                        type="button"
                        onClick={() => handleToggleTopping(top)}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                          isChecked
                            ? 'bg-amber-50 border-amber-500 text-amber-900 font-medium'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isChecked
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'border-stone-400 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <span>{top.name}</span>
                        </div>
                        <span className="font-semibold text-amber-700">+฿{top.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-stone-800 block mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="เช่น แยกน้ำแข็ง, ปั่นเนื้อเนียนพิเศษ, หวานน้อย..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-600 text-xs"
                />
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-stone-800">จำนวน</span>
                <div className="flex items-center gap-3 bg-stone-100 px-3 py-1.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-stone-700 hover:bg-stone-200"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-stone-900 text-sm min-w-5 text-center">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-stone-700 hover:bg-stone-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-stone-500">
                  {selectedMenuForCustomization.category === 'toast' || selectedMenuForCustomization.category === 'whip_cream'
                    ? 'ราคารวมชุดนี้'
                    : 'ราคารวมแก้วนี้'}
                </div>
                <div className="text-base font-bold text-amber-800">
                  ฿
                  {(
                    ((selectedMenuForCustomization.blendedPrice && drinkType === 'blended'
                      ? selectedMenuForCustomization.blendedPrice
                      : selectedMenuForCustomization.basePrice) +
                      selectedToppings.reduce((s, t) => s + t.price, 0)) *
                    quantity
                  ).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-xs"
              >
                ใส่ตะกร้า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-40">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-stone-900 text-white py-3.5 px-4 rounded-2xl shadow-xl flex items-center justify-between font-medium active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <span className="absolute -top-2 -right-2 bg-amber-500 text-stone-950 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <span className="text-sm font-semibold">ตะกร้าสั่งซื้อน้ำปั่น</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-300 font-bold text-sm">฿{subtotal}</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg">ดูตะกร้า →</span>
            </div>
          </button>
        </div>
      )}

      {/* Checkout Drawer / Cart Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
            {/* Header */}
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
                <h2 className="font-bold text-stone-900 text-sm">
                  ตะกร้าและจุดจัดส่งรอบ ม.อุบล
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Cart Items List */}
              <div className="space-y-2">
                <div className="font-bold text-stone-800 text-xs flex justify-between">
                  <span>รายการน้ำปั่นในตะกร้า ({cart.length} รายการ)</span>
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-stone-400 hover:text-red-600 text-[11px]"
                  >
                    ล้างตะกร้า
                  </button>
                </div>

                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-stone-50 p-3 rounded-xl border border-stone-200/70 flex items-start justify-between gap-2"
                  >
                    <div className="flex-1">
                      <div className="font-bold text-stone-800">
                        {item.menuItemName} x{item.quantity}
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        {item.selectedSauce ? (
                          <span className="text-amber-700 font-medium">ซอส{item.selectedSauce}</span>
                        ) : (
                          <span>{item.drinkType === 'blended' ? '🥤 ปั่น' : '🧊 เย็น'} • หวาน {item.sweetness}</span>
                        )}
                        {item.selectedToppings.length > 0 &&
                          ` • ท็อปปิ้ง: ${item.selectedToppings.map((t) => t.name).join(', ')}`}
                      </div>
                      {item.notes && (
                        <div className="text-[10px] text-amber-700 italic mt-0.5">
                          โน้ต: {item.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex flex-col items-end justify-between h-full">
                      <span className="font-bold text-stone-900 text-xs">
                        ฿
                        {(item.price +
                          item.selectedToppings.reduce((s, t) => s + t.price, 0)) *
                          item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(idx)}
                        className="text-[10px] text-red-500 hover:underline mt-1"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Address Section (Manual Input without mandatory pin) */}
              <div className="pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    <span>จุดจัดส่ง & ที่อยู่นัดรับ (กรอกได้เอง ไม่ต้องปักหมุด)</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    {deliveryFee === 0 ? 'ส่งฟรี' : `ค่าส่ง ฿${deliveryFee}`}
                  </span>
                </div>

                {/* Quick Delivery Presets for UBU */}
                <div className="mb-2.5">
                  <span className="text-[11px] text-stone-500 block mb-1.5">
                    แตะเลือกจุดส่งยอดนิยม (หรือพิมพ์ระบุเองด้านล่าง):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        name: 'รับหน้าร้าน (หน้า ม. แถวบิวตี้)',
                        dist: 0.0,
                        fee: 0,
                        lat: shopLocation.lat || 15.1192,
                        lng: shopLocation.lng || 104.9036,
                        label: '🏠 หน้าร้าน (ฟรี)',
                      },
                      {
                        name: 'ประตู 1 ม.อุบลราชธานี',
                        dist: 0.3,
                        fee: 0,
                        lat: 15.1205,
                        lng: 104.9048,
                        label: '🏫 ประตู 1 (ฟรี)',
                      },
                      {
                        name: 'ประตู 2 ม.อุบล (ฝั่งหอใน)',
                        dist: 0.9,
                        fee: 10,
                        lat: 15.1228,
                        lng: 104.9082,
                        label: '🏢 ประตู 2/หอใน (฿10)',
                      },
                      {
                        name: 'หอพักเจริญศรี / หลัง ม.อุบล',
                        dist: 1.5,
                        fee: 15,
                        lat: 15.1245,
                        lng: 104.912,
                        label: '🏡 หลังมอ/เจริญศรี (฿15)',
                      },
                      {
                        name: 'คณะพยาบาลฯ / เภสัชศาสตร์ ม.อุบล',
                        dist: 0.8,
                        fee: 10,
                        lat: 15.118,
                        lng: 104.909,
                        label: '🏥 พยาบาล/เภสัช (฿10)',
                      },
                      {
                        name: 'คณะวิศวะฯ / เกษตรฯ ม.อุบล',
                        dist: 1.2,
                        fee: 15,
                        lat: 15.115,
                        lng: 104.911,
                        label: '🚜 วิศวะ/เกษตร (฿15)',
                      },
                      {
                        name: 'เซเว่นเมืองศรีไค / สี่แยกโนนโหนน',
                        dist: 2.1,
                        fee: 20,
                        lat: 15.111,
                        lng: 104.898,
                        label: '🛒 7-11 เมืองศรีไค (฿20)',
                      },
                    ].map((preset) => {
                      const isSelected = deliveryLocationName === preset.name;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setDeliveryLocationName(preset.name);
                            setDeliveryDistanceKm(preset.dist);
                            setDeliveryFee(preset.fee);
                            setDeliveryLat(preset.lat);
                            setDeliveryLng(preset.lng);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Manual Address Input Field */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                      จุดส่ง / หอพัก / อาคารคณะ (พิมพ์ระบุเองได้) *
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น หน้าประตู 1 / หอหญิง 7 / ใต้ตึกคณะศิลปศาสตร์"
                      value={deliveryLocationName}
                      onChange={(e) => {
                        setDeliveryLocationName(e.target.value);
                        // If custom text, set reasonable default fee if not already set
                        if (deliveryFee === 0 && !e.target.value.includes('หน้าร้าน') && !e.target.value.includes('ประตู 1')) {
                          setDeliveryFee(10);
                          setDeliveryDistanceKm(0.8);
                        }
                      }}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:border-amber-600 text-xs font-medium text-stone-900"
                    />
                  </div>

                  {/* Customer Contact Inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                        ชื่อผู้รับ *
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น น้องมุก / อ.สมชาย"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:border-amber-600 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                        เบอร์โทรศัพท์ติดต่อ *
                      </label>
                      <input
                        type="tel"
                        placeholder="08x-xxx-xxxx"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:border-amber-600 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                      รายละเอียดห้อง / ชั้น / จุดสังเกต *
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ห้อง 305 ชั้น 3 ฝั่งบันได / โทรหาเมื่อถึงหน้าป้อมยาม"
                      value={addressDetails}
                      onChange={(e) => setAddressDetails(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:border-amber-600 text-xs"
                    />
                  </div>
                </div>

                {/* Optional Collapsible Map Picker (not required) */}
                <div className="mt-2.5 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(!showMapPicker)}
                    className="w-full py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-600 text-[11px] font-medium rounded-xl flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <span>🗺️ หรือเปิดแผนที่ปักหมุด GPS (ถ้าต้องการ)</span>
                      <span className="text-[10px] text-stone-400 font-normal">ไม่ต้องปักหมุดก็ได้</span>
                    </span>
                    {showMapPicker ? (
                      <ChevronUp className="w-3.5 h-3.5 text-stone-500" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                    )}
                  </button>

                  {showMapPicker && (
                    <div className="mt-2 animate-in fade-in duration-200">
                      <DeliveryMap
                        selectedLat={deliveryLat}
                        selectedLng={deliveryLng}
                        selectedName={deliveryLocationName}
                        onLocationSelect={(lat, lng, name, dist, fee) => {
                          setDeliveryLat(lat);
                          setDeliveryLng(lng);
                          setDeliveryLocationName(name);
                          setDeliveryDistanceKm(dist);
                          setDeliveryFee(fee);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Section (PromptPay QR & Slip Upload) */}
              <div className="pt-2 border-t border-stone-100">
                <div className="font-bold text-stone-800 text-xs mb-2">
                  ชำระเงินผ่านพร้อมเพย์ QR Code
                </div>

                <PromptPayQR
                  amount={totalAmount}
                  phoneOrId={shopLocation.promptPayId}
                  shopName={shopLocation.name}
                />

                {/* Slip upload */}
                <div className="mt-3 bg-stone-50 p-3 rounded-2xl border border-dashed border-stone-300 text-center">
                  <input
                    type="file"
                    id="slip-upload"
                    accept="image/*"
                    onChange={handleSlipUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="slip-upload"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <Upload className="w-5 h-5 text-stone-400" />
                    <span className="font-semibold text-stone-700 text-xs">
                      {slipFile ? '✓ แนบสลิปเรียบร้อยแล้ว (แตะเพื่อเปลี่ยน)' : 'แตะเพื่อแนบรูปสลิปการโอนเงิน'}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      รองรับภาพ JPG, PNG จากแอปธนาคาร
                    </span>
                  </label>
                  {slipFile && (
                    <div className="mt-2 inline-block relative">
                      <img
                        src={slipFile}
                        alt="Slip preview"
                        className="h-20 w-auto rounded-lg border border-stone-200 object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Breakdown */}
              <div className="bg-stone-50 p-3 rounded-2xl space-y-1.5 border border-stone-200">
                <div className="flex justify-between text-stone-600">
                  <span>ค่าน้ำปั่นรวม</span>
                  <span>฿{subtotal}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>ค่าจัดส่ง ({deliveryDistanceKm} กม.)</span>
                  <span className={deliveryFee === 0 ? 'text-emerald-600 font-bold' : ''}>
                    {deliveryFee === 0 ? 'ฟรี' : `฿${deliveryFee}`}
                  </span>
                </div>
                <div className="flex justify-between text-stone-900 font-bold text-sm pt-1.5 border-t border-stone-200">
                  <span>ยอดสุทธิ</span>
                  <span className="text-amber-700">฿{totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Footer Place Order */}
            <div className="p-4 border-t border-stone-100 bg-white">
              <button
                type="button"
                disabled={isSubmitting || cart.length === 0}
                onClick={handlePlaceOrder}
                className="w-full bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold py-3 px-4 rounded-2xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ยืนยันการสั่งซื้อและจัดส่ง (฿{totalAmount})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Footer */}
      <footer className="mt-8 pt-6 pb-12 text-center text-xs text-stone-400 border-t border-stone-200/60 px-4 space-y-2">
        <p className="font-semibold text-stone-600">
          🥤 {shopLocation.name}
        </p>
        <p className="text-[11px] text-stone-400 max-w-xs mx-auto">
          {shopLocation.address} • โทร {shopLocation.phone}
        </p>
        <p className="text-[10px] text-stone-400">
          เปิดให้บริการทุกวัน สั่งสดปั่นแก้วต่อแก้ว พร้อมจัดส่งรอบมหาวิทยาลัย
        </p>

        {/* Subtle staff switch link */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => setIsCustomerOnlyView(!isCustomerOnlyView)}
            className="text-[10px] text-stone-400 hover:text-stone-700 underline decoration-stone-300 transition-colors"
          >
            {isCustomerOnlyView
              ? '🔒 สำหรับพนักงาน / เจ้าของร้าน: เข้าสู่ระบบจัดการร้าน'
              : '📱 สลับไปมุมมองลูกค้าเฉพาะเมนู'}
          </button>
        </div>
      </footer>

      {/* QR Code Modal for Customer Ordering */}
      <CustomerOrderQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
      />

      {/* Shop Location & Address Text Modal */}
      <ShopLocationModal
        isOpen={isShopLocationModalOpen}
        onClose={() => setIsShopLocationModalOpen(false)}
      />
    </div>
  );
};
