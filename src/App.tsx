import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { CustomerPage } from './components/CustomerPage';
import { KitchenKDS } from './components/KitchenKDS';
import { RiderView } from './components/RiderView';
import { AdminInventory } from './components/AdminInventory';
import { CustomerOrderQRModal } from './components/CustomerOrderQRModal';
import { ShopLocationModal } from './components/ShopLocationModal';
import { NewOrderAlertBanner } from './components/NewOrderAlertBanner';
import {
  ShoppingBag,
  ChefHat,
  Bike,
  Package,
  RotateCcw,
  Sparkles,
  QrCode,
  MapPin,
  ArrowLeft,
  Cloud,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

function AppContent() {
  const {
    activeTab,
    setActiveTab,
    orders,
    ingredients,
    resetDemoData,
    shopLocation,
    isCustomerOnlyView,
    setIsCustomerOnlyView,
    canGoBack,
    goBack,
    syncStatus,
    lastSyncTime,
    forceSync,
  } = useApp();

  // Modals for Customer QR Deep-link & Shop Location text configuration
  const [showQRModal, setShowQRModal] = useState(false);
  const [showShopLocationModal, setShowShopLocationModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // If pos was previously active, redirect to customer view
  React.useEffect(() => {
    if (activeTab === 'pos') {
      setActiveTab('customer');
    }
  }, [activeTab, setActiveTab]);

  // Low stock count for badge
  const lowStockCount = ingredients.filter(
    (i) => i.currentStock <= (i.isSpike ? i.dynamicMinStock : i.minStock)
  ).length;

  // Active kitchen queue count
  const kdsCount = orders.filter(
    (o) => o.status === 'queued' || o.status === 'blending'
  ).length;

  // Ready delivery count for rider
  const riderCount = orders.filter(
    (o) => o.isDelivery && (o.status === 'blended' || o.status === 'out_for_delivery')
  ).length;

  // Pure Customer-Only Mode (scanned from QR code or customer link):
  // Customer sees ONLY the ordering menu, cart, and checkout — with an easy Back button to return to store management!
  if (isCustomerOnlyView) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col font-['Prompt',sans-serif] text-stone-900">
        {/* Easy Back Button to return to staff management portal */}
        <div className="sticky top-0 z-50 bg-stone-900/95 backdrop-blur-md text-white px-3.5 py-2.5 flex items-center justify-between shadow-md border-b border-stone-800">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← ย้อนกลับไประบบร้านค้า</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-stone-300">
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ออนไลน์ เชื่อมต่อร้านสด</span>
            </span>
            <span>🥤 {shopLocation.name}</span>
          </div>
        </div>
        <main className="flex-1 w-full">
          <CustomerPage />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-['Prompt',sans-serif] text-stone-900">
      {/* Top Global Role Switcher Bar (Mobile-first, touch-friendly) */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          {/* Quick Back Button */}
          {canGoBack && (
            <button
              type="button"
              onClick={goBack}
              title="ย้อนกลับ (Back)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-100/80 hover:bg-amber-200/90 border border-amber-300 transition-all active:scale-95 flex-shrink-0 cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-800" />
              <span>กลับ</span>
            </button>
          )}

          {/* Logo / Shop identity */}
          <div className="flex items-center gap-1.5 flex-shrink-0 pr-2 border-r border-stone-200">
            <span className="text-xl">🥤</span>
            <div className="hidden sm:block">
              <div className="text-xs font-bold leading-none text-stone-900 truncate max-w-[130px]">
                {shopLocation.name}
              </div>
              <div className="text-[10px] text-amber-700 font-medium leading-tight truncate max-w-[130px]">
                {shopLocation.address}
              </div>
            </div>
          </div>

          {/* Navigation Pills */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 justify-start sm:justify-center">
            {/* 1. Customer */}
            <button
              type="button"
              onClick={() => setActiveTab('customer')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'customer'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>ลูกค้าสั่ง (Web)</span>
            </button>

            {/* 2. Kitchen KDS */}
            <button
              type="button"
              onClick={() => setActiveTab('kds')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap relative ${
                activeTab === 'kds'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>คิวปั่น (KDS)</span>
              {kdsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {kdsCount}
                </span>
              )}
            </button>

            {/* 3. Rider */}
            <button
              type="button"
              onClick={() => setActiveTab('rider')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap relative ${
                activeTab === 'rider'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>ไรเดอร์ส่งของ</span>
              {riderCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {riderCount}
                </span>
              )}
            </button>

            {/* 4. Admin & Inventory */}
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap relative ${
                activeTab === 'admin'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>คลังสต็อก & BOM</span>
              {lowStockCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {lowStockCount}
                </span>
              )}
            </button>
          </div>

          {/* Quick utility actions: Real-time Cloud Sync, QR for customers & Edit Shop Location */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Real-time sync badge */}
            <button
              type="button"
              onClick={() => forceSync()}
              title={`สถานะการเชื่อมต่อ: ${
                syncStatus === 'synced'
                  ? 'ซิงค์เรียลไทม์กับทุกเครื่องแล้ว'
                  : syncStatus === 'syncing'
                  ? 'กำลังซิงค์ข้อมูล...'
                  : 'ออฟไลน์ (คลิกเพื่อเชื่อมต่อใหม่)'
              } ${lastSyncTime ? `(อัปเดตล่าสุด ${lastSyncTime})` : ''}`}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                syncStatus === 'synced'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : syncStatus === 'syncing'
                  ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                  : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500'
                    : 'bg-stone-400'
                }`}
              />
              <Cloud className="w-3 h-3 text-current hidden sm:inline" />
              <span className="hidden md:inline">
                {syncStatus === 'synced'
                  ? 'ซิงค์ทุกเครื่อง'
                  : syncStatus === 'syncing'
                  ? 'กำลังซิงค์...'
                  : 'ออฟไลน์'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowQRModal(true)}
              title="คิวอาร์สำหรับให้ลูกค้าสแกนสั่งซื้อ (เปิดหน้าสั่งซื้อทันที)"
              className="px-2 py-1.5 rounded-lg text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden lg:inline">QR สั่งซื้อ</span>
            </button>

            <button
              type="button"
              onClick={() => setShowShopLocationModal(true)}
              title="แก้ไขข้อมูลและที่ตั้งร้าน (กรอกเอง ไม่ต้องปักหมุด)"
              className="px-2 py-1.5 rounded-lg text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-colors flex items-center gap-1"
            >
              <MapPin className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden lg:inline">ที่ตั้งร้าน</span>
            </button>

            {/* Reset Demo State Button (Now with protective confirmation modal!) */}
            <button
              type="button"
              onClick={() => setShowResetConfirmModal(true)}
              title="รีเซ็ตข้อมูลตัวอย่าง (ต้องยืนยัน)"
              className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Global Instant Order Alert Banner (Bounces to Rider & Shop immediately) */}
      <NewOrderAlertBanner />

      {/* Main View Area */}
      <main className="flex-1 w-full">
        {activeTab === 'customer' && (
          <div className="bg-amber-50/90 border-b border-amber-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 max-w-md sm:max-w-2xl mx-auto rounded-b-xl shadow-xs my-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold">👁️ คุณกำลังดูในระบบร้านค้า</span>
              <span className="text-stone-500 hidden sm:inline">
                (เมื่อลูกค้าสแกน QR จะเห็นเฉพาะเมนู ไม่เห็นแถบด้านบนนี้)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCustomerOnlyView(true)}
              className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold px-3 py-1 rounded-xl text-xs flex items-center gap-1 shadow-xs transition-all ml-auto"
            >
              <span>📱 ดูหน้าลูกค้าจริง (เฉพาะเมนู)</span>
            </button>
          </div>
        )}
        {activeTab === 'customer' && <CustomerPage />}
        {activeTab === 'kds' && <KitchenKDS />}
        {activeTab === 'rider' && <RiderView />}
        {activeTab === 'admin' && <AdminInventory />}
      </main>

      {/* Modals rendered at app root */}
      <CustomerOrderQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
      />

      <ShopLocationModal
        isOpen={showShopLocationModal}
        onClose={() => setShowShopLocationModal(false)}
      />

      {/* Safe Reset Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900">
                  ยืนยันการรีเซ็ตข้อมูลระบบ?
                </h3>
                <p className="text-xs text-stone-500">
                  ระบบบันทึกข้อมูลล่าสุดของคุณไว้อยู่แล้ว
                </p>
              </div>
            </div>

            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 text-xs text-stone-600 space-y-2 leading-relaxed">
              <p>
                ⚠️ หากคุณกดยืนยัน ข้อมูลล่าสุดทั้งหมด ได้แก่ <strong>ออเดอร์ทั้งหมด, การตัดสต็อก, ประวัติรับของเข้า, และการปรับแต่งเมนู</strong> จะถูกล้างและแทนที่ด้วยข้อมูลตั้งต้นสำหรับการทดสอบ (Demo)
              </p>
              <p className="text-emerald-700 font-medium">
                💡 หากคุณต้องการใช้งานต่อตามปกติ ไม่ต้องกดรีเซ็ต ระบบจะจำข้อมูลล่าสุดไว้เสมอ ไม่หายไปไหนแม้ปิดหน้าจอ
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-all cursor-pointer"
              >
                ยกเลิก (คงข้อมูลล่าสุดไว้)
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={async () => {
                  setIsResetting(true);
                  await resetDemoData();
                  setIsResetting(false);
                  setShowResetConfirmModal(false);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังรีเซ็ต...</span>
                  </>
                ) : (
                  <span>ยืนยันรีเซ็ตค่าเริ่มต้น</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer info */}
      <footer className="bg-stone-200/60 border-t border-stone-200 py-3 px-4 text-center text-xs text-stone-500">
        <p>
          ระบบจัดการคลังสินค้าร้านน้ำปั่น & จัดส่ง • {shopLocation.name} ({shopLocation.address}) • บันทึกข้อมูลคลาวด์ ซิงค์เรียลไทม์ทุกเครื่อง
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
