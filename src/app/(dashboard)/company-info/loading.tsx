import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="채용 및 협약 업체정보를 불러오는 중입니다..." />;
}