'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/timetable/timetable-client.tsx
// 시간표 조회 및 관리 종합 클라이언트 허브
// ==============================================================================

import * as React from 'react';
import { 
  ParsedTimetableResult 
} from '@/lib/timetable/parser';
import { 
  ActivityWeightConfig, 
  DEFAULT_ACTIVITY_WEIGHTS 
} from '@/lib/timetable/constants';
import { 
  ScheduleListItem, 
  getTimetableData, 
  deleteTimetable 
} from './actions';
import { TeacherTimetableView } from './teacher-timetable-view';
import { ClassTimetableView } from './class-timetable-view';
import { AllMatrixTimetableView } from './all-matrix-timetable-view';
import { TimetableImportModal } from './timetable-import-modal';
import { WeightSettingsModal } from './weight-settings-modal';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CalendarDays, 
  User, 
  Building2, 
  LayoutGrid, 
  Scale, 
  UploadCloud, 
  Trash2, 
  Sparkles, 
  BookOpenCheck,
  FileSpreadsheet,
  AlertCircle,
  Clock
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TimetableClientProps {
  initialData?: ParsedTimetableResult;
  schedulesList: ScheduleListItem[];
  initialWeights: ActivityWeightConfig;
  userProfile?: any;
  isAdmin?: boolean;
}

export function TimetableClient({
  initialData,
  schedulesList,
  initialWeights,
  userProfile,
  isAdmin = false,
}: TimetableClientProps) {
  const [data, setData] = React.useState<ParsedTimetableResult | undefined>(initialData);
  const [schedules, setSchedules] = React.useState<ScheduleListItem[]>(schedulesList);
  const [weights, setWeights] = React.useState<ActivityWeightConfig>(initialWeights);
  const [activeTab, setActiveTab] = React.useState<'teacher' | 'class' | 'matrix'>('teacher');
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(false);

  const currentYear = data?.academicYear || schedules[0]?.academicYear || new Date().getFullYear();
  const currentSem = data?.semester || schedules[0]?.semester || 2;
  const currentScheduleKey = `${currentYear}_${currentSem}`;

  const handleScheduleChange = async (key: string) => {
    const parts = key.split('_');
    if (parts.length !== 2) return;
    const y = parseInt(parts[0]);
    const s = parseInt(parts[1]);

    setIsLoadingData(true);
    try {
      const res = await getTimetableData(y, s);
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      toast({
        title: "데이터 로드 실패",
        description: err.message || "시간표 데이터를 불러오지 못했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleUploadSuccess = (newData: ParsedTimetableResult) => {
    setData(newData);
    const key = `${newData.academicYear}_${newData.semester}`;
    const exists = schedules.find(s => s.academicYear === newData.academicYear && s.semester === newData.semester);
    if (!exists) {
      setSchedules(prev => [
        {
          id: key,
          academicYear: newData.academicYear,
          semester: newData.semester,
          title: newData.title,
          effectiveDate: newData.effectiveDate,
          totalTeachers: newData.totalTeachers,
          totalClasses: newData.totalClasses,
          totalSlots: newData.totalSlots,
          updatedAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!data) return;
    if (!confirm(`${data.academicYear}학년도 ${data.semester}학기 시간표 데이터를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const res = await deleteTimetable(data.academicYear, data.semester);
      if (res.success) {
        toast({
          title: "시간표 삭제 완료",
          description: "선택한 학기의 시간표가 삭제되었습니다.",
        });
        const nextSchedules = schedules.filter(
          s => !(s.academicYear === data.academicYear && s.semester === data.semester)
        );
        setSchedules(nextSchedules);
        if (nextSchedules.length > 0) {
          handleScheduleChange(`${nextSchedules[0].academicYear}_${nextSchedules[0].semester}`);
        } else {
          setData(undefined);
        }
      }
    } catch (err: any) {
      toast({
        title: "삭제 실패",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full pt-1">
      {/* 1. 상단 타이틀 헤더 (class-management 스타일) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <BookOpenCheck className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
              시간표 조회 및 관리
            </h2>
            {data && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-100 hidden sm:inline-flex items-center gap-1">
                <Clock className="h-3 w-3 text-blue-600" />
                {data.academicYear}학년도 {data.semester}학기
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            전체 교사 시간표를 기반으로 교사별·학반별 주간 수업 일정 및 시수 가중치를 스마트하게 확인·관리합니다.
          </p>
        </div>

        {/* 상단 우측 액션 버튼 그룹 */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* 학년도/학기 선택 셀렉터 캡슐 */}
          {schedules.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
              <CalendarDays className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <Select
                value={currentScheduleKey}
                onValueChange={handleScheduleChange}
                disabled={isLoadingData}
              >
                <SelectTrigger className="w-[140px] sm:w-[155px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl shadow-lg border-slate-200">
                  {schedules.map(s => (
                    <SelectItem key={s.id} value={`${s.academicYear}_${s.semester}`} className="text-xs font-bold py-1.5">
                      {s.academicYear}년 {s.semester}학기
                      {s.effectiveDate && <span className="text-slate-400 font-normal ml-1">({s.effectiveDate})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 시수 가중치 설정 버튼 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsWeightModalOpen(true)}
            className="h-9 text-xs font-bold gap-1.5 rounded-xl border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs"
          >
            <Scale className="h-3.5 w-3.5 text-blue-600" />
            시수 가중치
          </Button>

          {/* 시간표 엑셀 업로드 버튼 */}
          <Button
            type="button"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="h-9 text-xs font-bold gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            시간표 엑셀 업로드
          </Button>

          {/* 삭제 버튼 (관리자용) */}
          {isAdmin && data && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDeleteSchedule}
              className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
              title="현재 학기 시간표 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 2. 메인 컨텐츠 영역 (통합 컨트롤 바 + 테이블) */}
      {data ? (
        <div className="space-y-3">
          {activeTab === 'teacher' && (
            <TeacherTimetableView
              data={data}
              currentWeights={weights}
              currentUsername={userProfile?.username}
              currentUserFullName={userProfile?.full_name}
              tabSelector={
                <div className="flex items-center gap-1 p-0.5 bg-slate-100/90 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('teacher')}
                    className="px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 bg-white text-blue-900 shadow-2xs border border-slate-200/60"
                  >
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    <span>교사별</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('class')}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  >
                    <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>학반별</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('matrix')}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  >
                    <LayoutGrid className="h-3.5 w-3.5 text-amber-600" />
                    <span>전체</span>
                  </button>
                </div>
              }
            />
          )}

          {activeTab === 'class' && (
            <ClassTimetableView
              data={data}
              currentWeights={weights}
              userAssignedGrade={userProfile?.assigned_grade}
              userAssignedClass={userProfile?.assigned_class}
              currentUserFullName={userProfile?.full_name || userProfile?.name}
              tabSelector={
                <div className="flex items-center gap-1 p-0.5 bg-slate-100/90 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('teacher')}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  >
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    <span>교사별</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('class')}
                    className="px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 bg-white text-emerald-900 shadow-2xs border border-slate-200/60"
                  >
                    <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>학반별</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('matrix')}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  >
                    <LayoutGrid className="h-3.5 w-3.5 text-amber-600" />
                    <span>전체</span>
                  </button>
                </div>
              }
            />
          )}

          {activeTab === 'matrix' && (
            <AllMatrixTimetableView
              data={data}
              currentWeights={weights}
              tabSelector={
                <div className="flex items-center gap-1 p-0.5 bg-slate-100/90 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('teacher')}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  >
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    <span>교사별</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('class')}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  >
                    <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>학반별</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('matrix')}
                    className="px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 bg-white text-amber-900 shadow-2xs border border-slate-200/60"
                  >
                    <LayoutGrid className="h-3.5 w-3.5 text-amber-600" />
                    <span>전체</span>
                  </button>
                </div>
              }
            />
          )}
        </div>
      ) : (
        /* 4. 시간표 데이터가 없을 때의 친절한 안내 카드 */
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-4 max-w-xl mx-auto my-12">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50/80 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-black text-slate-900">
              등록된 시간표 데이터가 없습니다
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md">
              상단의 <strong className="text-indigo-600 font-bold">[시간표 엑셀 업로드]</strong> 버튼을 눌러 교사 시간표 엑셀 파일(예: <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">2. 2026학년도 2학기 전체교사시간표.xlsx</span>)을 등록하세요.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="mt-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-6 gap-2 shadow-sm transition-all"
          >
            <UploadCloud className="h-4 w-4" />
            시간표 엑셀 파일 지금 업로드하기
          </Button>
        </div>
      )}

      {/* 모달 컴포넌트들 */}
      <TimetableImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      <WeightSettingsModal
        isOpen={isWeightModalOpen}
        onClose={() => setIsWeightModalOpen(false)}
        currentWeights={weights}
        onWeightsUpdated={setWeights}
      />
    </div>
  );
}
