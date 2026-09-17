import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  getCurrentUser,
  getAccessToken,
} from '../services/googleAuth';
import { createMonthlyReportSpreadsheet } from '../services/googleSheetsService';
import { calculateMonthlyReport } from '../utils/helpers';
import {
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Sparkles,
  CloudUpload,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface GoogleSheetsSyncPanelProps {
  selectedMonth?: string;
}

export const GoogleSheetsSyncPanel: React.FC<GoogleSheetsSyncPanelProps> = ({
  selectedMonth,
}) => {
  const { orders, ingredients, shopLocation } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [sheetResult, setSheetResult] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setCurrentUser(user);
      },
      () => {
        setCurrentUser(getCurrentUser());
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    setErrorMessage(null);
    setIsSigningIn(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setCurrentUser(res.user);
      }
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setErrorMessage(
        err?.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ โปรดลองอีกครั้ง'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setCurrentUser(null);
    setSheetResult(null);
  };

  const handleExportToGoogleSheets = async () => {
    setErrorMessage(null);
    const token = await getAccessToken();
    if (!token || !currentUser) {
      handleLogin();
      return;
    }

    setIsCreatingSheet(true);
    try {
      const report = calculateMonthlyReport(
        orders,
        ingredients,
        selectedMonth || 'all'
      );
      const res = await createMonthlyReportSpreadsheet(
        report,
        shopLocation.name,
        ingredients
      );
      setSheetResult({
        url: res.spreadsheetUrl,
        title: res.title,
      });
    } catch (err: any) {
      console.error('Export Google Sheets error:', err);
      setErrorMessage(
        err?.message ||
          'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets API โปรดตรวจสอบการอนุญาตสิทธิ์'
      );
    } finally {
      setIsCreatingSheet(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-emerald-300/80 p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-stone-900 leading-tight">
                เชื่อมต่อ Google Sheets โดยตรง (Real API Integration)
              </h3>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                สร้างสเปรดชีตจริง
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              ส่งออกสรุปรายได้ ต้นทุน กำไร ยอดขายรายเมนู และสต็อกวัตถุดิบเข้า Google Drive ของคุณในคลิกเดียว
            </p>
          </div>
        </div>

        {/* User profile / Login State */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-2xl">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Google User'}
                  className="w-6 h-6 rounded-full border border-emerald-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">
                  G
                </span>
              )}
              <div className="text-left">
                <div className="text-[11px] font-black text-emerald-950 truncate max-w-[130px]">
                  {currentUser.displayName || currentUser.email}
                </div>
                <div className="text-[9px] text-emerald-700 leading-none">
                  เข้าสู่ระบบแล้ว
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="ออกจากระบบ Google"
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              disabled={isSigningIn}
              className="bg-white hover:bg-stone-50 active:scale-95 border-2 border-stone-300 text-stone-800 px-3.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{isSigningIn ? 'กำลังเข้าสู่ระบบ...' : 'ลงชื่อเข้าใช้ Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Banner when sheet is generated */}
      {sheetResult && (
        <div className="bg-emerald-50 border-2 border-emerald-400 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs font-black text-emerald-950">
                สร้างสเปรดชีตใน Google Sheets ของคุณเรียบร้อยแล้ว!
              </div>
              <div className="text-[11px] text-emerald-800 mt-0.5">
                {sheetResult.title}
              </div>
            </div>
          </div>
          <a
            href={sheetResult.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <ExternalLink className="w-4 h-4" />
            <span>เปิด Google Sheet ที่สร้างใหม่ ↗</span>
          </a>
        </div>
      )}

      {/* Primary Action Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
        <div className="text-xs text-stone-600">
          <span className="font-bold text-stone-900 block mb-0.5">
            ส่งออก 3 แผ่นงานอัตโนมัติ:
          </span>
          1. สรุปภาพรวมรายได้/กำไร • 2. ยอดขายแยกตามเมนู • 3. วัตถุดิบคงคลัง & โซนจัดวาง ABC
        </div>

        <button
          type="button"
          onClick={handleExportToGoogleSheets}
          disabled={isCreatingSheet}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
        >
          {isCreatingSheet ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังสร้าง Google Sheet...</span>
            </>
          ) : (
            <>
              <CloudUpload className="w-4 h-4" />
              <span>
                {currentUser
                  ? '📊 บันทึกและเปิดใน Google Sheets ของฉัน'
                  : '🔑 ลงชื่อเข้าใช้ Google เพื่อสร้าง Google Sheets'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
