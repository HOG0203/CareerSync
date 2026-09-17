import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="중학교별 취업현황 데이터를 불러오는 중입니다..." />;
}
