'use client';

import * as React from 'react';
import { FullStudentEvaluation } from '@/lib/certification-calculator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Award, 
  Printer, 
  KeyRound, 
  Calendar, 
  BookOpen, 
  FileText, 
  Sparkles, 
  Heart, 
  Trophy, 
  Briefcase, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { EvaluationSheetModal } from '@/app/(dashboard)/admin/certification/evaluation-sheet-modal';
import { ChangePasswordDialog } from './change-password-dialog';

interface StudentCertificationViewProps {
  evaluation: FullStudentEvaluation;
  baseYear: number;
}

export function StudentCertificationView({ evaluation, baseYear }: StudentCertificationViewProps) {
  const [sheetModalOpen, setSheetModalOpen] = React.useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);

  const d = evaluation.details;
  const isPassed = evaluation.isCertified;

  const domains = [
    {
      title: '직업공통능력 (25점)',
      score: evaluation.vocationalCommonScore,
      max: 25,
      icon: BookOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      desc: `직기초 평가 및 공통자격증`,
    },
    {
      title: '전공능력 (25점)',
      score: evaluation.majorScore,
      max: 25,
      icon: ShieldCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      desc: `전공필수/심화 자격증 (${evaluation.certificatesList?.length || 0}개 취득)`,
    },
    {
      title: '취업역량강화 (25점)',
      score: evaluation.employmentScore,
      max: 25,
      icon: Briefcase,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      desc: `산학협력 교육, 맞춤반, 전공동아리, 현장실습`,
    },
    {
      title: '인성능력 (25점)',
      score: evaluation.characterScore,
      max: 25,
      icon: Heart,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      desc: `출결상황(${d.attendance?.score || 0}점), 봉사, 예체능, 교내외대회`,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 상단 환영 & 액션 바 */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
              {evaluation.currentGrade}학년 {evaluation.major}
            </span>
            <span className="text-xs text-blue-200">
              {evaluation.classInfo}반 {evaluation.studentNumber}번
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <span>{evaluation.studentName}</span>
            <span className="text-lg sm:text-xl font-normal text-blue-200">학생의 옥저인증 종합평가</span>
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-xl">
            본인의 영역별 취득 점수 및 세부 인정 내역을 확인하고, 원클릭으로 평가표를 인쇄할 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            onClick={() => setPasswordDialogOpen(true)}
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs font-medium h-9"
          >
            <KeyRound className="h-3.5 w-3.5 mr-1.5" />
            비밀번호 변경
          </Button>
        </div>
      </div>

      {/* 종합 점수 & 인증 배지 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="md:col-span-1 border-slate-200/80 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500">종합 평가 결과</CardDescription>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              옥저인재인증 등급
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="text-xs text-slate-500 font-medium">총점 (100점 만점)</span>
                <div className="text-3xl font-black tracking-tight text-slate-900 mt-0.5">
                  {evaluation.totalScore}
                  <span className="text-base font-normal text-slate-400 ml-1">점</span>
                </div>
              </div>
              <div className="text-right">
                <Badge className={isPassed ? "bg-emerald-600 text-white px-3 py-1 text-sm font-bold shadow-sm" : "bg-amber-100 text-amber-800 border-amber-300 px-3 py-1 text-sm font-bold"}>
                  {evaluation.rank}등급 {isPassed ? '(인증)' : ''}
                </Badge>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between font-medium">
                <span>인증 기준 (70점 이상)</span>
                <span>{evaluation.totalScore}%</span>
              </div>
              <Progress value={Math.min(100, evaluation.totalScore)} className="h-2.5" />
            </div>
          </CardContent>
        </Card>

        {/* 4대 영역 요약 그리드 */}
        <Card className="md:col-span-2 border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  4대 인증 영역별 취득 점수
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  각 영역별 점수와 세부 인정 항목입니다.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {domains.map((dom, idx) => {
                const Icon = dom.icon;
                const percent = Math.min(100, Math.round((dom.score / dom.max) * 100));
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${dom.bg}`}>
                          <Icon className={`h-4 w-4 ${dom.color}`} />
                        </div>
                        <span className="text-xs font-bold text-slate-800">{dom.title}</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        <span className={dom.score >= dom.max * 0.7 ? 'text-blue-600' : 'text-slate-700'}>
                          {dom.score}
                        </span>
                        <span className="text-slate-400 font-normal"> / {dom.max}점</span>
                      </div>
                    </div>
                    <Progress value={percent} className="h-1.5" />
                    <p className="text-[11px] text-slate-500 truncate">
                      {dom.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* 세부 안내 및 인쇄 배너 */}
      <Card className="border-blue-100 bg-blue-50/50 shadow-sm">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">종합인증평가표 정식 출력본 확인</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                학교 공식 A4 양식의 <strong>종합인증평가표</strong>를 확인하고 PDF로 다운로드하거나 인쇄할 수 있습니다.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setSheetModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 h-9 shrink-0 shadow-sm"
          >
            평가표 열람하기
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* 평가표 전체보기 모달 */}
      <EvaluationSheetModal
        evaluation={evaluation}
        open={sheetModalOpen}
        onOpenChange={setSheetModalOpen}
        canEdit={false}
        isAdmin={false}
      />

      {/* 비밀번호 변경 다이얼로그 */}
      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />
    </div>
  );
}
