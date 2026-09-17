import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { generatePromptPayPayload } from '../utils/helpers';
import { useApp } from '../context/AppContext';
import {
  Copy,
  Check,
  Download,
  Edit3,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Phone,
  ShieldCheck,
} from 'lucide-react';

interface PromptPayQRProps {
  amount: number;
  phoneOrId: string;
  shopName?: string;
  allowEdit?: boolean;
}

export const PromptPayQR: React.FC<PromptPayQRProps> = ({
  amount,
  phoneOrId,
  shopName = 'COCO BEAR / PANG BEAR',
  allowEdit = true,
}) => {
  const { updateShopLocation } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>(phoneOrId);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Format clean ID
  const cleanId = (phoneOrId || '').replace(/[^0-9]/g, '');

  // Determine type (Mobile 10 digits or Citizen ID 13 digits)
  const isMobile = cleanId.length === 10;
  const isCitizenId = cleanId.length === 13;

  const formattedDisplay = isMobile
    ? cleanId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
    : isCitizenId
    ? cleanId.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5')
    : cleanId;

  // Generate QR Code data URL using client-side QRCode engine
  useEffect(() => {
    if (!cleanId) return;

    try {
      const payload = generatePromptPayPayload(cleanId, amount);
      QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then((url) => {
          setQrDataUrl(url);
        })
        .catch((err) => {
          console.error('QR code generation error:', err);
          // Fallback to online image if canvas/qr fails
          const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            payload
          )}&margin=10`;
          setQrDataUrl(fallbackUrl);
        });
    } catch (err) {
      console.error('Payload generation error:', err);
    }
  }, [cleanId, amount]);

  // Copy PromptPay number to clipboard
  const handleCopy = () => {
    if (!cleanId) return;
    navigator.clipboard.writeText(cleanId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Download QR Code image (useful for mobile users to scan from gallery)
  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `PromptPay_${cleanId}_${amount}THB.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Save new PromptPay ID
  const handleSavePromptPay = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = editValue.replace(/[^0-9]/g, '');

    if (cleaned.length !== 10 && cleaned.length !== 13) {
      setErrorMsg('กรุณาระบุเบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก');
      return;
    }

    setErrorMsg('');
    updateShopLocation({ promptPayId: cleaned });
    setSaveSuccess(true);
    setIsEditing(false);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-sm text-center max-w-sm mx-auto">
      {/* Official PromptPay Header */}
      <div className="bg-[#003B6B] text-white rounded-2xl py-2.5 px-4 mb-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="bg-white text-[#003B6B] text-[11px] font-black px-2 py-0.5 rounded-sm tracking-wide">
            พร้อมเพย์
          </div>
          <span className="text-xs font-semibold tracking-wide">PromptPay</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-sky-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>มาตรฐาน ธปท. (EMVCo)</span>
        </div>
      </div>

      {/* Shop & Account Details */}
      <div className="space-y-0.5 mb-2">
        <div className="text-xs font-bold text-stone-800 truncate">{shopName}</div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-stone-600">
          <span className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            {isMobile ? <Phone className="w-3 h-3 text-amber-600" /> : <CreditCard className="w-3 h-3 text-sky-600" />}
            {isMobile ? 'เบอร์มือถือ' : isCitizenId ? 'เลขบัตรประชาชน' : 'พร้อมเพย์'}
          </span>
          <span className="font-mono font-bold text-stone-900 tracking-wider">
            {formattedDisplay || '089-123-4567'}
          </span>
        </div>
      </div>

      {/* Quick Action: Copy & Edit PromptPay Number */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 active:scale-95 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
          title="คัดลอกเบอร์สำหรับไปวางในแอปธนาคาร"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" />
              <span className="text-emerald-700 font-bold">คัดลอกสำเร็จ!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-stone-500" />
              <span>คัดลอกเบอร์</span>
            </>
          )}
        </button>

        {allowEdit && (
          <button
            type="button"
            onClick={() => {
              setEditValue(cleanId);
              setIsEditing(!isEditing);
              setErrorMsg('');
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 active:scale-95 px-2.5 py-1 rounded-lg border border-amber-200 transition-all cursor-pointer"
            title="เปลี่ยนเป็นเบอร์ของคุณเอง เพื่อให้เงินเข้าบัญชีจริงทันที"
          >
            <Edit3 className="w-3 h-3 text-amber-700" />
            <span>{isEditing ? 'ปิดแก้ไข' : 'ใส่เบอร์รับเงินจริง'}</span>
          </button>
        )}
      </div>

      {/* Inline Quick PromptPay Editor */}
      {isEditing && (
        <form
          onSubmit={handleSavePromptPay}
          className="mb-3 p-3 bg-amber-50/90 rounded-2xl border border-amber-200 text-left space-y-2 animate-in fade-in zoom-in-98 duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1">
              <span>💳 ตั้งค่าเบอร์พร้อมเพย์รับเงินจริง</span>
            </span>
            <span className="text-[10px] text-amber-700">สแกนเงินเข้าบัญชีนี้</span>
          </div>

          <p className="text-[10px] text-amber-800 leading-tight">
            ใส่เบอร์โทรศัพท์ที่ผูกพร้อมเพย์ (10 หลัก) หรือเลขบัตร ปชช. (13 หลัก) ของคุณ เมื่อลูกค้าสแกนเงินจะเข้าบัญชีจริงทันที
          </p>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="เช่น 0891234567 หรือ 13 หลัก"
              className="flex-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              autoFocus
            />
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              บันทึกใช้เบอร์นี้
            </button>
          </div>

          {errorMsg && (
            <div className="text-[11px] text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>
      )}

      {saveSuccess && (
        <div className="mb-2 py-1 px-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>บันทึกเบอร์พร้อมเพย์ใหม่เรียบร้อย! คิวอาร์อัปเดตแล้ว</span>
        </div>
      )}

      {/* QR Code Container with crisp borders & white margin for instant bank scan */}
      <div className="relative inline-block p-3 bg-white rounded-2xl border-2 border-stone-900/10 shadow-xs mb-3">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="PromptPay EMVCo QR Code"
            className="w-52 h-52 sm:w-56 sm:h-56 mx-auto rounded-lg object-contain block select-all"
          />
        ) : (
          <div className="w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center bg-stone-50 rounded-lg text-stone-400 text-xs">
            กำลังสร้างคิวอาร์...
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-stone-500 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>สแกนจ่ายได้ทุกแอปธนาคาร (กสิกร, SCB, กรุงไทย ฯลฯ)</span>
        </div>
      </div>

      {/* Amount Display */}
      <div className="bg-amber-50/80 rounded-2xl py-2.5 px-4 mb-3 border border-amber-200/80">
        <div className="text-[11px] text-amber-800 font-medium">ยอดชำระที่ต้องโอน (ระบุในคิวอาร์อัตโนมัติ)</div>
        <div className="text-2xl font-black text-amber-950 tracking-tight">
          ฿{amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Action: Save QR image for scanning from mobile album */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={handleDownload}
          className="w-full bg-stone-100 hover:bg-stone-200 active:scale-98 text-stone-800 text-xs font-semibold py-2 px-3 rounded-xl border border-stone-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-stone-600" />
          <span>บันทึกรูป QR ลงมือถือ (เปิดสแกนจากรูปในแอปธนาคาร)</span>
        </button>

        <p className="text-[10px] text-stone-400 leading-tight">
          💡 หากสั่งผ่านมือถือเครื่องนี้ ให้กด "บันทึกรูป QR" แล้วเข้าแอปธนาคารเลือก "สแกนจากอัลบั้มรูปภาพ" หรือกด "คัดลอกเบอร์" ไปโอนได้เลย
        </p>
      </div>
    </div>
  );
};
