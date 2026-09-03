// ==============================================================================
// src/app/(dashboard)/employment/kai-grade/page.tsx
// 기존 경로 -> /employment/grade 자동 리다이렉트
// ==============================================================================

import { redirect } from 'next/navigation';

export default function KaiGradeRedirectPage() {
  redirect('/employment/grade');
}
