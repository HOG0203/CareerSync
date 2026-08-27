import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="학생 명단 및 진급 데이터를 불러오는 중입니다..." />;
}