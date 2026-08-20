'use client';

import { createClient } from '@/lib/supabase/client';
import { logout } from '@/app/login/actions';

/**
 * 로컬 및 배포(Production) 환경 모두에서 확실하게 동작하는 통합 로그아웃 함수
 * 1. 브라우저 Supabase 클라이언트 쿠키/세션 제거
 * 2. 서버 Supabase 세션 무효화 및 쿠키 정리
 * 3. window.location.href를 통한 클라이언트 캐시 전면 초기화 및 /login 이동
 */
export async function handleClientLogout() {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (e) {
    console.error('Client signout error:', e);
  }

  try {
    await logout();
  } catch (e) {
    console.error('Server logout error:', e);
  }

  window.location.href = '/login';
}
