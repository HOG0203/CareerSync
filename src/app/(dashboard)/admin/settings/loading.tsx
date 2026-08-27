import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="시스템 기준 설정을 불러오는 중입니다..." />;
}