import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Store, X, Save, MapPin, Phone, CreditCard, RotateCcw, Check } from 'lucide-react';
import { SHOP_LOCATION } from '../data/mockData';

interface ShopLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShopLocationModal: React.FC<ShopLocationModalProps> = ({ isOpen, onClose }) => {
  const { shopLocation, updateShopLocation } = useApp();

  const [name, setName] = useState(shopLocation.name);
  const [address, setAddress] = useState(shopLocation.address);
  const [phone, setPhone] = useState(shopLocation.phone);
  const [promptPayId, setPromptPayId] = useState(shopLocation.promptPayId);
  const [lat, setLat] = useState(shopLocation.lat?.toString() || '15.1192');
  const [lng, setLng] = useState(shopLocation.lng?.toString() || '104.9036');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(shopLocation.name);
      setAddress(shopLocation.address);
      setPhone(shopLocation.phone);
      setPromptPayId(shopLocation.promptPayId);
      setLat(shopLocation.lat?.toString() || '15.1192');
      setLng(shopLocation.lng?.toString() || '104.9036');
      setIsSaved(false);
    }
  }, [isOpen, shopLocation]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateShopLocation({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      promptPayId: promptPayId.trim(),
      lat: parseFloat(lat) || 15.1192,
      lng: parseFloat(lng) || 104.9036,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  const handleResetDefault = () => {
    setName(SHOP_LOCATION.name);
    setAddress(SHOP_LOCATION.address);
    setPhone(SHOP_LOCATION.phone);
    setPromptPayId(SHOP_LOCATION.promptPayId);
    setLat(SHOP_LOCATION.lat.toString());
    setLng(SHOP_LOCATION.lng.toString());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-4 sm:p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white leading-tight">
                กรอกข้อมูลที่ตั้งร้าน & ข้อมูลติดต่อ
              </h2>
              <p className="text-xs text-stone-300 mt-0.5">
                กรอกข้อความที่ตั้งร้านได้เอง ไม่ต้องปักหมุด
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-300 flex items-center justify-center transition-colors -mr-1 -mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Shop Name */}
          <div>
            <label className="font-bold text-stone-800 block mb-1.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-amber-600" />
              <span>ชื่อร้าน / สาขา</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ร้านน้ำปั่น สมูทตี้ ม.อุบล (สาขาหน้า ม. แถวบิวตี้)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs text-stone-900 bg-white"
            />
          </div>

          {/* Shop Address Text (The user specifically asked to be able to type this directly) */}
          <div>
            <label className="font-bold text-stone-800 block mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>ที่อยู่ / ข้อความที่ตั้งร้าน (พิมพ์ได้เอง)</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">ไม่ต้องปักหมุด</span>
            </label>
            <textarea
              required
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="เช่น ถนนสถลมาร์ค หน้า ม.อุบล (แถวร้านบิวตี้ ตรงข้ามประตู 1) ต.เมืองศรีไค อ.วารินชำราบ จ.อุบลราชธานี"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs text-stone-900 bg-white leading-relaxed"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              ข้อความนี้จะแสดงบนหัวเว็บ บิล ใบเสร็จ ป้ายหน้าร้าน และป้าย QR Code สั่งซื้อของลูกค้า
            </p>
          </div>

          {/* Phone & PromptPay ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-800 block mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                <span>เบอร์โทรติดต่อร้าน</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เช่น 089-123-4567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs text-stone-900 bg-white"
              />
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                <span>เบอร์พร้อมเพย์รับเงิน</span>
              </label>
              <input
                type="text"
                required
                value={promptPayId}
                onChange={(e) => setPromptPayId(e.target.value)}
                placeholder="เช่น 0891234567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs text-stone-900 bg-white"
              />
            </div>
          </div>

          {/* Optional Coordinates (editable, not mandatory) */}
          <div className="pt-2 border-t border-stone-100">
            <details className="text-stone-500 group">
              <summary className="text-[11px] font-medium text-stone-600 cursor-pointer hover:text-stone-900 list-none flex items-center justify-between">
                <span>📍 พิกัดละติจูด/ลองจิจูด (ระบุหรือไม่ระบุก็ได้)</span>
                <span className="text-[10px] text-stone-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-1">
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Latitude</label>
                  <input
                    type="text"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="15.1192"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-stone-50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Longitude</label>
                  <input
                    type="text"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="104.9036"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-stone-50"
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleResetDefault}
              className="px-3 py-2 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-medium flex items-center gap-1 hover:bg-stone-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>คืนค่าเดิม</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-all ${
                  isSaved ? 'bg-emerald-600' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{isSaved ? 'บันทึกสำเร็จ!' : 'บันทึกข้อมูลที่ตั้ง'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
