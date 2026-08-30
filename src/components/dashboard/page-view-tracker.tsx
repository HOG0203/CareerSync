'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { recordPageViewAction } from '@/lib/audit-logger';

// 경로별 한글 명칭 매핑
const PAGE_NAME_MAP: Record<string, string> = {
  '/dashboard': '대시보드',
  '/employment-status': '취업진로현황',
  '/field-training': '현장실습/도제OJT현황',
  '/company-info': '업체정보',
  '/students': '취업상세데이터',
  '/class-management': '학반 관리',
  '/merit-demerit': '상벌점 관리',
  '/labor-education': '노동인권교육',
  '/student-accounts': '학생 계정 관리',
  '/admin/student-accounts': '학생 계정 관리',
  '/admin/students': '학생 등록/진급',
  '/admin/users': '사용자 관리',
  '/admin/login-history': '로그인 및 활동 이력',
  '/admin/audit-logs': '작업 이력 관리',
  '/admin/settings': '시스템 설정',
  '/admin/certification': '인증제 종합 평가',
  '/admin/certification/import': '인증제 엑셀 일괄 등록',
  '/admin/certification/grades': '인증제 성적현황',
  '/admin/certification/attendance': '인증제 출결현황',
  '/admin/certification/certificates': '인증제 자격증현황',
  '/student/certification': '학생 옥저인재인증 평가표',
  '/student/merit-demerit': '학생 상벌점 내역 조회',
};

// 조회 기록에서 제외할 경로 (로그인 페이지, 로그인 및 활동 이력 페이지 등)
const EXCLUDED_PATHS = ['/login', '/', '/admin/login-history'];

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastRecordedPathRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // 1. 제외 경로 체크 (로그인 이력 페이지 자체 및 로그인 화면 등)
    if (!pathname || EXCLUDED_PATHS.includes(pathname)) return;

    const query = searchParams?.toString();
    const currentFullPath = query ? `${pathname}?${query}` : pathname;
    
    // 2. 동일 경로 연속 중복 호출 방지
    if (lastRecordedPathRef.current === pathname) {
      return;
    }

    lastRecordedPathRef.current = pathname;

    const pageName = PAGE_NAME_MAP[pathname] || pathname.replace('/', '');

    // 3. 브라우저가 유휴 상태일 때(Idle) 비동기 백그라운드 페이지 조회 기록 (화면 로딩 방해 완전 차단)
    const recordTask = () => {
      recordPageViewAction(currentFullPath, pageName).catch((err) => {
        console.error('Failed to auto-record page view:', err);
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(recordTask, { timeout: 2000 });
    } else {
      setTimeout(recordTask, 300);
    }
  }, [pathname, searchParams]);

  return null;
}
