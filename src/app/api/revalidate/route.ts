import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * [글로벌 캐시 완전 초기화 API]
 * Vercel 배포 사이트에서 DB 변경 사항을 0초 만에 강제 반영할 때 호출
 * GET /api/revalidate
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Next.js Data Cache 전역 태그 무효화
    const tags = [
      'students',
      'teachers',
      'profiles',
      'settings',
      'student-accounts',
      'snapshots',
      'audit-logs',
      'student_scores',
      'companies',
      'achievement-scores'
    ];

    for (const tag of tags) {
      try {
        revalidateTag(tag);
      } catch (e) {}
    }

    // 2. 주요 페이지 경로 캐시 및 브라우저 RSC 라우터 캐시 전면 초기화
    const paths = [
      '/',
      '/dashboard',
      '/students',
      '/admin/students',
      '/class-management',
      '/employment-status',
      '/field-training',
      '/labor-education',
      '/company-info',
      '/student-accounts'
    ];

    for (const path of paths) {
      try {
        revalidatePath(path);
      } catch (e) {}
    }

    // 레이아웃 전체 레벨 무효화
    revalidatePath('/', 'layout');

    return NextResponse.json({
      success: true,
      message: 'Vercel 서버 및 클라이언트 전체 캐시가 성공적으로 초기화되었습니다.',
      flushedTags: tags,
      flushedPaths: paths,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || '캐시 초기화 실패' },
      { status: 500 }
    );
  }
}
