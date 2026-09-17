import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Order } from '../types';
import { playNewOrderChime } from '../utils/audio';
import {
  BellRing,
  X,
  Bike,
  Store,
  ChevronRight,
  Volume2,
  Phone,
  MapPin,
} from 'lucide-react';

interface NewOrderAlertBannerProps {
  order: Order | null;
  onDismiss: () => void;
}

export const NewOrderAlertBanner: React.FC<NewOrderAlertBannerProps> = ({
  order,
  onDismiss,
}) => {
  const { setActiveTab } = useApp();
  const [secondsLeft, setSecondsLeft] = useState(15);

  useEffect(() => {
    if (!order) return;

    // Play chime when new order alert pops up
    playNewOrderChime();
    setSecondsLeft(15);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [order, onDismiss]);

  if (!order) return null;

  const handleGoToDestination = () => {
    if (order.isDelivery) {
      setActiveTab('rider');
    } else {
      setActiveTab('kds');
    }
    onDismiss();
  };

  const isDelivery = order.isDelivery || order.channel === 'online';

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-3 sm:px-4 animate-in slide-in-from-top-6 duration-300">
      <div
        className={`rounded-3xl shadow-2xl border-2 p-4 text-white flex flex-col gap-3 relative overflow-hidden backdrop-blur-md ${
          isDelivery
            ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 border-orange-300 shadow-orange-950/40'
            : 'bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 border-emerald-300 shadow-emerald-950/40'
        }`}
      >
        {/* Pulsing Alert Top Bar */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center animate-bounce shadow-inner">
              <BellRing className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-wide">
                  🔔 มีออเดอร์ใหม่! {order.orderNumber}
                </span>
                <span className="bg-white/25 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {isDelivery ? '🛵 เดลิเวอรี่ (ส่งไรเดอร์)' : '🏪 หน้าร้าน (POS)'}
                </span>
              </div>
              <p className="text-xs text-white/90">
                {isDelivery
                  ? 'ลูกค้าสั่งจัดส่งรอบ ม.อุบล - เตรียมจัดส่ง!'
                  : 'ออเดอร์เข้าคิวในครัวแล้ว'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => playNewOrderChime()}
              title="ส่งเสียงเตือนอีกครั้ง"
              className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Order Details Body */}
        <div className="bg-black/20 rounded-2xl p-3 text-xs space-y-2 border border-white/10">
          <div className="flex items-center justify-between text-white font-medium">
            <span className="text-amber-100">
              {order.deliveryInfo?.customerName ? `ลูกค้า: ${order.deliveryInfo.customerName}` : 'ลูกค้าหน้าร้าน'}
              {order.deliveryInfo?.phone && (
                <span className="ml-2 font-mono text-[11px] text-white/80">
                  <Phone className="w-3 h-3 inline mr-0.5" />
                  {order.deliveryInfo.phone}
                </span>
              )}
            </span>
            <span className="text-base font-black text-amber-200">
              ฿{order.totalAmount}
            </span>
          </div>

          {/* Delivery destination if delivery */}
          {isDelivery && order.deliveryInfo && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-100 bg-white/10 p-2 rounded-xl">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-amber-300 mt-0.5" />
              <div>
                <span className="font-semibold text-white">
                  {order.deliveryInfo.landmarkName || order.deliveryInfo.address}
                </span>
                {order.deliveryInfo.address && order.deliveryInfo.landmarkName && (
                  <span className="block text-[10px] text-white/70">
                    {order.deliveryInfo.address}
                  </span>
                )}
                <span className="text-[10px] text-amber-200 font-bold block mt-0.5">
                  ค่าส่ง ฿{order.deliveryFee} • ระยะ ~{order.deliveryInfo.distanceKm} กม.
                </span>
              </div>
            </div>
          )}

          {/* Items Preview */}
          <div className="text-[11px] text-white/90 divide-y divide-white/10">
            {order.items.map((it, idx) => (
              <div key={idx} className="py-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">
                    {it.menuItemName} x{it.quantity}
                  </span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-semibold">
                    {it.drinkType === 'blended' ? '🥤 ปั่น' : '🧊 เย็น'}
                  </span>
                  <span className="text-[10px] text-white/80">
                    หวาน {it.sweetness}
                  </span>
                </div>
                <span className="font-mono">฿{it.price * it.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons: View in KDS or Rider */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[10px] text-white/70">
            ปิดอัตโนมัติใน {secondsLeft} วินาที
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-semibold text-xs rounded-xl transition-all"
            >
              รับทราบ
            </button>

            <button
              type="button"
              onClick={handleGoToDestination}
              className="px-3.5 py-1.5 bg-white hover:bg-white/90 active:scale-95 text-stone-900 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1"
            >
              {isDelivery ? (
                <>
                  <Bike className="w-3.5 h-3.5 text-orange-600" />
                  <span>ดูใบส่งของไรเดอร์</span>
                </>
              ) : (
                <>
                  <Store className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ดูในคิวครัว (KDS)</span>
                </>
              )}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
