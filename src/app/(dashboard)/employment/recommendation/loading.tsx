import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="추천 대상자 선정 시스템 데이터를 불러오는 중입니다..." />;
}
