import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="교직원 및 사용자 계정 목록을 불러오는 중입니다..." />;
}