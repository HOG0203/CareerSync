'use client';

import * as React from 'react';
import { 
  FullStudentEvaluation, 
  CertificationEvaluationData,
  calculateStudentFullEvaluation,
  evaluateContestList,
  ContestItem,
  IndustryEduItem
} from '@/lib/certification-calculator';
import { saveStudentEvaluationAction } from './actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CertificatePicker } from '@/components/dashboard/standard-spreadsheet-table/certificate-picker';
import { 
  Save, 
  Loader2, 
  Sparkles, 
  User, 
  Users,
  Award, 
  Plus, 
  Trash2, 
  X, 
  BookOpen, 
  Trophy, 
  GraduationCap,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvaluationEditModalProps {
  evaluation: FullStudentEvaluation | null;
  baseYear: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveSuccess?: () => void;
  masterCertificates?: any[];
}

const ALL_TERMS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'] as const;
const ALL_YEARS = ['1', '2', '3'] as const;

export function EvaluationEditModal({
  evaluation,
  baseYear,
  open,
  onOpenChange,
  onSaveSuccess,
  masterCertificates = [],
}: EvaluationEditModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  // 1. 자격증 목록 상태 및 피커 모달
  const [certificates, setCertificates] = React.useState<string[]>([]);
  const [isCertPickerOpen, setIsCertPickerOpen] = React.useState(false);

  // 2. 직업공통능력 평가 상태 (1, 2, 3학년 도메인 및 모의평가)
  const [vocalDetails, setVocalDetails] = React.useState({
    grade3: { korean: 0, english: 0, math: 0, problem: 0, isCompleted: false },
    grade2: { korean: 0, english: 0, math: 0, problem: 0, isCompleted: false },
    grade1: { korean: 0, english: 0, math: 0, problem: 0, isCompleted: false },
    mock: { korean: 0, english: 0, math: 0, problem: 0, isCompleted: false },
  });

  // 3. 취업역량 상세 상태
  const [industryEduList, setIndustryEduList] = React.useState<IndustryEduItem[]>([]);
  const [newEduItem, setNewEduItem] = React.useState({ dateOrTerm: '', title: '', remarks: '' });

  const [careerCourses, setCareerCourses] = React.useState<Record<string, string>>({});
  const [newCourse, setNewCourse] = React.useState({ term: '1-1', name: '', remarks: '' });

  const [majorClubs, setMajorClubs] = React.useState<Record<string, string>>({});
  const [newClub, setNewClub] = React.useState({ year: '1', name: '', remarks: '' });

  const [skillsContest, setSkillsContest] = React.useState<{
    level: 'national' | 'regional' | 'none';
    name: string;
    award: string;
    date: string;
  }>({ level: 'none', name: '', award: '', date: '' });
  const [newSkills, setNewSkills] = React.useState({
    date: '',
    level: 'regional' as 'regional' | 'national',
    name: '',
    award: '',
  });

  const [fieldTraining, setFieldTraining] = React.useState<{
    completed: boolean;
    company: string;
    period: string;
  }>({ completed: false, company: '', period: '' });

  const [apprenticeship, setApprenticeship] = React.useState<Record<string, string>>({});
  const [apprenticeCompany, setApprenticeCompany] = React.useState('');

  const [employedEarly, setEmployedEarly] = React.useState<{
    confirmed: boolean;
    company: string;
    date: string;
  }>({ confirmed: false, company: '', date: '' });

  // 4. 인성능력 상세 상태 (봉사 제외)
  const [artsSports, setArtsSports] = React.useState<Record<string, string>>({});
  const [newSports, setNewSports] = React.useState({ term: '1-1', name: '', remarks: '' });

  const [contestList, setContestList] = React.useState<ContestItem[]>([]);
  const [newContest, setNewContest] = React.useState<{
    dateOrTerm: string;
    category: '교내대회' | '교외대회';
    type: 'award' | 'participate';
    title: string;
    award: string;
  }>({
    dateOrTerm: '',
    category: '교내대회',
    type: 'award',
    title: '',
    award: '입상'
  });

  // 모달 오픈 시 기존 평가 데이터 로드
  React.useEffect(() => {
    if (evaluation) {
      const raw = evaluation.rawEvaluationData || { student_id: evaluation.studentId };
      const emp = raw.employment_details || {};
      const arts = raw.arts_contest_details || {};
      const voc = raw.vocational_details || {};

      setCertificates([...(evaluation.certificatesList || [])]);

      const parseDomainGrade = (g?: any) => {
        if (!g) {
          return { korean: 0, english: 0, math: 0, problem: 0, isCompleted: false };
        }
        const isComp = g.isCompleted !== false && (Number(g.korean || 0) > 0 || Number(g.english || 0) > 0 || Number(g.math || 0) > 0 || Number(g.problem || 0) > 0);
        return {
          korean: g.korean ?? 0,
          english: g.english ?? 0,
          math: g.math ?? 0,
          problem: g.problem ?? 0,
          isCompleted: isComp,
        };
      };

      setVocalDetails({
        grade3: parseDomainGrade(voc.grade3),
        grade2: parseDomainGrade(voc.grade2),
        grade1: parseDomainGrade(voc.grade1),
        mock: parseDomainGrade(voc.mock),
      });

      setIndustryEduList([...(emp.industry_edu_list || [])]);
      setCareerCourses({ ...(emp.career_courses || {}) });
      setMajorClubs({ ...(emp.major_clubs || {}) });
      setSkillsContest({
        level: emp.skills_contest?.level || (raw.skills_contest_level as any) || 'none',
        name: emp.skills_contest?.name || '',
        award: emp.skills_contest?.award || '',
        date: emp.skills_contest?.date || '',
      });
      setFieldTraining({
        completed: Boolean(emp.field_training?.completed || raw.field_training_completed),
        company: emp.field_training?.company || '',
        period: emp.field_training?.period || '',
      });
      setApprenticeship({ ...(emp.apprenticeship || {}) });
      setEmployedEarly({
        confirmed: Boolean(emp.employed_early?.confirmed || raw.employed_early),
        company: emp.employed_early?.company || '',
        date: emp.employed_early?.date || '',
      });

      setArtsSports({ ...(arts.arts_sports || {}) });
      setContestList([...(arts.contest_list || [])]);
    }
  }, [evaluation]);

  if (!evaluation) return null;

  const contestEval = evaluateContestList(contestList);

  // 실시간 종합 평가 계산용 데이터 조합
  const currentEvalData: CertificationEvaluationData = {
    student_id: evaluation.studentId,
    academic_year: baseYear,
    vocational_details: vocalDetails,
    industry_edu_count: industryEduList.length,
    career_course_semesters: Object.keys(careerCourses).length,
    major_club_years: Object.keys(majorClubs).length,
    skills_contest_level: skillsContest.level,
    field_training_completed: fieldTraining.completed,
    apprenticeship_semesters: Object.keys(apprenticeship).length,
    employed_early: employedEarly.confirmed,
    arts_sports_semesters: Object.keys(artsSports).length,
    contest_award_count: contestEval.effectiveAwardCount,
    contest_participate_count: contestEval.effectivePartCount,
    employment_details: {
      industry_edu_list: industryEduList,
      career_courses: careerCourses,
      major_clubs: majorClubs,
      skills_contest: skillsContest.level !== 'none' ? skillsContest : undefined,
      field_training: fieldTraining.completed ? fieldTraining : undefined,
      apprenticeship: Object.keys(apprenticeship).length > 0 ? apprenticeship : undefined,
      employed_early: employedEarly.confirmed ? employedEarly : undefined,
    },
    arts_contest_details: {
      arts_sports: artsSports,
      contest_list: contestList,
    },
    volunteer_school_hours: evaluation.rawEvaluationData?.volunteer_school_hours,
    volunteer_outside_hours: evaluation.rawEvaluationData?.volunteer_outside_hours,
  };

  // 실시간 점수 프리뷰
  const previewEvaluation = calculateStudentFullEvaluation({
    student: {
      id: evaluation.studentId,
      student_name: evaluation.studentName,
      student_number: evaluation.studentNumber,
      major: evaluation.major,
      class_info: evaluation.classInfo,
      graduation_year: evaluation.graduationYear,
      certificates: certificates,
    },
    attendanceRecords: [],
    evalData: {
      ...currentEvalData,
      manual_overrides: {
        attendance_score: evaluation.details.attendance.score,
      }
    },
    baseYear,
  });

  const handleRemoveCert = (cert: string) => {
    setCertificates(prev => prev.filter(c => c !== cert));
  };

  const handleAddEdu = () => {
    if (!newEduItem.title.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '교육 또는 설명회 명칭을 입력해주세요.' });
      return;
    }
    const id = `edu_${Date.now()}_${newEduItem.title}`;
    setIndustryEduList(prev => [...prev, { id, ...newEduItem }]);
    setNewEduItem({ dateOrTerm: '', title: '', remarks: '' });
  };

  const handleAddCourse = () => {
    if (!newCourse.name.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '취업진로코스 명칭을 입력해주세요.' });
      return;
    }
    const val = newCourse.name.trim() + (newCourse.remarks.trim() ? ` (${newCourse.remarks.trim()})` : '');
    setCareerCourses(prev => ({ ...prev, [newCourse.term]: val }));
    setNewCourse(prev => ({ ...prev, name: '', remarks: '' }));
  };

  const handleAddClub = () => {
    if (!newClub.name.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '전공심화동아리 명칭을 입력해주세요.' });
      return;
    }
    const val = newClub.name.trim() + (newClub.remarks.trim() ? ` (${newClub.remarks.trim()})` : '');
    setMajorClubs(prev => ({ ...prev, [newClub.year]: val }));
    setNewClub(prev => ({ ...prev, name: '', remarks: '' }));
  };

  const handleAddSkills = () => {
    if (!newSkills.name.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '대회 명칭을 입력해주세요.' });
      return;
    }
    setSkillsContest({
      level: newSkills.level,
      name: newSkills.name.trim(),
      award: newSkills.award.trim(),
      date: newSkills.date.trim(),
    });
    setNewSkills({ date: '', level: 'regional', name: '', award: '' });
  };

  const handleAddSports = () => {
    if (!newSports.name.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '활동부서명을 입력해주세요.' });
      return;
    }
    const val = newSports.name.trim() + (newSports.remarks.trim() ? ` (${newSports.remarks.trim()})` : '');
    setArtsSports(prev => ({ ...prev, [newSports.term]: val }));
    setNewSports(prev => ({ ...prev, name: '', remarks: '' }));
  };

  const handleAddContest = () => {
    if (!newContest.title.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '대회명을 입력해주세요.' });
      return;
    }
    const id = `ac_${Date.now()}_${newContest.title}_${newContest.type}`;
    setContestList(prev => [...prev, { id, ...newContest }]);
    setNewContest({
      dateOrTerm: '',
      category: '교내대회',
      type: 'award',
      title: '',
      award: '입상'
    });
  };

  const toggleTermSlot = (
    map: Record<string, string>, 
    setMap: React.Dispatch<React.SetStateAction<Record<string, string>>>, 
    term: string, 
    defaultVal: string
  ) => {
    setMap(prev => {
      const next = { ...prev };
      if (next[term]) {
        delete next[term];
      } else {
        next[term] = defaultVal.trim() || '참여';
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await saveStudentEvaluationAction(
        evaluation.studentId, 
        currentEvalData,
        certificates
      );
      if (res.success) {
        toast({
          title: '저장 완료',
          description: `${evaluation.studentName} 학생의 상세 실적이 저장되고 점수가 재산출되었습니다.`
        });
        onOpenChange(false);
        if (onSaveSuccess) onSaveSuccess();
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: res.error || '저장에 실패했습니다.'
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '저장 중 오류가 발생했습니다.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[96vw] p-0 max-h-[92vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border border-slate-100 bg-white">
        <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 mr-2">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 text-indigo-600 shadow-2xs">
                <User className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-2 text-slate-900 truncate">
                  인증 데이터 상세 실적 수정 & 보정
                </DialogTitle>
                <p className="text-slate-500 text-[11px] sm:text-xs font-bold mt-0.5 truncate">
                  {evaluation.studentName} • {evaluation.major} {evaluation.classInfo} {evaluation.studentNumber}번 ({evaluation.currentGrade}학년)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-indigo-50/80 px-3.5 py-2 rounded-xl border border-indigo-100 shrink-0 shadow-2xs">
              <Sparkles className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
              <div className="flex flex-col text-right">
                <div className="flex items-baseline justify-end gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">실시간 종합:</span>
                  <span className="text-base font-black text-indigo-700">{previewEvaluation.totalScore}점</span>
                  <Badge className="text-[10px] font-extrabold px-1.5 py-0 h-4 bg-indigo-600 text-white">
                    {previewEvaluation.rank}랭크
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600 mt-0.5">
                  <span>직공 {previewEvaluation.vocationalCommonScore}</span>
                  <span>•</span>
                  <span>전공 {previewEvaluation.majorScore}</span>
                  <span>•</span>
                  <span>취업 {previewEvaluation.employmentScore}</span>
                  <span>•</span>
                  <span>인성 {previewEvaluation.characterScore}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/60">
            <Tabs defaultValue="vocal" className="w-full">
              <TabsList className="grid grid-cols-3 mb-4 bg-slate-100/90 p-1 rounded-xl">
                <TabsTrigger value="vocal" className="text-[11px] sm:text-xs py-2 sm:py-1.5 px-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs">
                  <span className="hidden sm:inline">1. 직업공통 (직업공통능력/자격증)</span>
                  <span className="inline sm:hidden">1. 직업공통</span>
                </TabsTrigger>
                <TabsTrigger value="employment" className="text-[11px] sm:text-xs py-2 sm:py-1.5 px-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs">
                  <span className="hidden sm:inline">2. 취업역량 (교육/코스/동아리/실습)</span>
                  <span className="inline sm:hidden">2. 취업역량</span>
                </TabsTrigger>
                <TabsTrigger value="character" className="text-[11px] sm:text-xs py-2 sm:py-1.5 px-1 font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs">
                  <span className="hidden sm:inline">3. 인성능력 (예체능/대회)</span>
                  <span className="inline sm:hidden">3. 인성능력</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="vocal" className="space-y-4 m-0">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-indigo-600" />
                      취득 자격증 상세 관리 (자동 분류 및 배점)
                    </h4>
                    <span className="text-[11px] font-bold text-indigo-600">
                      총 {certificates.length}개 보유
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 min-h-[52px] items-center">
                    {certificates.length === 0 ? (
                      <span className="text-xs text-slate-400 font-medium">등록된 자격증이 없습니다. [자격증 추가] 버튼을 눌러 등록된 자격증을 선택하세요.</span>
                    ) : (
                      certificates.map(cert => (
                        <Badge 
                          key={cert} 
                          variant="secondary" 
                          className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold py-1 px-2.5 gap-1.5 shadow-2xs"
                        >
                          <span>{cert}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCert(cert)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-slate-500 font-medium">
                      시스템에 등록된 마스터 자격증 목록에서 검색 및 등급을 선택하여 손쉽게 추가할 수 있습니다.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setIsCertPickerOpen(true)}
                      className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm gap-1.5 shrink-0 rounded-xl shadow-xs transition-all active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                      <span>자격증 추가</span>
                    </Button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-indigo-600" />
                    직업공통능력평가 학년별 및 모의평가 영역 등급 (의사소통국어, 의사소통영어, 수리활용, 문제해결)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { 
                        key: 'grade3', 
                        title: '3학년 전국단위 직업공통능력 (7점)', 
                        scoreInfo: vocalDetails.grade3.isCompleted 
                          ? `합계 ${((vocalDetails.grade3.korean && vocalDetails.grade3.korean > 0) ? vocalDetails.grade3.korean : 5) + ((vocalDetails.grade3.english && vocalDetails.grade3.english > 0) ? vocalDetails.grade3.english : 5) + ((vocalDetails.grade3.math && vocalDetails.grade3.math > 0) ? vocalDetails.grade3.math : 5) + ((vocalDetails.grade3.problem && vocalDetails.grade3.problem > 0) ? vocalDetails.grade3.problem : 5)}등급 ➔ ${previewEvaluation.details.vocal3Grade.score}점` 
                          : '미응시(0점)' 
                      },
                      { 
                        key: 'grade2', 
                        title: '2학년 전국단위 직업공통능력 (5점)', 
                        scoreInfo: vocalDetails.grade2.isCompleted 
                          ? `합계 ${((vocalDetails.grade2.korean && vocalDetails.grade2.korean > 0) ? vocalDetails.grade2.korean : 5) + ((vocalDetails.grade2.english && vocalDetails.grade2.english > 0) ? vocalDetails.grade2.english : 5) + ((vocalDetails.grade2.math && vocalDetails.grade2.math > 0) ? vocalDetails.grade2.math : 5) + ((vocalDetails.grade2.problem && vocalDetails.grade2.problem > 0) ? vocalDetails.grade2.problem : 5)}등급 ➔ ${previewEvaluation.details.vocal2Grade.score}점` 
                          : '미응시(0점)' 
                      },
                      { 
                        key: 'grade1', 
                        title: '1학년 기초학력 직업공통능력 (3점)', 
                        scoreInfo: vocalDetails.grade1.isCompleted 
                          ? `합계 ${((vocalDetails.grade1.korean && vocalDetails.grade1.korean > 0) ? vocalDetails.grade1.korean : 5) + ((vocalDetails.grade1.english && vocalDetails.grade1.english > 0) ? vocalDetails.grade1.english : 5) + ((vocalDetails.grade1.math && vocalDetails.grade1.math > 0) ? vocalDetails.grade1.math : 5) + ((vocalDetails.grade1.problem && vocalDetails.grade1.problem > 0) ? vocalDetails.grade1.problem : 5)}등급 ➔ ${previewEvaluation.details.vocal1Grade.score}점` 
                          : '미응시(0점)' 
                      },
                      { 
                        key: 'mock', 
                        title: '모의평가 직업공통능력 (2점)', 
                        scoreInfo: vocalDetails.mock.isCompleted 
                          ? `합계 ${((vocalDetails.mock.korean && vocalDetails.mock.korean > 0) ? vocalDetails.mock.korean : 5) + ((vocalDetails.mock.english && vocalDetails.mock.english > 0) ? vocalDetails.mock.english : 5) + ((vocalDetails.mock.math && vocalDetails.mock.math > 0) ? vocalDetails.mock.math : 5) + ((vocalDetails.mock.problem && vocalDetails.mock.problem > 0) ? vocalDetails.mock.problem : 5)}등급 ➔ ${previewEvaluation.details.vocalMockGrade.score}점` 
                          : '미응시(0점)' 
                      },
                    ].map((g) => (
                      <div key={g.key} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-xs font-bold text-slate-900">{g.title}</span>
                          <span className="text-[10px] font-extrabold text-indigo-600">
                            {g.scoreInfo}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[
                            { key: 'korean', label: '의사소통국어' },
                            { key: 'english', label: '의사소통영어' },
                            { key: 'math', label: '수리활용' },
                            { key: 'problem', label: '문제해결' },
                          ].map((subj) => (
                            <div key={subj.key}>
                              <Label className="text-[10px] font-bold text-slate-600 truncate block mb-0.5">{subj.label}</Label>
                              <Select 
                                value={String((vocalDetails as any)[g.key][subj.key] ?? 0)} 
                                onValueChange={(v) => setVocalDetails(prev => ({ ...prev, [g.key]: { ...(prev as any)[g.key], [subj.key]: Number(v) } }))}
                              >
                                <SelectTrigger className="h-7 text-xs bg-white"><SelectValue placeholder="미응시" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1" className="text-xs font-bold text-indigo-700">1등급</SelectItem>
                                  <SelectItem value="2" className="text-xs font-bold text-blue-600">2등급</SelectItem>
                                  <SelectItem value="3" className="text-xs font-medium text-emerald-600">3등급</SelectItem>
                                  <SelectItem value="4" className="text-xs text-slate-700">4등급</SelectItem>
                                  <SelectItem value="5" className="text-xs text-slate-600">5등급</SelectItem>
                                  <SelectItem value="0" className="text-xs font-semibold text-rose-500">미응시 (5등급)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="checkbox"
                            id={`voc_${g.key}_complete`}
                            checked={(vocalDetails as any)[g.key].isCompleted}
                            onChange={(e) => setVocalDetails(prev => ({ ...prev, [g.key]: { ...(prev as any)[g.key], isCompleted: e.target.checked } }))}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <Label htmlFor={`voc_${g.key}_complete`} className="text-[11px] font-semibold text-slate-600 cursor-pointer">
                            응시 완료 (체크 해제 시 전체 미응시 최하점 반영)
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ========================================================================= */}
              {/* 탭 2: 취업역량강화 (산학교육·코스·동아리·기능대회·실습/도제/조기취업) */}
              {/* ========================================================================= */}
              <TabsContent value="employment" className="space-y-4 m-0">

                {/* 1. 산학협력부 주관 교육이수 (최대 10점) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-indigo-600" />
                      1. 산학협력부 주관 교육 및 설명회 이수 목록 (최대 10점)
                    </h4>
                    <span className="text-[11px] font-bold text-indigo-600">
                      {industryEduList.length}건 등록 ({previewEvaluation.details.industryEdu.score}점)
                    </span>
                  </div>

                  {/* 목록 테이블 */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2 w-24">일자</th>
                          <th className="p-2">교육 / 설명회 명칭</th>
                          <th className="p-2 w-28">비고</th>
                          <th className="p-2 w-12 text-center">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {industryEduList.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400 text-xs">
                              등록된 산학교육 실적이 없습니다. 아래에서 추가하세요.
                            </td>
                          </tr>
                        ) : (
                          industryEduList.map((edu) => (
                            <tr key={edu.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono text-[11px] text-slate-600">{edu.dateOrTerm || '-'}</td>
                              <td className="p-2 font-semibold text-slate-900">{edu.title}</td>
                              <td className="p-2 text-slate-500 text-[11px]">{edu.remarks || '-'}</td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setIndustryEduList(prev => prev.filter(e => e.id !== edu.id))}
                                  className="text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 행 추가 인풋 */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/90 p-3 rounded-xl border border-slate-200 items-center">
                    <div className="sm:col-span-3">
                      <Input
                        placeholder="일자 (예: 2026-07-10)"
                        value={newEduItem.dateOrTerm}
                        onChange={(e) => setNewEduItem(prev => ({ ...prev, dateOrTerm: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <Input
                        placeholder="교육명 (예: 대구교통공사 채용설명회)"
                        value={newEduItem.title}
                        onChange={(e) => setNewEduItem(prev => ({ ...prev, title: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div className="sm:col-span-4 flex gap-2">
                      <Input
                        placeholder="비고"
                        value={newEduItem.remarks}
                        onChange={(e) => setNewEduItem(prev => ({ ...prev, remarks: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddEdu}
                        className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm gap-1 shrink-0 rounded-xl shadow-xs transition-all active:scale-95"
                      >
                        <Plus className="h-4 w-4" />
                        <span>추가</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. 취업진로코스 이수 목록 (최대 10점) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-indigo-600" />
                      2. 취업진로코스 이수 목록 (최대 10점)
                    </h4>
                    <span className="text-[11px] font-bold text-indigo-600">
                      {Object.keys(careerCourses).length}학기 이수 ({previewEvaluation.details.careerCourse.details?.courseScore || 0}점)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    4학기(10점), 3학기(8점), 2학기(6점), 1학기(4점)
                  </p>

                  {/* 목록 테이블 */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2 w-24">참여학기</th>
                          <th className="p-2">진로코스 명칭</th>
                          <th className="p-2 w-12 text-center">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {Object.keys(careerCourses).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-slate-400 text-xs">
                              등록된 취업진로코스 실적이 없습니다. 아래에서 학기별 코스를 추가하세요.
                            </td>
                          </tr>
                        ) : (
                          Object.entries(careerCourses).map(([term, courseName]) => (
                            <tr key={term} className="hover:bg-slate-50">
                              <td className="p-2 font-mono text-[11px] font-bold text-indigo-700">{term}</td>
                              <td className="p-2 font-semibold text-slate-900">{courseName}</td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setCareerCourses(prev => {
                                    const next = { ...prev };
                                    delete next[term];
                                    return next;
                                  })}
                                  className="text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 행 추가 인풋 */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/90 p-3 rounded-xl border border-slate-200 items-center">
                    <div className="sm:col-span-3">
                      <Select 
                        value={newCourse.term} 
                        onValueChange={(v) => setNewCourse(prev => ({ ...prev, term: v }))}
                      >
                        <SelectTrigger className="h-10 text-xs sm:text-sm bg-white font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALL_TERMS.map(t => (
                            <SelectItem key={t} value={t} className="text-xs">{t} 학기</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-5">
                      <Input
                        placeholder="코스명 (예: 청솔반, 디딤돌반, 부사관반)"
                        value={newCourse.name}
                        onChange={(e) => setNewCourse(prev => ({ ...prev, name: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div className="sm:col-span-4 flex gap-2">
                      <Input
                        placeholder="비고"
                        value={newCourse.remarks}
                        onChange={(e) => setNewCourse(prev => ({ ...prev, remarks: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddCourse}
                        className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm gap-1 shrink-0 rounded-xl shadow-xs transition-all active:scale-95"
                      >
                        <Plus className="h-4 w-4" />
                        <span>추가</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 3. 전공심화동아리 참여 목록 (최대 5점) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-indigo-600" />
                      3. 전공심화동아리 참여 목록 (최대 5점)
                    </h4>
                    <span className="text-[11px] font-bold text-indigo-600">
                      {Object.keys(majorClubs).length}개학년 이수 ({previewEvaluation.details.careerCourse.details?.clubScore || 0}점)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    3개년(5점), 2개년(4점), 1개년(3점)
                  </p>

                  {/* 목록 테이블 */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2 w-24">참여학년</th>
                          <th className="p-2">동아리 명칭</th>
                          <th className="p-2 w-12 text-center">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {Object.keys(majorClubs).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-slate-400 text-xs">
                              등록된 전공심화동아리 실적이 없습니다. 아래에서 학년별 동아리를 추가하세요.
                            </td>
                          </tr>
                        ) : (
                          Object.entries(majorClubs).map(([yr, clubName]) => (
                            <tr key={yr} className="hover:bg-slate-50">
                              <td className="p-2 font-mono text-[11px] font-bold text-indigo-700">{yr}학년</td>
                              <td className="p-2 font-semibold text-slate-900">{clubName}</td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setMajorClubs(prev => {
                                    const next = { ...prev };
                                    delete next[yr];
                                    return next;
                                  })}
                                  className="text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 행 추가 인풋 */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/90 p-3 rounded-xl border border-slate-200 items-center">
                    <div className="sm:col-span-3">
                      <Select 
                        value={newClub.year} 
                        onValueChange={(v) => setNewClub(prev => ({ ...prev, year: v }))}
                      >
                        <SelectTrigger className="h-10 text-xs sm:text-sm bg-white font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALL_YEARS.map(y => (
                            <SelectItem key={y} value={y} className="text-xs">{y} 학년</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-5">
                      <Input
                        placeholder="동아리명 (예: 전공심화 로봇제어반, 3D프린터반)"
                        value={newClub.name}
                        onChange={(e) => setNewClub(prev => ({ ...prev, name: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div className="sm:col-span-4 flex gap-2">
                      <Input
                        placeholder="비고"
                        value={newClub.remarks}
                        onChange={(e) => setNewClub(prev => ({ ...prev, remarks: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddClub}
                        className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm gap-1 shrink-0 rounded-xl shadow-xs transition-all active:scale-95"
                      >
                        <Plus className="h-4 w-4" />
                        <span>추가</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 4. 기능경기대회 출전 및 입상 실적 (최대 5점) - 별도 분리 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-indigo-600" />
                      4. 기능경기대회 출전 및 입상 실적 (최대 5점)
                    </h4>
                    <span className="text-[11px] font-bold text-indigo-600">
                      {skillsContest.level === 'national' ? '전국대회 (5점)' : skillsContest.level === 'regional' ? '지방대회 (2점)' : '미참여 (0점)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    전국기능경기대회(5점), 지방기능경기대회(2점)
                  </p>

                  {/* 목록 테이블 */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2 w-24">일자</th>
                          <th className="p-2 w-32">구분 (대회수준)</th>
                          <th className="p-2">대회 명칭</th>
                          <th className="p-2 w-28">수상 내역</th>
                          <th className="p-2 w-12 text-center">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {skillsContest.level === 'none' || !skillsContest.name ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400 text-xs">
                              등록된 기능경기대회 실적이 없습니다. 아래에서 추가하세요.
                            </td>
                          </tr>
                        ) : (
                          <tr className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-[11px] text-slate-600">{skillsContest.date || '-'}</td>
                            <td className="p-2 font-bold text-indigo-700">
                              {skillsContest.level === 'national' ? '전국대회 (5점)' : '지방대회 (2점)'}
                            </td>
                            <td className="p-2 font-semibold text-slate-900">{skillsContest.name}</td>
                            <td className="p-2 text-slate-700 font-medium">{skillsContest.award || '-'}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => setSkillsContest({ level: 'none', name: '', award: '', date: '' })}
                                className="text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 행 추가 인풋 */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/90 p-3 rounded-xl border border-slate-200 items-center">
                    <div className="sm:col-span-2">
                      <Input
                        placeholder="일자 (2026-04-10)"
                        value={newSkills.date}
                        onChange={(e) => setNewSkills(prev => ({ ...prev, date: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Select 
                        value={newSkills.level} 
                        onValueChange={(v: any) => setNewSkills(prev => ({ ...prev, level: v }))}
                      >
                        <SelectTrigger className="h-10 text-xs sm:text-sm bg-white font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regional" className="text-xs font-bold text-indigo-700">지방기능경기대회 (2점)</SelectItem>
                          <SelectItem value="national" className="text-xs font-bold text-purple-700">전국기능경기대회 (5점)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-4">
                      <Input
                        placeholder="대회명 (예: 대구광역시 기능경기대회)"
                        value={newSkills.name}
                        onChange={(e) => setNewSkills(prev => ({ ...prev, name: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3 flex gap-2">
                      <Input
                        placeholder="수상내역 (금상, 은상)"
                        value={newSkills.award}
                        onChange={(e) => setNewSkills(prev => ({ ...prev, award: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddSkills}
                        className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm gap-1 shrink-0 rounded-xl shadow-xs transition-all active:scale-95"
                      >
                        <Plus className="h-4 w-4" />
                        <span>추가</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 5. 현장실습 및 도제·조기취업 참여 실적 (최대 5점) - 별도 분리 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-indigo-600" />
                      5. 현장실습 및 도제·조기취업 참여 실적 (최대 5점)
                    </h4>
                    <span className="text-[11px] font-bold text-indigo-600">
                      {previewEvaluation.details.fieldTraining.score}점 반영
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    현장실습 완료(5점), 조기취업 확정(5점), 도제학교 OJT (4학기 5점, 3학기 4점, 2학기 3점, 1학기 2점)
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* 현장실습 완료 */}
                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox"
                          id="ft_completed"
                          checked={fieldTraining.completed}
                          onChange={(e) => setFieldTraining(prev => ({ ...prev, completed: e.target.checked }))}
                          className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <Label htmlFor="ft_completed" className="text-xs font-bold text-slate-900 cursor-pointer">
                          현장실습 완료 (5점)
                        </Label>
                      </div>
                      {fieldTraining.completed && (
                        <div className="space-y-1.5 pt-1">
                          <Input 
                            placeholder="실습기업명 (예: (주)한국OSG)"
                            value={fieldTraining.company}
                            onChange={(e) => setFieldTraining(prev => ({ ...prev, company: e.target.value }))}
                            className="h-9 text-xs bg-white"
                          />
                          <Input 
                            placeholder="실습기간 (예: 2026.09 ~ 2026.12)"
                            value={fieldTraining.period}
                            onChange={(e) => setFieldTraining(prev => ({ ...prev, period: e.target.value }))}
                            className="h-9 text-xs bg-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* 조기취업 확정 */}
                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox"
                          id="emp_early"
                          checked={employedEarly.confirmed}
                          onChange={(e) => setEmployedEarly(prev => ({ ...prev, confirmed: e.target.checked }))}
                          className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <Label htmlFor="emp_early" className="text-xs font-bold text-slate-900 cursor-pointer">
                          조기취업 확정 (5점)
                        </Label>
                      </div>
                      {employedEarly.confirmed && (
                        <div className="space-y-1.5 pt-1">
                          <Input 
                            placeholder="취업기업명 (예: 삼보모터스(주))"
                            value={employedEarly.company}
                            onChange={(e) => setEmployedEarly(prev => ({ ...prev, company: e.target.value }))}
                            className="h-9 text-xs bg-white"
                          />
                          <Input 
                            placeholder="취업일자 (예: 2026-10-01)"
                            value={employedEarly.date}
                            onChange={(e) => setEmployedEarly(prev => ({ ...prev, date: e.target.value }))}
                            className="h-9 text-xs bg-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* 도제학교 OJT 참여 학기 슬롯 */}
                    <div className="md:col-span-2 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">도제학교 OJT 참여 학기</span>
                        <span className="text-[11px] font-bold text-indigo-600">
                          {Object.keys(apprenticeship).length}학기 참여
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 pt-1">
                        {['2-1', '2-2', '3-1', '3-2'].map(term => {
                          const active = Boolean(apprenticeship[term]);
                          return (
                            <button
                              key={term}
                              type="button"
                              onClick={() => toggleTermSlot(apprenticeship, setApprenticeship, term, apprenticeCompany || '도제참여')}
                              className={cn(
                                "py-2 text-xs font-extrabold rounded-xl border text-center transition-all",
                                active 
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs" 
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                              )}
                            >
                              {term} 학기
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

              </TabsContent>

              {/* ========================================================================= */}
              {/* 탭 3: 인성능력 (예체능 & 교내외대회)  *봉사 제외* */}
              {/* ========================================================================= */}
              <TabsContent value="character" className="space-y-4 m-0">

                {/* 1. 운동부 및 관악부 참여 이수 목록 (최대 5점) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-indigo-600" />
                      1. 운동부 및 관악부 참여 이수 목록 (최대 5점)
                    </h4>
                    <span className="text-[11px] font-bold text-indigo-600">
                      {Object.keys(artsSports).length}학기 참여 ({previewEvaluation.details.artsSports.score}점)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    6학기(5점), 5학기(4점), 4학기(3점), 3학기(2점), 2학기(1점)
                  </p>

                  {/* 목록 테이블 */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2 w-24">참여학기</th>
                          <th className="p-2">활동부서 명칭</th>
                          <th className="p-2 w-12 text-center">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {Object.keys(artsSports).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-slate-400 text-xs">
                              등록된 운동부 및 관악부 참여 실적이 없습니다. 아래에서 학기별 활동을 추가하세요.
                            </td>
                          </tr>
                        ) : (
                          Object.entries(artsSports).map(([term, deptName]) => (
                            <tr key={term} className="hover:bg-slate-50">
                              <td className="p-2 font-mono text-[11px] font-bold text-indigo-700">{term}</td>
                              <td className="p-2 font-semibold text-slate-900">{deptName}</td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setArtsSports(prev => {
                                    const next = { ...prev };
                                    delete next[term];
                                    return next;
                                  })}
                                  className="text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 행 추가 인풋 */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/90 p-3 rounded-xl border border-slate-200 items-center">
                    <div className="sm:col-span-3">
                      <Select 
                        value={newSports.term} 
                        onValueChange={(v) => setNewSports(prev => ({ ...prev, term: v }))}
                      >
                        <SelectTrigger className="h-10 text-xs sm:text-sm bg-white font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALL_TERMS.map(t => (
                            <SelectItem key={t} value={t} className="text-xs">{t} 학기</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-5">
                      <Input
                        placeholder="활동부서명 (예: 관악부, 축구부, 검도부 등)"
                        value={newSports.name}
                        onChange={(e) => setNewSports(prev => ({ ...prev, name: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div className="sm:col-span-4 flex gap-2">
                      <Input
                        placeholder="비고"
                        value={newSports.remarks}
                        onChange={(e) => setNewSports(prev => ({ ...prev, remarks: e.target.value }))}
                        className="h-10 text-xs sm:text-sm bg-white flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddSports}
                        className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm gap-1 shrink-0 rounded-xl shadow-xs transition-all active:scale-95"
                      >
                        <Plus className="h-4 w-4" />
                        <span>추가</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. 교내외 각종 대회 참가 및 입상 (최대 5점, 입상 1점, 참가 0.5점) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-indigo-600" />
                      2. 교내외 각종 대회 실적 목록 (최대 5점, 동일 대회 입상 우선 인정)
                    </h4>
                    <span className="text-[11px] font-bold text-indigo-600">
                      유효 입상 {contestEval.effectiveAwardCount}건, 참가 {contestEval.effectivePartCount}건 ({contestEval.score}점)
                    </span>
                  </div>

                  {/* 대회 실적 목록 테이블 */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2 w-24">일자</th>
                          <th className="p-2 w-20 text-center">구분</th>
                          <th className="p-2 w-20 text-center">실적</th>
                          <th className="p-2">대회명</th>
                          <th className="p-2 w-28">수상내역</th>
                          <th className="p-2 w-28 text-center">반영 상태</th>
                          <th className="p-2 w-12 text-center">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {contestEval.itemsWithStatus.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-slate-400 text-xs">
                              등록된 대회 실적이 없습니다. 아래에서 추가하세요.
                            </td>
                          </tr>
                        ) : (
                          contestEval.itemsWithStatus.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono text-[11px] text-slate-600">{c.dateOrTerm || '-'}</td>
                              <td className="p-2 text-center">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-700">
                                  {c.category || '교내대회'}
                                </Badge>
                              </td>
                              <td className="p-2 text-center">
                                <Badge className={cn("text-[10px] px-1.5 py-0", c.type === 'award' ? "bg-amber-500 text-white" : "bg-blue-600 text-white")}>
                                  {c.type === 'award' ? '입상' : '참가'}
                                </Badge>
                              </td>
                              <td className="p-2 font-semibold text-slate-900">{c.title}</td>
                              <td className="p-2 text-[11px] text-slate-600">{c.award || '-'}</td>
                              <td className="p-2 text-center">
                                {c.isSuperseded ? (
                                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                    중복 0점
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                    +{c.earnedScore}점 인정
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setContestList(prev => prev.filter(item => item.id !== c.id))}
                                  className="text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 대회 실적 추가 인라인 폼 */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/90 p-3 rounded-xl border border-slate-200 items-center">
                    <div className="sm:col-span-2">
                      <Input
                        placeholder="일자 (2026-07-14)"
                        value={newContest.dateOrTerm}
                        onChange={(e) => setNewContest(prev => ({ ...prev, dateOrTerm: e.target.value }))}
                        className="h-10 text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Select 
                        value={newContest.category} 
                        onValueChange={(v: any) => setNewContest(prev => ({ ...prev, category: v }))}
                      >
                        <SelectTrigger className="h-10 text-xs bg-white font-semibold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="교내대회" className="text-xs">교내대회</SelectItem>
                          <SelectItem value="교외대회" className="text-xs">교외대회</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Select 
                        value={newContest.type} 
                        onValueChange={(v: any) => setNewContest(prev => ({ ...prev, type: v }))}
                      >
                        <SelectTrigger className="h-10 text-xs bg-white font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="award" className="text-xs font-bold text-amber-600">입상 (1.0점)</SelectItem>
                          <SelectItem value="participate" className="text-xs font-bold text-blue-600">참가 (0.5점)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        placeholder="대회명 입력"
                        value={newContest.title}
                        onChange={(e) => setNewContest(prev => ({ ...prev, title: e.target.value }))}
                        className="h-10 text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3 flex gap-2">
                      <Input
                        placeholder="수상내역 (예: 금상)"
                        value={newContest.award}
                        onChange={(e) => setNewContest(prev => ({ ...prev, award: e.target.value }))}
                        className="h-10 text-xs bg-white flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddContest}
                        className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm gap-1 shrink-0 rounded-xl shadow-xs transition-all active:scale-95"
                      >
                        <Plus className="h-4 w-4" />
                        <span>추가</span>
                      </Button>
                    </div>
                  </div>
                </div>

              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="p-4 bg-white border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9 font-bold text-slate-700 hover:bg-slate-50 border-slate-200 rounded-lg px-4"
            >
              취소
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-4 shadow-2xs gap-1.5"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isSaving ? '저장 중...' : '저장하기'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* 등록된 마스터 자격증 검색/선택 피커 모달 */}
      <CertificatePicker
        isOpen={isCertPickerOpen}
        onClose={() => setIsCertPickerOpen(false)}
        initialValues={certificates}
        masterCerts={masterCertificates}
        onSave={(newCerts: string[]) => {
          setCertificates(newCerts);
          setIsCertPickerOpen(false);
        }}
      />
    </Dialog>
  );
}
