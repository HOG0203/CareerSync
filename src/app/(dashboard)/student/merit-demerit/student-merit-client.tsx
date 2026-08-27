'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Scale, 
  Sparkles, 
  AlertTriangle, 
  PlusCircle, 
  MinusCircle, 
  Calendar, 
  User, 
  KeyRound, 
  FileText
} from 'lucide-react';
import { ChangePasswordDialog } from '../certification/change-password-dialog';

interface StudentInfo {
  id: string;
  student_name: string;
  student_number: string;
  major: string;
  class_info: string;
  grade: number;
}

interface MeritRecord {
  id: string;
  rule_name: string;
  type: 'merit' | 'demerit';
  points: number;
  date: string;
  memo?: string;
  granted_by?: {
    userName?: string;
    role?: string;
  };
  created_at?: string;
}

interface StudentMeritClientProps {
  student: StudentInfo;
  records: MeritRecord[];
  baseYear: number;
}

export function StudentMeritClient({ student, records, baseYear }: StudentMeritClientProps) {
  const [filterType, setFilterType] = React.useState<'all' | 'merit' | 'demerit'>('all');
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);

  // 정렬: 최신 일자순
  const sortedRecords = React.useMemo(() => {
    return [...records].sort((a, b) => 
      b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || '')
    );
  }, [records]);

  // 통계 계산
  const totalMerit = React.useMemo(() => {
    return records.filter(r => r.type === 'merit').reduce((acc, r) => acc + (r.points || 0), 0);
  }, [records]);

  const totalDemerit = React.useMemo(() => {
    return records.filter(r => r.type === 'demerit').reduce((acc, r) => acc + (r.points || 0), 0);
  }, [records]);

  const netPoints = totalMerit - totalDemerit;

  // 필터링된 레코드
  const filteredRecords = React.useMemo(() => {
    if (filterType === 'merit') return sortedRecords.filter(r => r.type === 'merit');
    if (filterType === 'demerit') return sortedRecords.filter(r => r.type === 'demerit');
    return sortedRecords;
  }, [sortedRecords, filterType]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. 학생 프로필 헤더 카드 */}
      <Card className="border-slate-200/80 shadow-xs rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Scale className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-indigo-500/80 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {baseYear}학년도
                </Badge>
                <Badge className="bg-emerald-500/80 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {student.grade}학년
                </Badge>
                <span className="text-xs text-indigo-200 font-medium">대구공업고등학교</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1 flex items-center gap-2">
                <span>{student.student_name}</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-300">
                  ({student.major} {student.class_info}반 {student.student_number}번)
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasswordDialogOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold h-9 rounded-xl shadow-xs"
            >
              <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              비밀번호 변경
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. 상벌점 핵심 3종 KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* 상점 */}
        <Card className="border-slate-200/80 shadow-xs rounded-2xl bg-white hover:border-emerald-200 transition-all">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
                누적 상점 (Merit)
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-black text-emerald-600">
                  +{totalMerit}
                </span>
                <span className="text-xs font-bold text-slate-500">점</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                총 {records.filter(r => r.type === 'merit').length}건 부여됨
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* 벌점 */}
        <Card className="border-slate-200/80 shadow-xs rounded-2xl bg-white hover:border-rose-200 transition-all">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <MinusCircle className="h-3.5 w-3.5 text-rose-600" />
                누적 벌점 (Demerit)
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-black text-rose-600">
                  -{totalDemerit}
                </span>
                <span className="text-xs font-bold text-slate-500">점</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                총 {records.filter(r => r.type === 'demerit').length}건 부여됨
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* 최종 점수 */}
        <Card className="border-slate-200/80 shadow-xs rounded-2xl bg-white hover:border-indigo-200 transition-all">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Scale className="h-3.5 w-3.5 text-indigo-600" />
                최종 누적 점수 (Net Score)
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-3xl sm:text-4xl font-black ${netPoints >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                  {netPoints > 0 ? `+${netPoints}` : netPoints}
                </span>
                <span className="text-xs font-bold text-slate-500">점</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                (상점 {totalMerit}점 - 벌점 {totalDemerit}점)
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
              <Scale className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. 상세 내역 목록 카드 */}
      <Card className="border-slate-200/80 shadow-xs rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              상벌점 상세 내역
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              교내 생활지도 규정에 따라 부여된 상점 및 벌점의 일자별 상세 내역입니다.
            </CardDescription>
          </div>

          {/* 필터 탭 버튼 */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl gap-1 shrink-0 self-start sm:self-center">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 ({records.length})
            </button>
            <button
              onClick={() => setFilterType('merit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === 'merit'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              상점 ({records.filter(r => r.type === 'merit').length})
            </button>
            <button
              onClick={() => setFilterType('demerit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === 'demerit'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              벌점 ({records.filter(r => r.type === 'demerit').length})
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredRecords.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredRecords.map((r, idx) => {
                const isMerit = r.type === 'merit';
                return (
                  <div 
                    key={r.id || idx}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isMerit 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {isMerit ? <PlusCircle className="h-5 w-5" /> : <MinusCircle className="h-5 w-5" />}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                            isMerit 
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                              : 'bg-rose-600 text-white hover:bg-rose-700'
                          }`}>
                            {isMerit ? `상점 +${r.points}점` : `벌점 -${r.points}점`}
                          </Badge>
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {r.rule_name}
                          </h4>
                        </div>

                        {r.memo && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed break-keep">
                            💬 <strong>사유/메모:</strong> {r.memo}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div className="flex items-center gap-1 font-mono">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{r.date}</span>
                      </div>
                      {r.granted_by?.userName && (
                        <div className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[11px] font-medium">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{r.granted_by.userName} 선생님</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Scale className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-500">
                {filterType === 'all' 
                  ? '등록된 상벌점 내역이 없습니다.' 
                  : filterType === 'merit' 
                  ? '부여된 상점 내역이 없습니다.' 
                  : '부여된 벌점 내역이 없습니다.'}
              </p>
              <p className="text-xs text-slate-400">
                선생님이 상점 또는 벌점을 부여하면 이곳에 실시간으로 기록됩니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 비밀번호 변경 다이얼로그 */}
      <ChangePasswordDialog 
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />
    </div>
  );
}
