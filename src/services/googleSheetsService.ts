import { getAccessToken } from './googleAuth';
import { MonthlyReportSummary } from '../utils/helpers';
import { Ingredient } from '../types';

export interface CreateSheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

/**
 * Creates a real Google Sheet with styled cells, monthly summary, product sales, and ABC analysis.
 */
export async function createMonthlyReportSpreadsheet(
  report: MonthlyReportSummary,
  shopName: string,
  ingredients: Ingredient[]
): Promise<CreateSheetResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ Google เพื่อสร้าง Google Sheets ใน Google Drive ของคุณ');
  }

  const title = `รายงานสรุปยอดขาย & สต็อก ${shopName} - ${report.monthNameThai}`;

  // 1. Create Spreadsheet via Google Sheets v4 API
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: 'สรุปภาพรวมรายเดือน',
            gridProperties: {
              frozenRowCount: 2,
            },
          },
        },
        {
          properties: {
            title: 'ยอดขายรายเมนู',
            gridProperties: {
              frozenRowCount: 2,
            },
          },
        },
        {
          properties: {
            title: 'วัตถุดิบคงคลัง & ABC',
            gridProperties: {
              frozenRowCount: 2,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `สร้าง Google Sheet ไม่สำเร็จ (${createRes.status})`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // 2. Populate Data into "สรุปภาพรวมรายเดือน"
  const summaryValues = [
    [`รายงานสรุปยอดขายและผลประกอบการร้าน ${shopName}`],
    ['ประจำเดือน / รอบเวลา', report.monthNameThai],
    ['ข้อมูล ณ วันที่', new Date().toLocaleString('th-TH')],
    [],
    ['หัวข้อ', 'จำนวน / ยอดรวม', 'หน่วย'],
    ['ยอดขายรวมทั้งหมด (Revenue)', report.totalRevenue, 'บาท'],
    ['ต้นทุนวัตถุดิบประเมิน (COGS)', report.estimatedCost, 'บาท'],
    ['กำไรขั้นต้น (Gross Profit)', report.grossProfit, 'บาท'],
    ['อัตรากำไรขั้นต้น (Profit Margin)', `${report.profitMarginPercent}%`, 'เปอร์เซ็นต์'],
    ['จำนวนแก้วที่ขายได้ทั้งหมด', report.totalCups, 'แก้ว'],
    ['จำนวนออเดอร์ทั้งหมด', report.totalOrders, 'ออเดอร์'],
    [
      'ยอดขายเฉลี่ยต่อออเดอร์',
      report.totalOrders > 0 ? Math.round(report.totalRevenue / report.totalOrders) : 0,
      'บาท/ออเดอร์',
    ],
    [],
    ['ช่องทางการขาย', 'ยอดขาย (บาท)', 'สัดส่วน (%)'],
    [
      'หน้าร้าน POS',
      report.counterRevenue,
      report.totalRevenue > 0
        ? `${((report.counterRevenue / report.totalRevenue) * 100).toFixed(1)}%`
        : '0%',
    ],
    [
      'สั่งออนไลน์ / Delivery',
      report.deliveryRevenue,
      report.totalRevenue > 0
        ? `${((report.deliveryRevenue / report.totalRevenue) * 100).toFixed(1)}%`
        : '0%',
    ],
    [],
    ['วิธีการชำระเงิน', 'ยอดเงิน (บาท)', 'หมายเหตุ'],
    ['สแกน PromptPay QR', report.promptPayRevenue, 'โอนเงิน'],
    ['เงินสด (Cash)', report.cashRevenue, 'เงินสด'],
  ];

  // 3. Populate Data into "ยอดขายรายเมนู"
  const menuValues = [
    [`ยอดขายแยกตามเมนูร้าน ${shopName}`],
    ['อันดับ', 'ชื่อเมนู', 'จำนวนที่ขายได้ (แก้ว)', 'ยอดขายรวม (บาท)', 'สัดส่วนยอดขาย (%)'],
    ...report.topItems.map((m, idx) => [
      idx + 1,
      m.name,
      m.quantity,
      m.revenue,
      report.totalRevenue > 0
        ? `${((m.revenue / report.totalRevenue) * 100).toFixed(1)}%`
        : '0%',
    ]),
  ];

  // 4. Populate Data into "วัตถุดิบคงคลัง & ABC"
  const inventoryValues = [
    [`รายการวัตถุดิบและสถานะการจัดวาง ABC - ${shopName}`],
    ['รหัส', 'ชื่อวัตถุดิบ', 'หมวดหมู่', 'สต็อกคงเหลือ', 'หน่วย', 'จุดจัดวาง', 'สถานะความปลอดภัย'],
    ...ingredients.map((ing) => {
      const isLow = ing.currentStock <= (ing.isSpike ? ing.dynamicMinStock : ing.minStock);
      const slotText =
        ing.placementSlot === 'golden_zone'
          ? 'จุดเอื้อมมือ (0 ก้าว)'
          : ing.placementSlot === 'secondary_zone'
          ? 'ก้าว 1 ก้าว (1.2 ม.)'
          : 'หลังร้าน (3.5 ม.)';
      return [
        ing.id,
        ing.name,
        ing.category,
        ing.currentStock,
        ing.unit,
        slotText,
        isLow ? '⚠️ สต็อกต่ำกว่าเกณฑ์' : '✅ ปกติ',
      ];
    }),
  ];

  // Write values batchUpdate to Google Sheets
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: "'สรุปภาพรวมรายเดือน'!A1",
            values: summaryValues,
          },
          {
            range: "'ยอดขายรายเมนู'!A1",
            values: menuValues,
          },
          {
            range: "'วัตถุดิบคงคลัง & ABC'!A1",
            values: inventoryValues,
          },
        ],
      }),
    }
  );

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
  };
}
