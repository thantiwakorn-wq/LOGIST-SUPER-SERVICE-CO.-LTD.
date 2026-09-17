import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bike,
  Phone,
  MapPin,
  Navigation,
  ExternalLink,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  AlertCircle,
  Package,
} from 'lucide-react';

export const RiderView: React.FC = () => {
  const { orders, updateOrderStatus, shopLocation } = useApp();

  // Rider only handles delivery orders that are ready ('blended') or already on the road ('out_for_delivery')
  const deliveryOrders = orders.filter(
    (o) =>
      o.isDelivery &&
      (o.status === 'blended' || o.status === 'out_for_delivery' || o.status === 'completed')
  );

  const activeDeliveries = deliveryOrders.filter((o) => o.status !== 'completed');
  const completedDeliveries = deliveryOrders.filter((o) => o.status === 'completed');

  const [activeTab, setActiveTab] = useState<'pending' | 'done'>('pending');

  const shopLat = shopLocation.lat || 15.1192;
  const shopLng = shopLocation.lng || 104.9036;

  return (
    <div className="max-w-md mx-auto p-3 sm:p-4 space-y-4 pb-16">
      {/* Top Rider Cockpit Header */}
      <div className="bg-stone-900 text-white p-4 rounded-3xl shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center font-bold">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Rider Cockpit</h1>
              <p className="text-xs text-sky-200">สายส่งน้ำปั่น ม.อุบล - วารินชำราบ</p>
            </div>
          </div>

          <div className="bg-sky-900/60 border border-sky-700 px-3 py-1 rounded-full text-xs font-semibold text-sky-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>พร้อมวิ่งงาน</span>
          </div>
        </div>

        {/* Quick Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-stone-800 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            ออเดอร์พร้อมส่ง ({activeDeliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('done')}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'done'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            ส่งสำเร็จแล้ว ({completedDeliveries.length})
          </button>
        </div>
      </div>

      {/* List of Orders */}
      {activeTab === 'pending' ? (
        activeDeliveries.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-stone-200 shadow-xs">
            <div className="text-4xl mb-2">🛵</div>
            <h2 className="font-bold text-stone-700 text-sm">ยังไม่มีออเดอร์ที่พร้อมส่ง</h2>
            <p className="text-xs text-stone-400 mt-1">
              เมื่อโซนครัวปั่นน้ำเสร็จแล้ว (สถานะ &quot;ปั่นเสร็จแล้ว&quot;) จะเด้งเข้าสู่รายการนี้ทันที
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeDeliveries.map((order) => {
              const info = order.deliveryInfo;
              const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${shopLat},${shopLng}&destination=${info?.latitude || shopLat},${info?.longitude || shopLng}&travelmode=driving`;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl p-4 border border-stone-200 shadow-sm space-y-3.5"
                >
                  {/* Card Top */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-stone-900">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          order.status === 'out_for_delivery'
                            ? 'bg-amber-100 text-amber-900 animate-pulse'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {order.status === 'out_for_delivery'
                          ? 'กำลังนำส่งอยู่'
                          : 'ปั่นเสร็จแล้ว พร้อมรับของ'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-stone-900 block">
                        ฿{order.totalAmount}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        (ค่าส่ง ฿{order.deliveryFee})
                      </span>
                    </div>
                  </div>

                  {/* Customer Info Card */}
                  <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-stone-900 text-sm">
                        {info?.customerName || 'ลูกค้า'}
                      </div>
                      {info?.phone && (
                        <a
                          href={`tel:${info.phone}`}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-xl font-semibold flex items-center gap-1.5 shadow-xs"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{info.phone}</span>
                        </a>
                      )}
                    </div>

                    {/* Address */}
                    <div className="flex items-start gap-2 text-stone-700">
                      <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <span className="font-semibold text-stone-900 block">
                          {info?.landmarkName || 'จุดจัดส่ง'}
                        </span>
                        <span className="text-stone-600 text-[11px]">{info?.address}</span>
                      </div>
                    </div>

                    {/* Distance */}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-200 text-[11px] text-stone-500">
                      <span className="flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5 text-sky-600" />
                        ระยะทางจากร้าน: {info?.distanceKm || 0} กม.
                      </span>
                      <span>ชำระแล้ว (พร้อมเพย์)</span>
                    </div>
                  </div>

                  {/* Drink Items Checklist */}
                  <div className="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-200 text-xs">
                    <div className="font-bold text-amber-900 mb-1 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      <span>รายการน้ำปั่นที่ต้องส่ง ({order.items.length} อย่าง):</span>
                    </div>
                    <ul className="space-y-1 text-stone-700 text-[11px]">
                      {order.items.map((item, iIdx) => (
                        <li key={iIdx} className="flex justify-between">
                          <span>
                            • {item.menuItemName} x{item.quantity} (หวาน {item.sweetness})
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              item.drinkType === 'blended'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {item.drinkType === 'blended' ? '🥤 ปั่น' : '🧊 เย็น'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Buttons: 1) Google Maps Navigation, 2) Status Update */}
                  <div className="space-y-2 pt-1">
                    {/* 1-Tap Google Maps Turn-by-Turn Navigation */}
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 font-bold py-2.5 rounded-xl shadow-xs text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <Navigation className="w-4 h-4 text-sky-600" />
                      <span>เปิด Google Maps นำทางไปยังจุดส่ง</span>
                      <ExternalLink className="w-3 h-3 text-stone-400" />
                    </a>

                    {/* Status Toggle Buttons */}
                    {order.status === 'blended' && (
                      <button
                        type="button"
                        onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}
                        className="w-full bg-sky-600 hover:bg-sky-700 active:scale-98 text-white font-bold py-3 rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <Bike className="w-4 h-4" />
                        <span>กำลังออกไปส่ง (แจ้งลูกค้าทันที)</span>
                      </button>
                    )}

                    {order.status === 'out_for_delivery' && (
                      <button
                        type="button"
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold py-3 rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>จัดส่งสำเร็จเรียบร้อย (ปิดงาน)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Completed History */
        <div className="space-y-2.5">
          {completedDeliveries.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-stone-200 text-xs text-stone-400">
              ยังไม่มีงานที่ส่งสำเร็จในวันนี้
            </div>
          ) : (
            completedDeliveries.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-3.5 border border-stone-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-stone-900 flex items-center gap-2">
                    <span>{order.orderNumber}</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-semibold">
                      ✓ จัดส่งแล้ว
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {order.deliveryInfo?.customerName} • {order.deliveryInfo?.landmarkName}
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-stone-900 block">฿{order.totalAmount}</span>
                  <span className="text-[10px] text-stone-400">
                    ค่าส่ง ฿{order.deliveryFee}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
