import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  calculateMonthlyReport,
  generateMonthlyGoogleSheetsCSV,
  generateMonthlyGoogleSheetsClipboardTSV,
  downloadCSV,
  THAI_MONTH_NAMES,
} from '../utils/helpers';
import { GoogleSheetsSyncPanel } from './GoogleSheetsSyncPanel';
import {
  FileSpreadsheet,
  Download,
  Copy,
  ExternalLink,
  RotateCcw,
  Calendar,
  DollarSign,
  Coffee,
  Receipt,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  Banknote,
  Truck,
  Store,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface MonthlyReportModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({
  isOpen = true,
  onClose,
  isEmbedded = false,
}) => {
  const {
    orders,
    ingredients,
    shopLocation,
    startNewMonthReset,
    resetDemoData,
  } = useApp();

  // Find all available months in order data
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const d = new Date(o.createdAt);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        set.add(key);
      }
    });

    // Always ensure current month is present
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    set.add(currentKey);

    return Array.from(set).sort().reverse();
  }, [orders]);

  // Current selected month
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);

  // Notifications
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Confirmation dialogs
  const [showConfirmResetNewMonth, setShowConfirmResetNewMonth] = useState(false);
  const [showConfirmFactoryReset, setShowConfirmFactoryReset] = useState(false);

  // Calculate Report
  const report = useMemo(() => {
    return calculateMonthlyReport(orders, ingredients, selectedMonth);
  }, [orders, ingredients, selectedMonth]);

  if (!isOpen && !isEmbedded) return null;

  // 1. Export CSV to Google Sheets / Excel
  const handleExportCSV = () => {
    const csvContent = generateMonthlyGoogleSheetsCSV(report, shopLocation.name);
    const filename = `Smoothie_Monthly_Summary_${selectedMonth}.csv`;
    downloadCSV(csvContent, filename);
  };

  // 2. Copy TSV to Clipboard for direct Ctrl+V paste into Google Sheets
  const handleCopyForGoogleSheets = () => {
    const tsvContent = generateMonthlyGoogleSheetsClipboardTSV(report, shopLocation.name);
    navigator.clipboard.writeText(tsvContent).then(() => {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    });
  };

  // 3. Open empty Google Sheets in new tab
  const handleOpenGoogleSheets = () => {
    // First copy to clipboard
    handleCopyForGoogleSheets();
    // Open sheets.new
    window.open('https://sheets.new', '_blank', 'noopener,noreferrer');
  };

  // 4. Start New Month Reset
  const handleConfirmNewMonth = () => {
    startNewMonthReset();
    setShowConfirmResetNewMonth(false);
    setResetSuccessMsg('✅ สรุปและส่งออกข้อมูลแล้ว รีเซ็ตระบบเพื่อเริ่มรับออเดอร์เดือนใหม่เรียบร้อย!');
    setTimeout(() => setResetSuccessMsg(''), 4000);
  };

  // 5. Factory Reset
  const handleConfirmFactoryReset = () => {
    resetDemoData();
    setShowConfirmFactoryReset(false);
    setResetSuccessMsg('✅ รีเซ็ตระบบทั้งหมดกลับสู่การตั้งค่าเริ่มต้นพร้อมใช้งานเรียบร้อย!');
    setTimeout(() => setResetSuccessMsg(''), 4000);
  };

  const content = (
    <div className="space-y-4">
      {/* Header & Month Selector */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                สรุปยอดขายรายเดือน & นำออก Google Sheets
              </h2>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                พร้อมใช้งาน
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              สรุปยอดรายได้ ต้นทุน กำไร และส่งออกไป Google Sheets ใน 1 คลิก พร้อมปุ่มรีเซ็ตเริ่มเดือนใหม่
            </p>
          </div>
        </div>

        {/* Month Selector dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-stone-600 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            <span>เลือกเดือน:</span>
          </label>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-stone-50 border-2 border-stone-300 text-stone-800 font-bold text-xs rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-emerald-600 cursor-pointer shadow-xs"
            >
              {availableMonths.map((mKey) => {
                const [yStr, mStr] = mKey.split('-');
                const mIdx = parseInt(mStr, 10) - 1;
                const thYear = parseInt(yStr, 10) + 543;
                const label = `${THAI_MONTH_NAMES[mIdx] || ''} ${thYear}`;
                return (
                  <option key={mKey} value={mKey}>
                    {label} {mKey === defaultMonth ? '(เดือนนี้)' : ''}
                  </option>
                );
              })}
              <option value="all">รวมทั้งหมด (All-Time)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-stone-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {copiedSuccess && (
        <div className="bg-emerald-500 text-white px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>คัดลอกตารางสรุปรายเดือนแล้ว! สามารถกด Ctrl+V (หรือ Cmd+V) วางลงใน Google Sheets ได้ทันที</span>
          </div>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-lg">คัดลอกแล้ว</span>
        </div>
      )}

      {resetSuccessMsg && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{resetSuccessMsg}</span>
        </div>
      )}

      {/* Google Sheets Direct API Sync Panel */}
      <GoogleSheetsSyncPanel selectedMonth={selectedMonth} />

      {/* Primary Action Buttons: LARGE, HIGH-CONTRAST, SUPER EASY TO PRESS */}
      <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-stone-50 p-4 sm:p-5 rounded-3xl border-2 border-emerald-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs sm:text-sm font-black text-emerald-950">
              ปุ่มด่วนสำหรับส่งออกและเริ่มรอบใหม่
            </h3>
          </div>
          <span className="text-[11px] text-emerald-800 font-medium">กดปุ่มเดียว ดำเนินการทันที</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Button 1: Download CSV for Google Sheets */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-white" />
            <div className="text-left">
              <div className="leading-tight">ดาวน์โหลด Google Sheets (CSV)</div>
              <div className="text-[10px] text-emerald-100 font-normal">ภาษาไทย 100% เปิดได้ทันที</div>
            </div>
          </button>

          {/* Button 2: Copy to Clipboard */}
          <button
            type="button"
            onClick={handleCopyForGoogleSheets}
            className="w-full bg-white hover:bg-stone-50 active:scale-98 text-emerald-950 border-2 border-emerald-300 p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Copy className="w-4 h-4 text-emerald-700" />
            <div className="text-left">
              <div className="leading-tight">คัดลอกตารางสรุปข้อมูล</div>
              <div className="text-[10px] text-stone-500 font-normal">ก๊อปปี้ไปกด Ctrl+V วางในชีต</div>
            </div>
          </button>

          {/* Button 3: Open Google Sheets tab */}
          <button
            type="button"
            onClick={handleOpenGoogleSheets}
            className="w-full bg-[#0F9D58] hover:bg-[#0b8043] active:scale-98 text-white p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 text-white" />
            <div className="text-left">
              <div className="leading-tight">เปิด Google Sheets (แผ่นใหม่)</div>
              <div className="text-[10px] text-emerald-100 font-normal">คัดลอกพร้อมเปิด sheets.new</div>
            </div>
          </button>
        </div>

        {/* Reset / Start New Month Row */}
        <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-stone-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>ส่งออกเสร็จแล้ว? รีเซ็ตเพื่อเริ่มต้นการขายและบันทึกข้อมูลของเดือนใหม่:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Start New Month Button */}
            <button
              type="button"
              onClick={() => setShowConfirmResetNewMonth(true)}
              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>เริ่มเดือนใหม่ (ล้างออเดอร์ คงสต็อกไว้)</span>
            </button>

            {/* Factory Reset to Initial Defaults */}
            <button
              type="button"
              onClick={() => setShowConfirmFactoryReset(true)}
              className="bg-stone-200 hover:bg-stone-300 active:scale-95 text-stone-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>รีเซ็ตตั้งต้นระบบทั้งหมด</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Monthly Revenue */}
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span className="font-semibold">ยอดขายทั้งเดือน</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            ฿{report.totalRevenue.toLocaleString('th-TH')}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            {report.totalOrders} บิล • เฉลี่ย ฿
            {report.totalOrders > 0 ? Math.round(report.totalRevenue / report.totalOrders) : 0}/บิล
          </div>
        </div>

        {/* Total Cups Sold */}
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span className="font-semibold">จำนวนแก้วที่ขายได้</span>
            <Coffee className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-900 tracking-tight">
            {report.totalCups.toLocaleString('th-TH')} <span className="text-xs font-bold text-stone-500">แก้ว</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            เครื่องดื่มสมูทตี้และน้ำผลไม้ปั่น
          </div>
        </div>

        {/* Estimated Gross Profit */}
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span className="font-semibold">กำไรขั้นต้นประเมิน</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-900 tracking-tight">
            ฿{report.grossProfit.toLocaleString('th-TH')}
          </div>
          <div className="text-[11px] text-blue-700 font-semibold mt-1">
            มาร์จิ้น ~{report.profitMarginPercent}% (หักต้นทุนวัตถุดิบ)
          </div>
        </div>

        {/* Payment Methods Split */}
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span className="font-semibold">ช่องทางชำระเงิน</span>
            <Receipt className="w-4 h-4 text-purple-600" />
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between items-center text-stone-700">
              <span className="flex items-center gap-1 text-[11px]">
                <CreditCard className="w-3 h-3 text-sky-600" /> พร้อมเพย์:
              </span>
              <span className="font-bold font-mono">฿{report.promptPayRevenue.toLocaleString('th-TH')}</span>
            </div>
            <div className="flex justify-between items-center text-stone-700">
              <span className="flex items-center gap-1 text-[11px]">
                <Banknote className="w-3 h-3 text-emerald-600" /> เงินสด:
              </span>
              <span className="font-bold font-mono">฿{report.cashRevenue.toLocaleString('th-TH')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Breakdown: POS Counter vs Delivery */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="text-stone-500 text-[11px]">หน้าร้านเคาน์เตอร์ POS</div>
              <div className="font-bold text-stone-900">฿{report.counterRevenue.toLocaleString('th-TH')}</div>
            </div>
          </div>

          <div className="h-6 w-px bg-stone-200"></div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-amber-700">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-stone-500 text-[11px]">เดลิเวอรี่ / สั่งผ่านเว็บ</div>
              <div className="font-bold text-stone-900">
                ฿{report.deliveryRevenue.toLocaleString('th-TH')}
                {report.totalDeliveryFees > 0 && (
                  <span className="text-[10px] text-stone-500 font-normal">
                    {' '}(ค่าส่ง ฿{report.totalDeliveryFees})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-stone-500">
          ข้อมูลประจำ: <span className="font-bold text-stone-800">{report.monthNameThai}</span>
        </div>
      </div>

      {/* Top 5 Best Selling Smoothies of Month */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <span>🥤 อันดับเมนูขายดีประจำเดือน</span>
            <span className="text-[10px] text-stone-500 font-normal">({report.topItems.length} รายการ)</span>
          </h4>
          <span className="text-[11px] text-stone-500">เรียงตามจำนวนแก้วที่ขายได้</span>
        </div>

        {report.topItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-stone-400">ยังไม่มีรายการขายในเดือนนี้</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {report.topItems.slice(0, 6).map((item, idx) => {
              const pct = report.totalCups > 0 ? Math.round((item.quantity / report.totalCups) * 100) : 0;
              return (
                <div
                  key={item.name}
                  className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-stone-950'
                          : idx === 1
                          ? 'bg-stone-300 text-stone-900'
                          : idx === 2
                          ? 'bg-amber-700/30 text-amber-900'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-800 truncate">{item.name}</div>
                      <div className="text-[10px] text-stone-500">สัดส่วน {pct}% ของแก้วทั้งหมด</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-amber-900">{item.quantity} แก้ว</div>
                    <div className="text-[10px] text-stone-600 font-mono">฿{item.revenue.toLocaleString('th-TH')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Orders List of This Month */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <span>📋 รายการออเดอร์ทั้งหมดในเดือนนี้</span>
            <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold">
              {report.orders.length} รายการ
            </span>
          </h4>
          <span className="text-[11px] text-stone-500">พร้อมนำออกไป Google Sheets</span>
        </div>

        {report.orders.length === 0 ? (
          <div className="py-6 text-center text-xs text-stone-400">ยังไม่มีรายการออเดอร์ในเดือนที่เลือก</div>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {report.orders.map((ord) => (
              <div
                key={ord.id}
                className="p-2.5 rounded-xl border border-stone-100 hover:bg-stone-50 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-stone-900">{ord.orderNumber}</span>
                    <span className="text-[10px] text-stone-400">
                      {new Date(ord.createdAt).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold ${
                        ord.paymentMethod === 'promptpay'
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {ord.paymentMethod === 'promptpay' ? 'พร้อมเพย์' : 'เงินสด'}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-600 truncate mt-0.5">
                    {ord.items.map((it) => `${it.menuItemName} x${it.quantity}`).join(', ')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-stone-900">฿{ord.totalAmount}</div>
                  <div className="text-[10px] text-stone-400">
                    {ord.channel === 'counter' ? 'หน้าร้าน' : 'เดลิเวอรี่'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: Confirm Reset for New Month */}
      {showConfirmResetNewMonth && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-stone-900">
                เริ่มต้นรอบเดือนใหม่
              </h3>
              <p className="text-xs text-stone-600">
                ระบบจะล้างประวัติออเดอร์และยอดขายของเดือนเดิม เพื่อเริ่มนับ 0 สำหรับเดือนใหม่
              </p>
              <p className="text-[11px] text-emerald-700 font-medium">
                🛡️ รายการเมนู สูตร BOM และระดับสต็อกวัตถุดิบปัจจุบันจะยังคงอยู่ครบถ้วน
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 leading-tight">
              💡 แนะนำ: อย่าลืมกด <b>"ดาวน์โหลด Google Sheets (CSV)"</b> เพื่อเก็บข้อมูลสรุปของเดือนนี้ไว้ก่อนนะครับ
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmResetNewMonth(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmNewMonth}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs shadow-sm cursor-pointer"
              >
                ยืนยันเริ่มเดือนใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Confirm Factory Reset */}
      {showConfirmFactoryReset && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-stone-900">
                รีเซ็ตข้อมูลระบบกลับสู่ค่าเริ่มต้น
              </h3>
              <p className="text-xs text-stone-600">
                ระบบจะคืนค่าวัตถุดิบ เมนู และออเดอร์ทดสอบกลับสู่ค่าตั้งต้นพร้อมใช้งานของร้าน (Factory Defaults)
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmFactoryReset(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmFactoryReset}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-sm cursor-pointer"
              >
                รีเซ็ตค่าเริ่มต้น
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // If rendered as standalone modal:
  if (!isEmbedded) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-stone-50 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 border border-stone-200 shadow-2xl relative my-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center transition-all cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {content}
        </div>
      </div>
    );
  }

  // If rendered as embedded tab:
  return content;
};
