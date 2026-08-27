import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="취업 상세데이터를 정밀 조회 중입니다..." />;
}