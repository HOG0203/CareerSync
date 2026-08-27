import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="학생 계정 관리 데이터를 불러오는 중입니다..." />;
}