import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="교과 성적 현황 데이터를 불러오는 중입니다..." />;
}