import { AlertCircle } from 'lucide-react';

export default function AttendancePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
      <div className="h-16 w-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">출결 현황 집계 준비중</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-xs">
        학생들의 출결 데이터를 한눈에 확인하고 인증할 수 있는 기능을 준비하고 있습니다.
      </p>
    </div>
  );
}
