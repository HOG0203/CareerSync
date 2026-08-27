import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, UserX, Clock, Mail, Phone } from 'lucide-react';

export const metadata = {
  title: '계정 및 데이터 삭제 요청 | CareerSync',
  description: '대구공업고등학교 CareerSync 학생 계정 및 개인정보 데이터 삭제 요청 절차 안내',
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* 상단 헤더 */}
        <div className="p-6 sm:p-8 bg-rose-600 text-white">
          <Link 
            href="/"
            className="inline-flex items-center text-xs font-semibold text-rose-100 hover:text-white mb-4 transition-colors gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            홈으로 돌아가기
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
              <UserX className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">계정 및 관련 데이터 삭제 요청</h1>
              <p className="text-xs sm:text-sm text-rose-100 mt-1">
                앱 이름: CareerSync - 대구공업고 취업·진로 (개발/운영: 대구공업고등학교)
              </p>
            </div>
          </div>
        </div>

        {/* 본문 내용 */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
          {/* 1. 개요 */}
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-600"></span>
              1. 개요 및 권리 안내
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 pl-4">
              <strong>CareerSync (대구공업고등학교)</strong>는 이용자의 개인정보 자기결정권을 존중하며, 구글 플레이 데이터 보안 정책에 따라 언제든지 등록된 계정 및 관련 활동 데이터의 삭제를 요청할 수 있는 절차를 보장합니다.
            </p>
          </section>

          {/* 2. 삭제 요청 절차 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-600"></span>
              2. 계정 및 데이터 삭제 요청 방법 (단계별 안내)
            </h2>
            <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">본인 확인 정보 준비</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    학생 성명, 학번, 등록된 연락처(전화번호)를 확인합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">삭제 요청 접수 (담당 부서 연락)</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    교내 담당 부서(취업지원부/교무실)로 직접 방문 또는 이메일/유선 전화로 삭제를 요청합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">데이터 영구 삭제 및 확인 통보</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    요청 접수 후 영업일 기준 <strong>최대 3일 이내</strong>에 데이터베이스에서 로그인 계정 및 관련 개인정보가 영구 파기됩니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. 삭제되는 데이터 및 보관 정책 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-600"></span>
              3. 삭제되는 데이터 유형 및 보관 기간
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200">
                <p className="font-bold text-rose-900 text-xs sm:text-sm flex items-center gap-1.5 mb-2">
                  <UserX className="h-4 w-4 text-rose-600" />
                  즉시 영구 삭제되는 데이터
                </p>
                <ul className="text-xs text-rose-800 space-y-1 list-disc list-inside">
                  <li>로그인 계정 정보 (아이디, 비밀번호)</li>
                  <li>개인 연락처 및 모바일 접속 식별자</li>
                  <li>앱 서비스 이용 및 활동 로그</li>
                  <li>개인 설정 및 알림 수신 토큰</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 mb-2">
                  <Clock className="h-4 w-4 text-slate-600" />
                  법령에 따라 별도 보관되는 데이터
                </p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  <li>초·중등교육법에 따른 법정 학적부 기록</li>
                  <li>공식 발급된 자격/인증 사실 기록</li>
                  <li>(보관 기간: 관련 교육 법령 기준에 따름)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 4. 접수처 및 문의 */}
          <section className="space-y-2 border-t pt-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-600"></span>
              4. 삭제 요청 전담 창구
            </h2>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm space-y-2">
              <p><strong>기관 및 운영자:</strong> 대구공업고등학교 (CareerSync 운영팀)</p>
              <p className="flex items-center gap-2 text-slate-700">
                <Phone className="h-4 w-4 text-slate-500" />
                <span><strong>문의 전화:</strong> 대구공업고등학교 교무실 / 취업지원부</span>
              </p>
              <p className="flex items-center gap-2 text-slate-700">
                <Mail className="h-4 w-4 text-slate-500" />
                <span><strong>요청 이메일:</strong> dgths.career@gmail.com</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                * 이메일 접수 시 제목에 [CareerSync 계정 삭제 요청]과 학생 성명/학번을 기재해 주시기 바랍니다.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}