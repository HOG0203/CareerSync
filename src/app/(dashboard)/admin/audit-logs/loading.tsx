import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="시스템 작업 감사 로그를 불러오는 중입니다..." />;
}