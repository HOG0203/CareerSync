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
    <div className="space-y-6">
      {/* 1. 상단 타이틀 & 컨트롤 헤더 바 */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-indigo-600 tracking-wider uppercase">교수학습지원</span>
                <span className="text-slate-300">/</span>
                <span className="text-[11px] font-bold text-slate-500">시간표 관리</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                시간표 조회 및 관리
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 pl-12">
            전체 교사 시간표 엑셀 양식을 업로드하여 교사별·학반별 주간 시간표 및 시수를 스마트하게 관리합니다.
          </p>
        </div>

        {/* 상단 액션 컨트롤 그룹 */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto pl-12 md:pl-0">
          {/* 학년도/학기 선택 셀렉터 */}
          {schedules.length > 0 && (
            <Select
              value={currentScheduleKey}
              onValueChange={handleScheduleChange}
            >
              <SelectTrigger className="w-[185px] h-10 text-xs font-black bg-slate-50 border-slate-200 text-slate-800 rounded-xl">
                <CalendarDays className="h-4 w-4 text-indigo-600 mr-1 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {schedules.map(s => (
                  <SelectItem key={s.id} value={`${s.academicYear}_${s.semester}`} className="text-xs font-bold">
                    {s.academicYear}학년도 {s.semester}학기
                    {s.effectiveDate && <span className="text-slate-400 font-normal ml-1">({s.effectiveDate})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 시수 가중치 설정 버튼 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsWeightModalOpen(true)}
            className="h-10 text-xs font-bold gap-1.5 rounded-xl border-slate-200 hover:bg-indigo-50 hover:text-indigo-900 text-slate-700 shadow-2xs"
          >
            <Scale className="h-4 w-4 text-indigo-600" />
            시수 가중치 설정
          </Button>

          {/* 시간표 엑셀 업로드 버튼 */}
          <Button
            type="button"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="h-10 text-xs font-bold gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <UploadCloud className="h-4 w-4" />
            시간표 엑셀 업로드
          </Button>

          {/* 삭제 버튼 (관리자용) */}
          {isAdmin && data && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDeleteSchedule}
              className="h-10 w-10 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
              title="현재 학기 시간표 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 2. 뷰 모드 탭 (교사별 / 학반별 / 전체 매트릭스) */}
      {data ? (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl max-w-md">
            <button
              type="button"
              onClick={() => setActiveTab('teacher')}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5",
                activeTab === 'teacher'
                  ? "bg-white text-indigo-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <User className="h-3.5 w-3.5 text-indigo-600" />
              <span>교사별 시간표</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('class')}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5",
                activeTab === 'class'
                  ? "bg-white text-indigo-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>학반별 시간표</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5",
                activeTab === 'matrix'
                  ? "bg-white text-indigo-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-amber-600" />
              <span>전체 매트릭스</span>
            </button>
          </div>

          {/* 3. 선택된 탭 뷰 렌더링 */}
          {activeTab === 'teacher' && (
            <TeacherTimetableView
              data={data}
              currentWeights={weights}
              currentUsername={userProfile?.username}
              currentUserFullName={userProfile?.full_name}
            />
          )}

          {activeTab === 'class' && (
            <ClassTimetableView
              data={data}
              currentWeights={weights}
              userAssignedGrade={userProfile?.assigned_grade}
              userAssignedClass={userProfile?.assigned_class}
              currentUserFullName={userProfile?.full_name || userProfile?.name}
            />
          )}

          {activeTab === 'matrix' && (
            <AllMatrixTimetableView
              data={data}
              currentWeights={weights}
            />
          )}
        </div>
      ) : (
        /* 4. 시간표 데이터가 없을 때의 친절한 안내 카드 */
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-4 max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FileSpreadsheet className="h-8 w-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-800">
              등록된 시간표 데이터가 없습니다
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md">
              상단의 <strong className="text-indigo-600">[시간표 엑셀 업로드]</strong> 버튼을 눌러 로컬의 
              <strong>`2. 2026학년도 2학기 전체교사시간표.xlsx`</strong> 파일을 등록해보세요!
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="mt-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-6 gap-2 shadow-md"
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
