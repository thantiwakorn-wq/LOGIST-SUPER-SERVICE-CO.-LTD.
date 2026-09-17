import { BOMRequirement, Ingredient, SweetnessLevel, Order } from '../types';

// คำนวณระยะทาง Haversine ระหว่าง 2 พิกัด (กิโลเมตร)
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // รัศมีโลกเป็นกิโลเมตร
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

// คำนวณค่าจัดส่งในเขตอุบล-วารินชำราบ (ม.อุบล)
export function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= 0.5) return 0; // ส่งฟรีหน้า ม.อุบล
  if (distanceKm <= 1.5) return 10; // โซนใน ม.อุบล / หอใน
  if (distanceKm <= 3.0) return 15; // หลัง ม.อุบล / หอพักเจริญศรี / เมืองศรีไค
  if (distanceKm <= 5.0) return 25; // สี่แยกโนนโหนน / รอบนอก
  if (distanceKm <= 8.0) return 35; // ตลาดแสนสบาย วาริน
  return Math.min(60, Math.round(35 + (distanceKm - 8) * 5)); // อ.วารินชำราบ
}

// คำนวณปริมาณวัตถุดิบจริงตามระดับความหวาน
export function calculateAdjustedBOM(
  bomReq: BOMRequirement,
  sweetness: SweetnessLevel
): number {
  if (!bomReq.scalesWithSweetness) {
    return bomReq.baseAmount;
  }
  // สัดส่วนปรับความหวานเทียบกับ base 100%
  const scaleMap: Record<SweetnessLevel, number> = {
    '0%': 0,
    '25%': 0.35,
    '50%': 0.65,
    '100%': 1.0,
  };
  return Math.round(bomReq.baseAmount * scaleMap[sweetness]);
}

// ตรวจสอบว่าเมนูนี้ทำได้หรือไม่ หรือวัตถุดิบขาด
export function checkMenuAvailability(
  bom: BOMRequirement[],
  ingredients: Ingredient[]
): { available: boolean; missingIngredientName?: string } {
  for (const item of bom) {
    const ing = ingredients.find((i) => i.id === item.ingredientId);
    if (!ing) continue;
    // ถ้าน้ำแข็ง หลอด หรือแก้วหมด หรือวัตถุดิบหลักเหลือน้อยกว่า 1 เสิร์ฟ
    if (ing.currentStock < item.baseAmount * 0.5) {
      return { available: false, missingIngredientName: ing.name };
    }
  }
  return { available: true };
}

// สร้างรหัส PromptPay QR Code Payload (EMVCo QR standard for PromptPay Thailand)
export function generatePromptPayPayload(targetPhoneOrId: string, amount?: number): string {
  const raw = targetPhoneOrId.replace(/[^0-9]/g, '');
  let targetTag = '01'; // 01 = Mobile, 02 = National ID / Tax ID, 03 = E-Wallet
  let formattedTarget = '';

  if (raw.length === 10 && raw.startsWith('0')) {
    // Standard Thai mobile number (e.g. 0812345678 -> 0066812345678)
    targetTag = '01';
    formattedTarget = '0066' + raw.substring(1);
  } else if (raw.length === 9 && !raw.startsWith('0')) {
    // Mobile number without leading 0
    targetTag = '01';
    formattedTarget = '0066' + raw;
  } else if (raw.length === 13) {
    // Thai National ID / Citizen ID / Tax ID (13 digits)
    targetTag = '02';
    formattedTarget = raw;
  } else if (raw.length === 15) {
    // PromptPay e-Wallet ID (15 digits)
    targetTag = '03';
    formattedTarget = raw;
  } else {
    // Default fallback: treat as mobile
    targetTag = '01';
    formattedTarget = '0066' + (raw.startsWith('0') ? raw.substring(1) : raw);
  }

  const formattedTargetLen = formattedTarget.length.toString().padStart(2, '0');
  // Tag 00 is AID for PromptPay: A000000677010111
  const merchantInfo = `0016A000000677010111${targetTag}${formattedTargetLen}${formattedTarget}`;
  const merchantTag = `29${merchantInfo.length.toString().padStart(2, '0')}${merchantInfo}`;

  const hasAmount = typeof amount === 'number' && amount > 0;
  // 010212 = Dynamic QR (has transaction amount), 010211 = Static QR (customer inputs amount)
  const pointOfInitiation = hasAmount ? '010212' : '010211';

  let payload = `000201${pointOfInitiation}${merchantTag}5303764`;

  if (hasAmount) {
    const amountStr = amount.toFixed(2);
    payload += `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
  }

  payload += '5802TH';

  // CRC16 Checksum Calculation (CCITT-FALSE: poly 0x1021, init 0xFFFF)
  const dataForCrc = payload + '6304';
  let crc = 0xffff;
  for (let i = 0; i < dataForCrc.length; i++) {
    const c = dataForCrc.charCodeAt(i);
    crc ^= c << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  const crcStr = crc.toString(16).toUpperCase().padStart(4, '0');
  return dataForCrc + crcStr;
}

// แปลงข้อมูลเป็นฟอร์แมต CSV / Google Sheets ที่คัดลอกไปวางใน Google Sheets ได้ทันที
export function exportToGoogleSheetsFormat(
  type: 'inventory' | 'orders' | 'replenishment',
  ingredients: Ingredient[],
  orders: Order[]
): string {
  if (type === 'inventory') {
    const headers = [
      'รหัสวัตถุดิบ',
      'ชื่อวัตถุดิบ',
      'หมวดหมู่',
      'พื้นที่จัดเก็บ',
      'สต็อกคงเหลือ',
      'หน่วย',
      'จุดสั่งซื้อปกติ',
      'จุดสั่งซื้อปรับตามกระแส (Spike)',
      'เป้าหมายสต็อกรอบสัปดาห์',
      'ราคาต่อหน่วย (บาท)',
      'สถานะกระแสพุ่ง (Spike)',
      'สถานะการเตือน',
      'อัปเดตล่าสุด',
    ];

    const rows = ingredients.map((ing) => {
      const isLow = ing.currentStock <= (ing.isSpike ? ing.dynamicMinStock : ing.minStock);
      const statusText = isLow ? '⚠️ สินค้าเหลือน้อยต้องเติม' : 'ปกติ';
      const zoneText = ing.zone === 'chilled' ? 'ตู้เย็น / ถังน้ำแข็ง' : 'เคาน์เตอร์แห้ง';
      return [
        ing.id,
        `"${ing.name.replace(/"/g, '""')}"`,
        ing.category,
        zoneText,
        ing.currentStock,
        ing.unit,
        ing.minStock,
        ing.dynamicMinStock,
        ing.targetStock,
        ing.costPerUnit,
        ing.isSpike ? 'ใช่ (Spike)' : 'ไม่ใช่',
        statusText,
        new Date(ing.updatedAt).toLocaleString('th-TH'),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  if (type === 'replenishment') {
    const headers = [
      'ชื่อวัตถุดิบ',
      'โซนจัดเก็บ',
      'สต็อกปัจจุบัน',
      'จุดสั่งซื้อที่เตือน',
      'จำนวนที่ต้องสั่งเพิ่ม (ชิ้น/กรัม/มล.)',
      'ราคาประเมิน (บาท)',
      'เหตุผล',
    ];

    const lowItems = ingredients.filter(
      (ing) => ing.currentStock <= (ing.isSpike ? ing.dynamicMinStock : ing.minStock)
    );

    const rows = lowItems.map((ing) => {
      const reorderQty = Math.max(0, ing.targetStock - ing.currentStock);
      const estCost = Math.round(reorderQty * ing.costPerUnit);
      const reason = ing.isSpike
        ? `🔥 สินค้ากระแสพุ่ง (${ing.spikeReason || 'ยอดขายพุ่งฉับพลัน'})`
        : 'สต็อกลดลงถึงจุดสั่งซื้อสัปดาห์';
      const zoneText = ing.zone === 'chilled' ? 'ตู้เย็น/ถังน้ำแข็ง' : 'เคาน์เตอร์';

      return [
        `"${ing.name.replace(/"/g, '""')}"`,
        zoneText,
        `${ing.currentStock} ${ing.unit}`,
        `${ing.isSpike ? ing.dynamicMinStock : ing.minStock} ${ing.unit}`,
        `${reorderQty} ${ing.unit}`,
        estCost,
        `"${reason}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  // orders
  const headers = [
    'เลขออเดอร์',
    'เวลาที่สั่ง',
    'ช่องทาง',
    'ประเภท',
    'รายการเมนู',
    'ยอดรวม (บาท)',
    'วิธีชำระ',
    'สถานะ',
    'ที่อยู่จัดส่ง',
    'เบอร์โทร',
    'ระยะทาง (กม.)',
    'ค่าส่ง (บาท)',
  ];

  const rows = orders.map((ord) => {
    const itemsText = ord.items
      .map((it) => `${it.menuItemName} x${it.quantity} (หวาน ${it.sweetness})`)
      .join('; ');
    const channelText = ord.channel === 'counter' ? 'หน้าร้าน (POS)' : 'ออนไลน์';
    const deliveryType = ord.isDelivery ? 'จัดส่ง (Delivery)' : 'รับหน้าร้าน';

    return [
      ord.orderNumber,
      new Date(ord.createdAt).toLocaleString('th-TH'),
      channelText,
      deliveryType,
      `"${itemsText.replace(/"/g, '""')}"`,
      ord.totalAmount,
      ord.paymentMethod === 'promptpay' ? 'พร้อมเพย์' : 'เงินสด',
      ord.status,
      ord.deliveryInfo ? `"${ord.deliveryInfo.address.replace(/"/g, '""')}"` : '-',
      ord.deliveryInfo?.phone || '-',
      ord.deliveryInfo?.distanceKm || 0,
      ord.deliveryFee,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// ดาวน์โหลดไฟล์ CSV
export function downloadCSV(content: string, filename: string) {
  // Add UTF-8 BOM so Excel and Google Sheets open Thai text correctly
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Thai Month Names Helper
export const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export interface MonthlyReportSummary {
  monthKey: string; // e.g. '2026-09' or 'all'
  monthNameThai: string; // e.g. 'กันยายน 2569'
  yearBuddhist: number;
  totalOrders: number;
  totalRevenue: number;
  totalCups: number;
  promptPayRevenue: number;
  cashRevenue: number;
  counterRevenue: number;
  deliveryRevenue: number;
  totalDeliveryFees: number;
  estimatedCost: number;
  grossProfit: number;
  profitMarginPercent: number;
  topItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  dailyStats: Array<{
    dateStr: string;
    orderCount: number;
    revenue: number;
    cups: number;
  }>;
  orders: Order[];
}

// ฟังก์ชันสร้างรายงานสรุปรายเดือนสำหรับส่งออก Google Sheets
export function calculateMonthlyReport(
  orders: Order[],
  ingredients: Ingredient[],
  selectedMonthKey?: string // 'YYYY-MM' or undefined / 'all'
): MonthlyReportSummary {
  // Default to current month if not specified
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const targetKey = selectedMonthKey || currentKey;

  const filteredOrders = orders.filter((ord) => {
    if (ord.status === 'voided') return false;
    if (targetKey === 'all') return true;
    const d = new Date(ord.createdAt);
    const ordKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return ordKey === targetKey;
  });

  // Calculate base metrics
  const totalOrders = filteredOrders.length;
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalDeliveryFees = filteredOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

  const promptPayRevenue = filteredOrders
    .filter((o) => o.paymentMethod === 'promptpay')
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const cashRevenue = filteredOrders
    .filter((o) => o.paymentMethod === 'cash')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const counterRevenue = filteredOrders
    .filter((o) => o.channel === 'counter')
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const deliveryRevenue = filteredOrders
    .filter((o) => o.channel === 'online' || o.isDelivery)
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const totalCups = filteredOrders.reduce(
    (sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0),
    0
  );

  // Top Items sold in this month
  const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  filteredOrders.forEach((o) => {
    o.items.forEach((it) => {
      const key = it.menuItemName;
      if (!itemMap[key]) {
        itemMap[key] = { name: key, quantity: 0, revenue: 0 };
      }
      itemMap[key].quantity += it.quantity;
      itemMap[key].revenue += it.price * it.quantity;
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);

  // Daily stats breakdown
  const dailyMap: Record<string, { dateStr: string; orderCount: number; revenue: number; cups: number }> = {};
  filteredOrders.forEach((o) => {
    const d = new Date(o.createdAt);
    const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { dateStr, orderCount: 0, revenue: 0, cups: 0 };
    }
    dailyMap[dateStr].orderCount += 1;
    dailyMap[dateStr].revenue += o.totalAmount;
    dailyMap[dateStr].cups += o.items.reduce((s, it) => s + it.quantity, 0);
  });
  const dailyStats = Object.values(dailyMap);

  // Estimated COGS cost (~38% of revenue for smoothie & ingredients)
  const estimatedCost = Math.round(totalRevenue * 0.38);
  const grossProfit = Math.max(0, totalRevenue - estimatedCost);
  const profitMarginPercent = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

  // Month Title
  let monthNameThai = 'ข้อมูลทุกช่วงเวลา (All-Time)';
  let yearBuddhist = now.getFullYear() + 543;
  if (targetKey !== 'all') {
    const [yStr, mStr] = targetKey.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    const yNum = parseInt(yStr, 10);
    yearBuddhist = yNum + 543;
    monthNameThai = `${THAI_MONTH_NAMES[mIdx] || ''} ${yearBuddhist}`;
  }

  return {
    monthKey: targetKey,
    monthNameThai,
    yearBuddhist,
    totalOrders,
    totalRevenue,
    totalCups,
    promptPayRevenue,
    cashRevenue,
    counterRevenue,
    deliveryRevenue,
    totalDeliveryFees,
    estimatedCost,
    grossProfit,
    profitMarginPercent,
    topItems,
    dailyStats,
    orders: filteredOrders,
  };
}

// สร้างข้อมูลสรุปรายเดือนในรูปแบบ CSV สำหรับเปิดใน Google Sheets / Excel
export function generateMonthlyGoogleSheetsCSV(report: MonthlyReportSummary, shopName = 'COCO BEAR / PANG BEAR'): string {
  const lines: string[] = [];

  // Header Banner
  lines.push(`"สรุปยอดขายประจำเดือน ร้าน ${shopName.replace(/"/g, '""')}"`);
  lines.push(`"ประจำเดือน","${report.monthNameThai}"`);
  lines.push(`"วันที่ออกรายงาน","${new Date().toLocaleString('th-TH')}"`);
  lines.push('');

  // Key KPI Summary
  lines.push('"=== ภาพรวมผลประกอบการประจำเดือน (Monthly Overview) ==="');
  lines.push(`"ยอดขายรวมทั้งเดือน (บาท)",${report.totalRevenue}`);
  lines.push(`"จำนวนแก้วที่ขายได้ทั้งหมด (แก้ว)",${report.totalCups}`);
  lines.push(`"จำนวนออเดอร์ทั้งหมด (บิล)",${report.totalOrders}`);
  lines.push(`"ยอดชำระผ่านพร้อมเพย์ (บาท)",${report.promptPayRevenue}`);
  lines.push(`"ยอดชำระเงินสด (บาท)",${report.cashRevenue}`);
  lines.push(`"ยอดขายหน้าร้าน POS (บาท)",${report.counterRevenue}`);
  lines.push(`"ยอดขายเดลิเวอรี่/ออนไลน์ (บาท)",${report.deliveryRevenue}`);
  lines.push(`"ค่าจัดส่งรวม (บาท)",${report.totalDeliveryFees}`);
  lines.push(`"ต้นทุนวัตถุดิบประเมิน (บาท)",${report.estimatedCost}`);
  lines.push(`"กำไรขั้นต้นประเมิน (บาท)",${report.grossProfit}`);
  lines.push(`"อัตรากำไรขั้นต้น (%)",${report.profitMarginPercent}%`);
  lines.push('');

  // Top Items Table
  lines.push('"=== อันดับเมนูขายดีประจำเดือน (Top Monthly Smoothies) ==="');
  lines.push('"อันดับ","ชื่อเมนูน้ำปั่น/เครื่องดื่ม","จำนวนแก้วที่ขายได้","ยอดขายรวม (บาท)"');
  report.topItems.forEach((item, idx) => {
    lines.push(`${idx + 1},"${item.name.replace(/"/g, '""')}",${item.quantity},${item.revenue}`);
  });
  lines.push('');

  // Detailed Orders Table
  lines.push('"=== บันทึกรายการออเดอร์ทั้งหมดในเดือนนี้ (Detailed Transactions) ==="');
  lines.push(
    '"เลขออเดอร์","วัน-เวลาที่สั่ง","ช่องทาง","ประเภท","รายการเมนูที่สั่ง","ยอดรวม (บาท)","วิธีชำระเงิน","สถานะ","ที่อยู่จัดส่ง","เบอร์โทรติดต่อ","ค่าส่ง (บาท)"'
  );
  report.orders.forEach((ord) => {
    const itemsStr = ord.items
      .map((it) => `${it.menuItemName} x${it.quantity} (หวาน ${it.sweetness})`)
      .join('; ');
    const channelText = ord.channel === 'counter' ? 'หน้าร้าน (POS)' : 'ออนไลน์/QR';
    const deliveryText = ord.isDelivery ? 'เดลิเวอรี่' : 'รับหน้าร้าน';
    const payText = ord.paymentMethod === 'promptpay' ? 'พร้อมเพย์' : 'เงินสด';
    const timeStr = new Date(ord.createdAt).toLocaleString('th-TH');

    lines.push(
      [
        `"${ord.orderNumber}"`,
        `"${timeStr}"`,
        `"${channelText}"`,
        `"${deliveryText}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
        ord.totalAmount,
        `"${payText}"`,
        `"${ord.status}"`,
        ord.deliveryInfo ? `"${ord.deliveryInfo.address.replace(/"/g, '""')}"` : '"-"',
        `"${ord.deliveryInfo?.phone || '-'}"`,
        ord.deliveryFee || 0,
      ].join(',')
    );
  });

  return lines.join('\n');
}

// สร้างข้อมูลสำหรับคัดลอกลง Clipboard (Tab-separated values) สำหรับกด Ctrl+V ใน Google Sheets
export function generateMonthlyGoogleSheetsClipboardTSV(
  report: MonthlyReportSummary,
  shopName = 'COCO BEAR / PANG BEAR'
): string {
  const lines: string[] = [];

  lines.push(`รายงานสรุปยอดขายประจำเดือน\t${shopName}`);
  lines.push(`ประจำเดือน\t${report.monthNameThai}`);
  lines.push(`วันที่ส่งออก\t${new Date().toLocaleString('th-TH')}`);
  lines.push('');
  lines.push('ภาพรวมผลประกอบการ\tยอดตัวเลข');
  lines.push(`ยอดขายรวมทั้งเดือน (บาท)\t${report.totalRevenue}`);
  lines.push(`จำนวนแก้วทั้งหมด (แก้ว)\t${report.totalCups}`);
  lines.push(`จำนวนออเดอร์ (บิล)\t${report.totalOrders}`);
  lines.push(`ยอดชำระพร้อมเพย์ (บาท)\t${report.promptPayRevenue}`);
  lines.push(`ยอดชำระเงินสด (บาท)\t${report.cashRevenue}`);
  lines.push(`ยอดขายหน้าร้าน POS (บาท)\t${report.counterRevenue}`);
  lines.push(`ยอดขายเดลิเวอรี่ (บาท)\t${report.deliveryRevenue}`);
  lines.push(`ค่าจัดส่งรวม (บาท)\t${report.totalDeliveryFees}`);
  lines.push(`ต้นทุนวัตถุดิบประเมิน (บาท)\t${report.estimatedCost}`);
  lines.push(`กำไรขั้นต้นประเมิน (บาท)\t${report.grossProfit}`);
  lines.push(`อัตรากำไร (%)\t${report.profitMarginPercent}%`);
  lines.push('');
  lines.push('อันดับเมนูขายดีประจำเดือน\tจำนวนแก้ว\tยอดขาย (บาท)');
  report.topItems.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.name}\t${item.quantity}\t${item.revenue}`);
  });
  lines.push('');
  lines.push('เลขออเดอร์\tวัน-เวลา\tช่องทาง\tรายการที่สั่ง\tยอดเงิน (บาท)\tวิธีชำระ\tสถานะ\tที่อยู่จัดส่ง');
  report.orders.forEach((ord) => {
    const itemsStr = ord.items.map((it) => `${it.menuItemName} x${it.quantity}`).join(', ');
    const channelText = ord.channel === 'counter' ? 'หน้าร้าน' : 'ออนไลน์';
    const payText = ord.paymentMethod === 'promptpay' ? 'พร้อมเพย์' : 'เงินสด';
    const timeStr = new Date(ord.createdAt).toLocaleString('th-TH');
    lines.push(
      `${ord.orderNumber}\t${timeStr}\t${channelText}\t${itemsStr}\t${ord.totalAmount}\t${payText}\t${ord.status}\t${ord.deliveryInfo?.address || '-'}`
    );
  });

  return lines.join('\n');
}
