export type StorageZone = 'chilled' | 'counter'; // 'chilled' = ตู้เย็น/ถังน้ำแข็ง (ผลไม้/นม/ของสด), 'counter' = เคาน์เตอร์ไม่คุมอุณหภูมิ (ผงชา ไซรัป แก้ว หลอด)

// ตำแหน่งจัดวางในเคาน์เตอร์บาร์น้ำปั่น (Workstation Slotting เพื่อลดระยะทางเดินหยิบ)
export type WorkstationSlot = 'golden_zone' | 'secondary_zone' | 'deep_storage';
// 'golden_zone' = ระยะเอื้อมมือ (0 ก้าว, ~0.4 ม. - หน้าโถปั่น/ระดับสายตา/ถาดผลไม้หลัก)
// 'secondary_zone' = ระยะ 1 ก้าว (1-2 ก้าว, ~1.2 ม. - ปีกเคาน์เตอร์ข้าง/ตู้แช่ชั้นล่าง)
// 'deep_storage' = ระยะไกล (4-6 ก้าว, ~3.5 ม. - ชั้นวางลึก/ใต้โต๊ะหลังร้าน)

export type ABCClass = 'A' | 'B' | 'C';

export interface Ingredient {
  id: string;
  name: string;
  category: 'fruit' | 'dairy' | 'sweetener' | 'topping' | 'packaging';
  zone: StorageZone; // ถังน้ำแข็ง/ตู้เย็น vs เคาน์เตอร์
  placementSlot?: WorkstationSlot; // ตำแหน่งจัดวางในเคาน์เตอร์บาร์
  manualPickCount?: number; // ความถี่การหยิบตั้งต้น/สะสม (ครั้ง)
  currentStock: number; // ปริมาณปัจจุบัน
  unit: string; // g, ml, ชิ้น, แก้ว
  minStock: number; // จุดสั่งซื้อปกติ (Safety Stock ปกติ)
  dynamicMinStock: number; // จุดสั่งซื้อที่ปรับแล้ว (เมื่อเกิด Spike)
  targetStock: number; // ระดับสต็อกที่อยากได้สำหรับรอบ 1 สัปดาห์
  costPerUnit: number; // บาท
  isSpike: boolean; // เป็นสินค้ากระแสพุ่งหรือไม่
  spikeReason?: string;
  shelfLifeDays?: number; // อายุวัตถุดิบ (วัน)
  expiryWarningDays?: number; // เตือนก่อนหมดอายุ
  isFavorite?: boolean; // ⭐ รายการโปรด / ของที่หยิบบ่อย
  updatedAt: string;
}

export interface BOMRequirement {
  ingredientId: string;
  baseAmount: number; // ปริมาณฐาน (เช่น สำหรับหวาน 100%)
  unit: string;
  // สัดส่วนปรับตามความหวาน เช่น น้ำเชื่อม: 0% = 0, 25% = 5ml, 50% = 10ml, 100% = 20ml
  scalesWithSweetness?: boolean;
}

export type MenuCategory =
  | 'all'
  | 'coconut'
  | 'fresh_milk'
  | 'yogurt'
  | 'bear_milk'
  | 'tea_coffee'
  | 'italian_soda'
  | 'smoothie'
  | 'whip_cream'
  | 'toast'
  | string;

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  basePrice: number;
  blendedPrice?: number; // ราคาปั่น (กรณีราคาเย็น/ปั่นไม่เท่ากัน เช่น 30 / 35 บาท)
  image: string; // emoji or clean url
  description: string;
  bom: BOMRequirement[]; // วัตถุดิบที่ต้องใช้
  defaultSweetness: SweetnessLevel;
  allowIcedOrBlended: boolean;
  baseCalories?: number;
  sauceOptions?: string[]; // ตัวเลือกซอส เช่น วิปครีม 12 oz
}

export type SweetnessLevel = '0%' | '25%' | '50%' | '100%';
export type DrinkType = 'blended' | 'iced'; // ปั่น หรือ เย็น

export interface Topping {
  id: string;
  name: string;
  price: number;
  ingredientId: string;
  amount: number;
  unit: string;
}

export interface OrderItem {
  menuItemId: string;
  menuItemName: string;
  price: number;
  quantity: number;
  sweetness: SweetnessLevel;
  drinkType: DrinkType;
  selectedToppings: Topping[];
  notes?: string;
  selectedSauce?: string;
}

export type OrderChannel = 'counter' | 'online'; // หน้าร้าน หรือ ออนไลน์
export type PaymentMethod = 'cash' | 'promptpay';
export type PaymentStatus = 'pending' | 'paid' | 'verified';

export type OrderStatus = 
  | 'queued'        // เข้าคิวรอปั่น
  | 'blending'      // กำลังปั่น (KDS)
  | 'blended'       // ปั่นเสร็จแล้ว
  | 'out_for_delivery' // ไรเดอร์กำลังนำส่ง (เฉพาะจัดส่ง)
  | 'completed'     // สำเร็จ (รับแล้ว/จัดส่งแล้ว)
  | 'voided';       // ยกเลิกออเดอร์ (คืนสต็อกแล้ว)

export interface CustomerDeliveryInfo {
  customerName: string;
  phone: string;
  address: string;
  landmarkName?: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  deliveryFee: number;
  slipImage?: string; // Data URL หรือจำลองสลิป
}

export interface Order {
  id: string;
  orderNumber: string; // เช่น #A01, #D05
  channel: OrderChannel;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  isDelivery: boolean;
  deliveryInfo?: CustomerDeliveryInfo;
  recipeNotes?: string;
  voidReason?: string;
}

export interface StockInRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  amount: number;
  unit: string;
  supplier?: string;
  cost?: number;
  timestamp: string;
  notes?: string;
}

export interface LineAlert {
  id: string;
  timestamp: string;
  type: 'spike' | 'low_stock' | 'reorder' | 'delivery' | 'expiry' | 'info';
  title: string;
  message: string;
  urgent: boolean;
}

export interface DeliveryLocationPreset {
  name: string;
  zone: string;
  lat: number;
  lng: number;
  defaultFee: number;
  distanceKm: number;
}

export interface ShopLocationConfig {
  name: string;
  address: string;
  phone: string;
  promptPayId: string;
  lat: number;
  lng: number;
}

export interface LineConfig {
  token: string;
  channelName: string;
  webhookUrl?: string;
  notifyLowStock: boolean;
  notifyOutOfStock: boolean;
  notifySpike: boolean;
  notifyNewOrder: boolean;
  notifyDailySummary: boolean;
  lastConnectedAt?: string;
}

