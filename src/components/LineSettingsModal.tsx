import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LineConfig } from '../types';
import { playAlertWarningChime } from '../utils/audio';
import {
  Bell,
  X,
  Check,
  Send,
  ExternalLink,
  ShieldCheck,
  MessageSquare,
  AlertTriangle,
  Smartphone,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface LineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LineSettingsModal: React.FC<LineSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { lineConfig, updateLineConfig, triggerManualLineAlert, ingredients } = useApp();

  const [token, setToken] = useState(lineConfig.token || '');
  const [channelName, setChannelName] = useState(lineConfig.channelName || 'ร้านน้ำปั่น ม.อุบล (เจ้าของร้าน)');
  const [webhookUrl, setWebhookUrl] = useState(lineConfig.webhookUrl || '');
  const [notifyLowStock, setNotifyLowStock] = useState(lineConfig.notifyLowStock);
  const [notifyOutOfStock, setNotifyOutOfStock] = useState(lineConfig.notifyOutOfStock);
  const [notifySpike, setNotifySpike] = useState(lineConfig.notifySpike);
  const [notifyNewOrder, setNotifyNewOrder] = useState(lineConfig.notifyNewOrder);
  const [notifyDailySummary, setNotifyDailySummary] = useState(lineConfig.notifyDailySummary);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testSending, setTestSending] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: LineConfig = {
      token: token.trim(),
      channelName: channelName.trim() || 'ร้านน้ำปั่น ม.อุบล',
      webhookUrl: webhookUrl.trim(),
      notifyLowStock,
      notifyOutOfStock,
      notifySpike,
      notifyNewOrder,
      notifyDailySummary,
      lastConnectedAt: token.trim() ? new Date().toISOString() : undefined,
    };
    updateLineConfig(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTestSend = async () => {
    setTestSending(true);
    playAlertWarningChime();

    // Find actual low stock ingredients if any
    const lowStock = ingredients.filter(
      (i) => i.currentStock <= (i.isSpike ? i.dynamicMinStock : i.minStock)
    );

    const testMessage = lowStock.length > 0
      ? `⚠️ ตรวจพบของใกล้หมด ${lowStock.length} รายการ: ${lowStock.map((i) => `${i.name} เหลือ ${i.currentStock} ${i.unit}`).join(', ')}`
      : '✅ ทดสอบเชื่อมต่อสำเร็จ! ระบบแจ้งเตือนของหมดและออเดอร์ร้านน้ำปั่น ม.อุบล พร้อมใช้งานแล้ว';

    setTimeout(() => {
      triggerManualLineAlert(
        '🔔 ทดสอบส่งข้อความแจ้งเตือนเข้า LINE',
        testMessage,
        'low_stock'
      );
      setTestSending(false);
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200 my-4">
        {/* Header with LINE Green */}
        <div className="bg-[#06C755] text-white p-4 sm:p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-[#06C755] font-black flex items-center justify-center text-lg shadow-md">
              LINE
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-white">
                  เชื่อมต่อการแจ้งเตือนเข้า LINE
                </h2>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  LINE Notify & Webhook
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                แจ้งเตือนของหมด, ของใกล้แตะจุดสั่งซื้อ, และออเดอร์ใหม่เข้ามือถือเจ้าของร้าน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors -mr-1 -mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {/* 3 Step Instruction Guide */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-stone-900 text-xs">
              <Info className="w-4 h-4 text-[#06C755]" />
              <span>วิธีเชื่อมต่อกับ LINE สำหรับเจ้าของกิจการ (ทำครั้งเดียวใน 2 นาที):</span>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-stone-700 text-[11px] leading-relaxed">
              <li>
                เปิดเว็บไซต์{' '}
                <a
                  href="https://notify-bot.line.me"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[#06C755] hover:underline inline-flex items-center gap-0.5"
                >
                  <span>notify-bot.line.me</span>
                  <ExternalLink className="w-3 h-3" />
                </a>{' '}
                แล้วเข้าสู่ระบบด้วยบัญชี LINE ของคุณ
              </li>
              <li>
                คลิกที่ชื่อโปรไฟล์มุมขวาบน ➔ เลือก <strong>"My page (หน้าของฉัน)"</strong> ➔ เลื่อนลงมากด <strong>"Generate token (ออก Token)"</strong>
              </li>
              <li>
                พิมพ์ชื่อบอท เช่น <code>ร้านน้ำปั่น ม.อุบล</code> ➔ เลือกว่าจะให้เตือน <strong>"แชทส่วนตัว (1-on-1 chat with LINE Notify)"</strong> หรือ <strong>"เลือกกลุ่มร้านค้า/พนักงาน"</strong> ➔ กดออก Token แล้วคัดลอกรหัสมาวางด้านล่างนี้
              </li>
            </ol>
          </div>

          {/* Form Inputs */}
          <div className="space-y-3">
            <div>
              <label className="font-bold text-stone-800 block mb-1">
                LINE Notify Access Token *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="วางรหัส Token ที่ได้จาก LINE เช่น eB47xY..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:border-[#06C755] font-mono text-xs pr-10"
                />
                {token && (
                  <ShieldCheck className="w-4 h-4 text-[#06C755] absolute right-3 top-2.5" />
                )}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                รหัสนี้จะถูกจัดเก็บอย่างปลอดภัยในเบราว์เซอร์ของร้านคุณ ไม่มีการแชร์ให้ผู้อื่น
              </p>
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1">
                ชื่อแสดงในแจ้งเตือน
              </label>
              <input
                type="text"
                placeholder="เช่น ร้านน้ำปั่น ม.อุบล (เจ้าของร้าน)"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:border-[#06C755] text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1">
                หรือ Webhook URL (ทางเลือก: Zapier / Make.com / LINE Messaging API)
              </label>
              <input
                type="url"
                placeholder="https://hook.eu1.make.com/... (ไม่บังคับ)"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:border-[#06C755] text-xs font-mono"
              />
            </div>
          </div>

          {/* Notification Event Toggles */}
          <div className="border-t border-stone-100 pt-3 space-y-2">
            <span className="font-bold text-stone-800 block text-xs">
              เลือกเหตุการณ์ที่ต้องการให้ส่งเตือนเข้า LINE:
            </span>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={notifyLowStock}
                  onChange={(e) => setNotifyLowStock(e.target.checked)}
                  className="rounded text-[#06C755] focus:ring-[#06C755] w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-semibold text-stone-800 block">⚠️ วัตถุดิบใกล้หมด (แตะจุดสั่งซื้อ Safety Stock)</span>
                  <span className="text-[10px] text-stone-500">เตือนทันทีเมื่อตัดสต็อกแล้วเหลือต่ำกว่าเกณฑ์รอบสัปดาห์</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={notifyOutOfStock}
                  onChange={(e) => setNotifyOutOfStock(e.target.checked)}
                  className="rounded text-[#06C755] focus:ring-[#06C755] w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-semibold text-stone-800 block">🚫 วัตถุดิบหมดเกลี้ยง (Out of Stock)</span>
                  <span className="text-[10px] text-stone-500">เตือนเมื่อสินค้าหมด เพื่อให้ปิดเมนูหรือรีบสั่งด่วน</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={notifySpike}
                  onChange={(e) => setNotifySpike(e.target.checked)}
                  className="rounded text-[#06C755] focus:ring-[#06C755] w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-semibold text-stone-800 block">🔥 สินค้ากระแสพุ่งฉับพลัน (Spike Item)</span>
                  <span className="text-[10px] text-stone-500">เตือนเมื่อระบบตรวจพบการสั่งซื้อถี่กว่าปกติ และปรับสต็อกรองรับให้อัตโนมัติ</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={notifyNewOrder}
                  onChange={(e) => setNotifyNewOrder(e.target.checked)}
                  className="rounded text-[#06C755] focus:ring-[#06C755] w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-semibold text-stone-800 block">🥤 มีออเดอร์ใหม่เข้ามา (New Order Alert)</span>
                  <span className="text-[10px] text-stone-500">เตือนเมื่อมีลูกค้าสั่งซื้อออนไลน์หรือเดลิเวอรี่เข้ามา</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={notifyDailySummary}
                  onChange={(e) => setNotifyDailySummary(e.target.checked)}
                  className="rounded text-[#06C755] focus:ring-[#06C755] w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-semibold text-stone-800 block">📊 สรุปยอดขายประจำวัน (Daily Summary)</span>
                  <span className="text-[10px] text-stone-500">ส่งยอดขายรวม จำนวนแก้ว และเมนูขายดีประจำวันตอนปิดร้าน</span>
                </div>
              </label>
            </div>
          </div>

          {/* Test Send Simulation Box */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                <MessageSquare className="w-4 h-4 text-[#06C755]" />
                <span>จำลองการแจ้งเตือนในแอป LINE</span>
              </div>
              <button
                type="button"
                onClick={handleTestSend}
                disabled={testSending}
                className="bg-[#06C755] hover:bg-[#05b34c] active:scale-95 text-white font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>{testSending ? 'กำลังส่ง...' : 'ทดสอบส่งเดี๋ยวนี้'}</span>
              </button>
            </div>

            {testSent && (
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1.5 text-[11px] animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>ส่งสัญญาณแจ้งเตือนเข้าศูนย์ข้อความ LINE เรียบร้อย! ตรวจสอบกล่องข้อความได้ทันที</span>
              </div>
            )}

            {/* Realistic LINE Message Bubble Mockup */}
            <div className="bg-[#7292a8] p-3 rounded-xl shadow-inner space-y-1">
              <div className="text-[10px] text-white/80 font-bold flex items-center gap-1">
                <span>LINE Notify</span>
                <span className="text-[9px] bg-white/30 px-1 rounded">BOT</span>
              </div>
              <div className="bg-white text-stone-900 rounded-xl rounded-tl-xs p-2.5 text-[11px] shadow-sm space-y-1">
                <div className="font-bold text-emerald-800 flex items-center gap-1">
                  <span>🔔 [{channelName || 'ร้านน้ำปั่น ม.อุบล'}]</span>
                </div>
                <div className="font-semibold text-stone-800">
                  ⚠️ แจ้งเตือน: วัตถุดิบใกล้แตะจุดสั่งซื้อ!
                </div>
                <div className="text-stone-600 text-[10px] leading-relaxed">
                  • สตรอว์เบอร์รีสดแช่แข็ง: เหลือ 850g (จุดสั่งซื้อ 2,000g)<br />
                  • อะโวคาโดสด: เหลือ 600g (จุดสั่งซื้อ 1,500g)<br />
                  💡 แนะนำสั่งเติมในรอบสัปดาห์นี้เพื่อไม่ให้กระทบยอดขาย
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
            <span className="text-[11px] text-emerald-700 font-semibold">
              {savedSuccess ? '✅ บันทึกการตั้งค่า LINE สำเร็จแล้ว!' : ''}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 font-semibold hover:bg-stone-50"
              >
                ปิด
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#06C755] hover:bg-[#05b34c] active:scale-95 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>บันทึกการตั้งค่า</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
