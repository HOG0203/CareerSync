import ExcelJS from 'exceljs';
import { FullStudentEvaluation, StudentRewardRecord, RANK_WEIGHT } from './certification-calculator';

export interface RewardLedgerExportOptions {
  academicYear: number;
  semester?: number;
  grade: number;
  selectedClass?: string; // 'all' or '1반', '2-1'
  evaluations: FullStudentEvaluation[];
  rewardsStore?: Record<string, StudentRewardRecord[]>;
}

export interface RecipientInfo {
  isRecipient: boolean;
  hasPrize: boolean;
  hasAward: boolean;
  displayScore: number;
  displayRank: string;
  prizeName: string;
  awardName: string;
  remarks: string;
}

/**
 * 학생별 실제 수령 대상 여부 및 세부 포상 정보 판정 함수
 * - 이번 회차 신규 달성자 또는 과거 대비 상위 승급자만 실제 수령 대상자로 판정
 * - 이전 확정 기록과 동일한 등급이거나 D등급, 기수여 완료된 경우는 수령 대상에서 제외
 */
export function getStudentRecipientInfo(
  student: FullStudentEvaluation,
  academicYear: number,
  semester?: number
): RecipientInfo {
  const history = student.rewardsHistory || [];

  // 1. 이번 회차에 이미 확정된 포상 이력 조회 (동일 academicYear 및 semester)
  const currentPrize = history.find(r => 
    r.rewardType === 'prize' && 
    r.status !== 'cancelled' && 
    r.academicYear === academicYear &&
    (semester === undefined || !r.semester || r.semester === semester)
  );

  const currentAward = history.find(r => 
    r.rewardType === 'certificate_award' && 
    r.status !== 'cancelled' && 
    r.academicYear === academicYear &&
    (semester === undefined || !r.semester || r.semester === semester)
  );

  // 2. 과거(이전 회차) 확정 기록 확인 (이번 회차 이전 건들)
  const earlierPrizes = history.filter(r => 
    r.rewardType === 'prize' && 
    r.status !== 'cancelled' && 
    r.id !== currentPrize?.id &&
    (r.academicYear < academicYear || (r.academicYear === academicYear && semester !== undefined && r.semester !== undefined && r.semester < semester))
  );

  const earlierAwards = history.filter(r => 
    r.rewardType === 'certificate_award' && 
    r.status !== 'cancelled' && 
    r.id !== currentAward?.id &&
    (r.academicYear < academicYear || (r.academicYear === academicYear && semester !== undefined && r.semester !== undefined && r.semester < semester))
  );

  // 과거 수령 최고 등급 가중치
  let maxEarlierWeight = -1;
  for (const p of earlierPrizes) {
    const w = RANK_WEIGHT[p.certifiedRank] ?? 0;
    if (w > maxEarlierWeight) maxEarlierWeight = w;
  }

  // 3. 상품(Prize) 지급 여부 판정
  let hasPrize = false;
  let prizeName = '-';
  let isPrizeUpgrade = false;

  if (currentPrize) {
    // 이번 회차에 확정된 상품이 있는 경우:
    // 과거 확정 기록과 비교하여 동일 등급 중복인지 검증 (안전 장치)
    const currentPrizeWeight = RANK_WEIGHT[currentPrize.certifiedRank] ?? 0;
    if (maxEarlierWeight === -1 || currentPrizeWeight > maxEarlierWeight) {
      hasPrize = true;
      prizeName = currentPrize.itemName;
      isPrizeUpgrade = maxEarlierWeight !== -1;
    }
  } else if (student.rewardEligibility?.prize?.eligible) {
    // 아직 확정 전이지만 이번 회차 지급 자격이 충족된 경우 (승급 또는 최초)
    hasPrize = true;
    prizeName = student.rewardEligibility.prize.recommendedPrizeName;
    isPrizeUpgrade = Boolean(student.rewardEligibility.prize.isUpgrade && maxEarlierWeight !== -1);
  }

  // 4. 옥저인재인증상(Certificate Award) 수여 여부 판정 (재학 중 1회 한정)
  let hasAward = false;
  let awardName = '-';

  if (currentAward) {
    if (earlierAwards.length === 0) {
      hasAward = true;
      awardName = currentAward.itemName || '옥저인재인증상';
    }
  } else if (student.rewardEligibility?.certificateAward?.eligible) {
    if (earlierAwards.length === 0) {
      hasAward = true;
      awardName = student.rewardEligibility.certificateAward.recommendedAwardName || '옥저인재인증상';
    }
  }

  // 5. 종합 판정: 상품 또는 인증상 중 하나라도 실제 지급 대상인가?
  const isRecipient = hasPrize || hasAward;

  // 표시 점수 및 등급: 확정 스냅샷 점수가 유효(> 0)하면 우선, 0점(소급 등록 등)이면 현재 종합점수 사용
  const displayScore = (currentPrize?.certifiedScore && currentPrize.certifiedScore > 0)
    ? currentPrize.certifiedScore
    : student.totalScore;
  const displayRank = (currentPrize?.certifiedRank && currentPrize.certifiedRank !== 'D')
    ? currentPrize.certifiedRank
    : student.rank;

  // 비고란 문구
  let remarks = '';
  if (currentPrize?.remarks) {
    remarks = currentPrize.remarks;
  } else if (isPrizeUpgrade) {
    remarks = '승급 지급';
  } else if (hasAward && !hasPrize) {
    remarks = '인증상 수여';
  }

  return {
    isRecipient,
    hasPrize,
    hasAward,
    displayScore,
    displayRank,
    prizeName,
    awardName,
    remarks,
  };
}

const TARGET_MAJOR_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '건설과',
  '스마트공간건축과',
  '스마트공간과',
  '스마트전기과',
  '바이오화학과',
  '스마트융합섬유과',
  '스마트융함섬유과',
];

/**
 * 행정실 제출 및 공문서 첨부용 옥저인재인증제 상품 및 인증상 수령 대장 엑셀 생성기 (ExcelJS 기반)
 */
export async function generateRewardLedgerExcelBuffer(options: RewardLedgerExportOptions): Promise<Buffer> {
  const { academicYear, semester, grade, selectedClass = 'all', evaluations } = options;

  const wb = new ExcelJS.Workbook();
  wb.creator = '대구공업고등학교 커리어싱크 (CareerSync)';
  wb.created = new Date();

  // 1. 학과 및 학반별 데이터 그룹화 (예: "자동화기계과 1반", "건설과 1반")
  const classMap = new Map<string, FullStudentEvaluation[]>();

  evaluations.forEach(student => {
    const major = (student.major || '기타학과').trim();
    const rawClass = (student.classInfo || '1반').trim();
    // '1반', '1' 정규화
    const cleanClass = rawClass.includes('반') ? rawClass : `${rawClass}반`;
    const classKey = `${major} ${cleanClass}`;

    if (!classMap.has(classKey)) {
      classMap.set(classKey, []);
    }
    classMap.get(classKey)!.push(student);
  });

  // 학과 우선순위 및 학반 번호순 정렬
  const sortedClassKeys = Array.from(classMap.keys()).sort((a, b) => {
    const studentsA = classMap.get(a) || [];
    const studentsB = classMap.get(b) || [];
    const majorA = studentsA[0]?.major || a.split(' ')[0] || '';
    const majorB = studentsB[0]?.major || b.split(' ')[0] || '';

    const idxA = TARGET_MAJOR_ORDER.findIndex(m => majorA.includes(m) || m.includes(majorA));
    const idxB = TARGET_MAJOR_ORDER.findIndex(m => majorB.includes(m) || m.includes(majorB));

    if (idxA !== -1 && idxB !== -1 && idxA !== idxB) {
      return idxA - idxB;
    }
    if (idxA !== -1 && idxB === -1) return -1;
    if (idxA === -1 && idxB !== -1) return 1;

    if (majorA !== majorB) {
      return majorA.localeCompare(majorB, 'ko');
    }

    const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
    return numA - numB;
  });

  // 단일 학반 선택인 경우 해당 학반만 출력
  const targetClassKeys = selectedClass !== 'all'
    ? sortedClassKeys.filter(k => k === selectedClass || k.includes(selectedClass) || selectedClass.includes(k))
    : sortedClassKeys;

  // 전체 다운로드일 경우 첫 번째 탭으로 "전체 총괄 요약" 시트 생성
  if (selectedClass === 'all' && sortedClassKeys.length > 1) {
    buildOverallSummarySheet(wb, {
      academicYear,
      semester,
      grade,
      evaluations,
      sortedClassKeys,
      classMap,
    });
  }

  // 각 학과-학반별 개별 시트 생성
  for (const classKey of targetClassKeys) {
    const classStudents = classMap.get(classKey) || [];
    buildClassLedgerSheet(wb, {
      academicYear,
      semester,
      grade,
      classKey,
      students: classStudents,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * 단일 학반용 수령 대장 시트 작성 (A4 세로 인쇄 최적화)
 * - 실제 지급 대상자(신규 자격 달성 또는 승급자)만 행으로 출력
 * - 이전 확정 기록과 동일한 등급(동일 등급 기수령자) 및 D등급은 대장에서 제외
 */
function buildClassLedgerSheet(
  wb: ExcelJS.Workbook,
  params: {
    academicYear: number;
    semester?: number;
    grade: number;
    classKey: string;
    students: FullStudentEvaluation[];
  }
) {
  const { academicYear, semester, grade, classKey, students } = params;

  // 1. 학년/학반별 학생 정렬 (번호순)
  const sortedStudents = [...students].sort((a, b) => {
    const numA = parseInt(a.studentNumber || '0', 10);
    const numB = parseInt(b.studentNumber || '0', 10);
    return numA - numB;
  });

  // 2. 실제 수령 대상자만 필터링 (동일 등급 기수령자 및 기준 미달자 제외)
  const recipientList = sortedStudents
    .map(student => ({
      student,
      info: getStudentRecipientInfo(student, academicYear, semester),
    }))
    .filter(item => item.info.isRecipient);

  // 시트명: Excel 규칙에 맞게 특수문자 제거 및 31자 제한 (예: "자동화기계과 1반")
  let sheetName = classKey.replace(/[\\/?*:[\]]/g, '').trim();
  if (sheetName.length > 31) {
    sheetName = sheetName.substring(0, 31);
  }

  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: 'portrait',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  // 열 너비 설정 (A ~ J: 10열)
  ws.columns = [
    { key: 'no', width: 6 },            // A: 연번
    { key: 'studentNumber', width: 8 },  // B: 번호
    { key: 'studentName', width: 12 },   // C: 성명
    { key: 'major', width: 15 },         // D: 학과
    { key: 'totalScore', width: 10 },    // E: 종합점수
    { key: 'rank', width: 9 },           // F: 인증등급
    { key: 'prizeName', width: 28 },     // G: 지급 상품명
    { key: 'certAward', width: 15 },     // H: 옥저인재인증상
    { key: 'signature', width: 20 },     // I: 수령 확인 (자필 서명)
    { key: 'remarks', width: 16 },       // J: 비고
  ];

  // 1. 대제목 (A2:J3 병합) - 상단 결재란 없이 넓게 중앙 정렬
  ws.mergeCells('A2:J3');
  const titleCell = ws.getCell('A2');
  titleCell.value = semester
    ? `${academicYear}학년도 제${semester}학기 옥저인재인증제 등급별 상품 및 인증상 수령 대장`
    : `${academicYear}학년도 옥저인재인증제 등급별 상품 및 인증상 수령 대장`;
  titleCell.font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 2. 학반 정보 및 개요 바 (A5:J5)
  ws.mergeCells('A5:J5');
  const metaCell1 = ws.getCell('A5');
  metaCell1.value = `■ 대상 학급: ${grade}학년 ${classKey}   |   재적인원: 총 ${sortedStudents.length}명 (실제 수령 대상: ${recipientList.length}명)   |   학교명: 대구공업고등학교 (산학협력부)`;
  metaCell1.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  metaCell1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  metaCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  applyBorder(metaCell1, 'FFCBD5E1');
  ws.getRow(5).height = 24;

  // 3. 지급 기준 요약 안내 (A6:J6)
  ws.mergeCells('A6:J6');
  const metaCell2 = ws.getCell('A6');
  metaCell2.value = `※ 지급 기준: S등급(81점↑), A등급(61~80점), B등급(41~60점), C등급(21~40점)  |  옥저인재인증상: 70점 이상 (재학 중 1회 수여)`;
  metaCell2.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF475569' } };
  metaCell2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  metaCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  applyBorder(metaCell2, 'FFE2E8F0');
  ws.getRow(6).height = 20;

  // 빈 행
  ws.getRow(7).height = 8;

  // 4. 테이블 헤더 (Row 8)
  const headers = [
    '연번', '번호', '성명', '학과', '종합점수', '인증등급', '지급 상품명', '옥저인재인증상', '수령 확인 (자필 서명)', '비고'
  ];
  const headerRow = ws.getRow(8);
  headerRow.height = 26;

  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    applyBorder(cell, 'FF94A3B8');
  });

  // 5. 실제 수령 대상자 행 작성
  let currentRowIndex = 9;

  if (recipientList.length === 0) {
    // 해당 학급에 이번 회차 신규 지급 대상자가 없는 경우 안내 문구 표시
    const emptyRow = ws.getRow(9);
    emptyRow.height = 36;
    ws.mergeCells('A9:J9');
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = '※ 해당 학급은 이번 회차 지급 대상자(신규 자격 달성 또는 상위 승급자)가 없습니다.';
    emptyCell.font = { name: '맑은 고딕', size: 10, italic: true, color: { argb: 'FF64748B' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyBorder(emptyCell, 'FFCBD5E1');
    currentRowIndex = 10;
  } else {
    recipientList.forEach(({ student, info }, idx) => {
      const row = ws.getRow(currentRowIndex);
      row.height = 32; // 학생 자필 서명이 용이하도록 32pt 높이 확보

      row.getCell(1).value = idx + 1;
      row.getCell(2).value = `${student.studentNumber}번`;
      row.getCell(3).value = student.studentName;
      row.getCell(4).value = student.major;
      row.getCell(5).value = `${info.displayScore}점`;
      row.getCell(6).value = `${info.displayRank}등급`;
      row.getCell(7).value = info.prizeName;
      row.getCell(8).value = info.awardName;
      row.getCell(9).value = ''; // 자필 서명란 (공란)
      row.getCell(10).value = info.remarks;

      // 셀 서식 적용
      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        cell.font = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF0F172A' } };
        cell.alignment = { 
          horizontal: c === 7 ? 'left' : 'center', 
          vertical: 'middle',
          indent: c === 7 ? 1 : 0
        };
        applyBorder(cell, 'FFCBD5E1');

        // 짝수 행 은은한 줄무늬 배경
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }

        // 서명란 특별 강조 (서명하기 편하게 흰색 배경 유지)
        if (c === 9) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }
      }

      currentRowIndex++;
    });
  }

  // 6. 하단 확인 서약 문구 및 직인 날인란 (A4 하단)
  currentRowIndex += 1;
  const footerStart = currentRowIndex;

  ws.mergeCells(`A${footerStart}:J${footerStart}`);
  const footerNotice = ws.getCell(`A${footerStart}`);
  footerNotice.value = semester
    ? `위와 같이 ${academicYear}학년도 제${semester}학기 옥저인재인증제 등급별 상품 및 옥저인재인증상을 정히 수령하였음을 확인함.`
    : `위와 같이 ${academicYear}학년도 옥저인재인증제 등급별 상품 및 옥저인재인증상을 정히 수령하였음을 확인함.`;
  footerNotice.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
  footerNotice.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(footerStart).height = 28;

  const dateRow = footerStart + 1;
  ws.mergeCells(`A${dateRow}:J${dateRow}`);
  const dateCell = ws.getCell(`A${dateRow}`);
  const today = new Date();
  dateCell.value = `${today.getFullYear()}년    ${today.getMonth() + 1}월    ${today.getDate()}일`;
  dateCell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF334155' } };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(dateRow).height = 24;

  const signRow = footerStart + 2;
  ws.mergeCells(`A${signRow}:J${signRow}`);
  const signCell = ws.getCell(`A${signRow}`);
  signCell.value = `지도(담임)교사:                       (인)            산학협력부장:                       (인)`;
  signCell.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
  signCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(signRow).height = 36;
}

/**
 * 전체 학년 총괄 요약 시트 작성 (전체 통계 및 반별 현황)
 */
function buildOverallSummarySheet(
  wb: ExcelJS.Workbook,
  params: {
    academicYear: number;
    semester?: number;
    grade: number;
    evaluations: FullStudentEvaluation[];
    sortedClassKeys: string[];
    classMap: Map<string, FullStudentEvaluation[]>;
  }
) {
  const { academicYear, semester, grade, evaluations, sortedClassKeys, classMap } = params;

  const ws = wb.addWorksheet('전체 총괄 요약', {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: 'portrait',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2 },
    },
  });

  ws.columns = [
    { width: 22 }, // A: 학급구분
    { width: 12 }, // B: 재적인원
    { width: 11 }, // C: S등급
    { width: 11 }, // D: A등급
    { width: 11 }, // E: B등급
    { width: 11 }, // F: C등급
    { width: 11 }, // G: D등급
    { width: 16 }, // H: 상품지급 대상
    { width: 16 }, // I: 인증상 대상
  ];

  // 타이틀
  ws.mergeCells('A2:I3');
  const titleCell = ws.getCell('A2');
  titleCell.value = semester
    ? `${academicYear}학년도 제${semester}학기 ${grade}학년 옥저인재인증 포상 총괄 현황`
    : `${academicYear}학년도 ${grade}학년 옥저인재인증 포상 총괄 현황`;
  titleCell.font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 헤더
  const headers = ['학급 구분', '재적인원', 'S등급', 'A등급', 'B등급', 'C등급', 'D등급', '상품지급 대상', '인증상 대상'];
  const headerRow = ws.getRow(7);
  headerRow.height = 26;

  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    applyBorder(cell, 'FF94A3B8');
  });

  let rowIdx = 8;
  let sumTotal = 0;
  let sumS = 0, sumA = 0, sumB = 0, sumC = 0, sumD = 0;
  let sumAward = 0, sumPrize = 0;

  for (const classKey of sortedClassKeys) {
    const students = classMap.get(classKey) || [];
    const countTotal = students.length;

    // 등급별 인원: 현재 평가 점수 전체 분포가 아닌, 이번 회차 실제 확정(지급) 대상자 인원 집계
    const studentRecipientInfos = students.map(s => getStudentRecipientInfo(s, academicYear, semester));
    const countS = studentRecipientInfos.filter(info => info.hasPrize && info.displayRank === 'S').length;
    const countA = studentRecipientInfos.filter(info => info.hasPrize && info.displayRank === 'A').length;
    const countB = studentRecipientInfos.filter(info => info.hasPrize && info.displayRank === 'B').length;
    const countC = studentRecipientInfos.filter(info => info.hasPrize && info.displayRank === 'C').length;
    const countD = studentRecipientInfos.filter(info => info.hasPrize && info.displayRank === 'D').length; // 0
    const countPrize = studentRecipientInfos.filter(info => info.hasPrize).length;
    const countAward = studentRecipientInfos.filter(info => info.hasAward).length;

    sumTotal += countTotal;
    sumS += countS; sumA += countA; sumB += countB; sumC += countC; sumD += countD;
    sumAward += countAward; sumPrize += countPrize;

    const row = ws.getRow(rowIdx);
    row.height = 24;
    row.values = [
      `${grade}학년 ${classKey}`,
      `${countTotal}명`,
      `${countS}명`,
      `${countA}명`,
      `${countB}명`,
      `${countC}명`,
      `${countD}명`,
      `${countPrize}명`,
      `${countAward}명`
    ];

    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.font = { name: '맑은 고딕', size: 9.5 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      applyBorder(cell, 'FFCBD5E1');
      if ((rowIdx - 8) % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }
    rowIdx++;
  }

  // 메타 정보 (합계 계산 후 정확한 상품 및 인증상 수여 인원 반영)
  ws.mergeCells('A5:I5');
  const metaCell = ws.getCell('A5');
  metaCell.value = `■ 총 재적인원: ${evaluations.length}명   |   상품 지급: 총 ${sumPrize}명   |   인증상 수여: 총 ${sumAward}명   |   학교명: 대구공업고등학교 (산학협력부)`;
  metaCell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  applyBorder(metaCell, 'FFCBD5E1');
  ws.getRow(5).height = 24;

  // 합계 행
  const totalRow = ws.getRow(rowIdx);
  totalRow.height = 26;
  totalRow.values = [
    '합 계',
    `${sumTotal}명`,
    `${sumS}명`,
    `${sumA}명`,
    `${sumB}명`,
    `${sumC}명`,
    `${sumD}명`,
    `${sumPrize}명`,
    `${sumAward}명`
  ];

  for (let c = 1; c <= 9; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    applyBorder(cell, 'FF94A3B8');
  }
}

function applyBorder(cell: ExcelJS.Cell, argbColor = 'FFCBD5E1') {
  cell.border = {
    top: { style: 'thin', color: { argb: argbColor } },
    bottom: { style: 'thin', color: { argb: argbColor } },
    left: { style: 'thin', color: { argb: argbColor } },
    right: { style: 'thin', color: { argb: argbColor } },
  };
}
