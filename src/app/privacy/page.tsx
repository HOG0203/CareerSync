import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, FileText, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: '개인정보처리방침 | CareerSync',
  description: '대구공업고등학교 CareerSync 학생 취업·진로 및 옥저인재인증제 관리 시스템 개인정보처리방침',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* 상단 헤더 */}
        <div className="p-6 sm:p-8 bg-indigo-600 text-white">
          <Link 
            href="/"
            className="inline-flex items-center text-xs font-semibold text-indigo-100 hover:text-white mb-4 transition-colors gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            홈으로 돌아가기
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">개인정보처리방침</h1>
              <p className="text-xs sm:text-sm text-indigo-100 mt-1">CareerSync - 대구공업고등학교</p>
            </div>
          </div>
        </div>

        {/* 본문 내용 */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
              1. 개인정보의 수집 및 이용 목적
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 pl-4">
              대구공업고등학교(이하 '학교')는 학생 맞춤형 취업·진로 지도 및 '옥저인재인증제' 평가·관리 목적으로 다음의 최소한의 개인정보를 수집 및 처리합니다.
            </p>
            <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 pl-4 space-y-1">
              <li>재학생 학적 정보 관리 (학번, 성명, 학과, 학급, 학년)</li>
              <li>취업 이력 및 진로 지도, 교내외 수상 및 자격증 취득 관리</li>
              <li>옥저인재인증제 4대 영역(직업공통, 전공능력, 취업역량, 인성능력) 평가 산출</li>
              <li>비밀번호 초기화 및 로그인 본인 식별 (연락처)</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
              2. 수집하는 개인정보 항목
            </h2>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm space-y-1">
              <p><strong>[필수 항목]</strong> 학생 성명, 학번, 학년, 학과, 학급, 연락처(전화번호), 자격증 내역, 출결 일수, 성적 점수</p>
              <p><strong>[시스템 생성 항목]</strong> 로그인 일시, 서비스 이용 기록, 기기 브라우저 정보 (푸시 알림 수신 동의 시 토큰)</p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
              3. 개인정보의 보유 및 이용 기간
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 pl-4">
              수집된 개인정보는 학생의 재학 기간 및 졸업 후 사후 진로 통계 목적(최대 5년) 범위 내에서 안전하게 보관되며, 목적 달성 시 복구 불가능한 방법으로 파기합니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
              4. 제3자 제공 및 위탁에 관한 사항
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 pl-4">
              학교는 정보주체의 동의 없이 개인정보를 외부에 제공하지 않으며, 시스템의 안정적인 운영을 위한 인프라 서비스(데이터베이스 호스팅) 외에는 일체의 상업적 제3자 제공을 하지 않습니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
              5. 개인정보의 안전성 확보 조치
            </h2>
            <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 pl-4 space-y-1">
              <li>비밀번호 등 중요 정보의 일방향 암호화 처리</li>
              <li>HTTPS/TLS 보안 통신 프로토콜 적용</li>
              <li>교직원 권한별 접근 통제 (관리자, 교사, 학생)</li>
            </ul>
          </section>

          <section className="space-y-2 border-t pt-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
              6. 개인정보 보호책임자 및 문의
            </h2>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm space-y-1">
              <p><strong>기관명:</strong> 대구공업고등학교</p>
              <p><strong>시스템명:</strong> CareerSync (취업·진로 대시보드)</p>
              <p><strong>문의:</strong> 교무실 / 취업지원부</p>
              <p className="text-[11px] text-slate-400 mt-2">공고일자: 2026년 3월 1일 | 시행일자: 2026년 3월 1일</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}