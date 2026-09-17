import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../context/AppContext';
import {
  QrCode,
  X,
  ExternalLink,
  Copy,
  Check,
  Printer,
  Sparkles,
  Smartphone,
  Coffee,
} from 'lucide-react';

interface CustomerOrderQRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerOrderQRModal: React.FC<CustomerOrderQRModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { shopLocation, setActiveTab, setIsCustomerOnlyView } = useApp();
  const [copied, setCopied] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string>('');

  // Generate target URL that opens ONLY the customer ordering menu (hides staff tabs, KDS, inventory)
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://ais-dev.run.app';
  const orderUrl = `${baseUrl}?mode=order`;

  useEffect(() => {
    QRCode.toDataURL(orderUrl, {
      margin: 2,
      width: 320,
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrImageUrl(url))
      .catch(() => {
        setQrImageUrl(
          `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
            orderUrl
          )}&margin=10`
        );
      });
  }, [orderUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleJumpToCustomerView = () => {
    setIsCustomerOnlyView(true);
    setActiveTab('customer');
    onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Clean Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-sm text-white">QR สั่งเครื่องดื่ม</h2>
                <span className="bg-emerald-400 text-stone-950 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                  เฉพาะเมนู
                </span>
              </div>
              <p className="text-[11px] text-amber-100">ลูกค้าสแกนแล้วเห็นเฉพาะเมนูสั่งซื้อน้ำ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Essential Customer Info Card */}
        <div className="p-5 text-center space-y-3.5">
          {/* Shop Name & Address */}
          <div>
            <h3 className="font-black text-stone-900 text-base">{shopLocation.name}</h3>
            <p className="text-xs text-stone-500 mt-0.5">{shopLocation.address}</p>
          </div>

          {/* Crisp QR Code */}
          <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 inline-block shadow-inner">
            <img
              src={qrImageUrl}
              alt="QR Code สำหรับสั่งเครื่องดื่ม (เฉพาะเมนูสำหรับลูกค้า)"
              className="w-52 h-52 mx-auto rounded-xl object-contain bg-white p-2 border border-stone-200"
              loading="eager"
            />
            <div className="mt-2 text-xs font-bold text-emerald-900 bg-emerald-100 py-1 px-3 rounded-full inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>เห็นเฉพาะเมนู • ไม่เห็นระบบร้านค้า</span>
            </div>
          </div>

          {/* Privacy & Safe Badge */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2.5 text-left text-xs text-emerald-900 space-y-1">
            <div className="font-bold flex items-center gap-1 text-emerald-800">
              <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>ความปลอดภัยสำหรับตั้งหน้าร้าน & บนโต๊ะ:</span>
            </div>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              เมื่อลูกค้าสแกน QR นี้ ระบบจะตัดแถบควบคุมพนักงานออกทั้งหมด (ไม่เห็น POS, คิวปั่น KDS, ไรเดอร์, คลังสต็อก และไม่มีเสียงเตือนออเดอร์) เห็นเฉพาะเมนูเครื่องดื่มและตะกร้าสั่งซื้อ
            </p>
          </div>

          {/* Open Order Page Directly Button */}
          <button
            type="button"
            onClick={handleJumpToCustomerView}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
          >
            <span>📱 เปิดหน้าสั่งซื้อของลูกค้าทันที (เฉพาะเมนู)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Secondary Actions: Copy & Print */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                copied
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกลิงก์แล้ว!' : 'คัดลอกลิงก์'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-stone-600" />
              <span>พิมพ์ป้ายตั้งโต๊ะ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
