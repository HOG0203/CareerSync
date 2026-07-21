import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { MAJOR_SORT_ORDER } from '@/lib/types';

// 기능사/산업기사 여부를 판별하는 헬퍼 함수
function isCraftsman(certName: string): boolean {
  const clean = certName.replace(/\s+/g, '').toLowerCase();
  return clean.includes('기능사') || clean.includes('산업기사');
}

// 기능사 접미사 매칭을 위한 검사 함수
function matchCertificate(studentCert: string, headerName: string): boolean {
  const sCert = studentCert.replace(/\s+/g, '').toLowerCase();
  const hName = headerName.replace(/\s+/g, '').toLowerCase();

  // 1. 완전 일치
  if (sCert === hName) return true;

  // 2. 기능사 접미사 대응
  if (sCert.startsWith(hName)) {
    const suffix = sCert.slice(hName.length);
    if (
      suffix === '기능사' || 
      suffix === '운전기능사' || 
      suffix === '운전' || 
      suffix === '기능사(양식)' || 
      suffix === '기능사(한식)'
    ) {
      return true;
    }
  }

  // 3. 예외 조건 매칭
  if (hName === '굴삭기' && sCert.includes('굴삭기')) return true;
  if (hName === '지게차운전' && sCert.includes('지게차')) return true;
  if (hName === '피복아크용접' && (sCert.includes('피복아크') || sCert.includes('용접'))) return true;
  if (hName === '염색' && sCert.includes('염색')) return true;
  if (hName === '교통안전관리자' && sCert.includes('교통안전관리자')) return true;

  return false;
}

// 템플릿 시트 스타일, 열 너비, 병합 정보 복제 함수 (동적 병합 조정을 위해 totalColNum, templateTotalColNum 전달받음)
function copyWorksheet(
  sourceSheet: ExcelJS.Worksheet,
  targetSheet: ExcelJS.Worksheet,
  templateTotalColNum: number,
  totalColNum: number
) {
  // Page setup 및 view 속성 복제
  targetSheet.pageSetup = { ...sourceSheet.pageSetup };
  targetSheet.views = sourceSheet.views;

  // 컬럼 너비 및 기본 스타일 복제
  sourceSheet.columns?.forEach((col, i) => {
    const targetCol = targetSheet.getColumn(i + 1);
    targetCol.width = col.width;
    if (col.style) targetCol.style = col.style;
  });

  // 셀 값 및 서식 복제
  sourceSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = targetSheet.getRow(rowNumber);
    targetRow.height = row.height;
    
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = cell.value;
      if (cell.style) targetCell.style = cell.style;
    });
  });

  // 병합 영역 복제 (동적으로 너비가 변경되어야 하는 병합 범위는 제외하고 복사)
  const merges = (sourceSheet as any).model?.merges;
  if (merges) {
    merges.forEach((mergeRange: string) => {
      // 1. 대제목 병합 (A1:...)
      if (mergeRange.startsWith('A1:')) {
        return;
      }
      // 2. 종목별 자격증 취득 현황 (G2:...)
      if (mergeRange.startsWith('G2:')) {
        return;
      }
      // 3. 통계 열 세로 병합 (AX2:AX3 등)
      const tColLetter = sourceSheet.getColumn(templateTotalColNum).letter;
      const tColLetter1 = sourceSheet.getColumn(templateTotalColNum + 1).letter;
      const tColLetter2 = sourceSheet.getColumn(templateTotalColNum + 2).letter;
      const tColLetter3 = sourceSheet.getColumn(templateTotalColNum + 3).letter;
      if (
        mergeRange === `${tColLetter}2:${tColLetter}3` ||
        mergeRange === `${tColLetter1}2:${tColLetter1}3` ||
        mergeRange === `${tColLetter2}2:${tColLetter2}3` ||
        mergeRange === `${tColLetter3}2:${tColLetter3}3`
      ) {
        return;
      }

      try {
        targetSheet.mergeCells(mergeRange);
      } catch (e) {
        // 중복 병합 무시
      }
    });
  }

  // 동적 병합 영역 적용
  const lastColLetter = targetSheet.getColumn(totalColNum + 3).letter;
  // 대제목 병합
  try {
    targetSheet.mergeCells(`A1:${lastColLetter}1`);
  } catch (e) {}

  // 자격증 현황 대주제 병합 (G2 ~ 마지막 자격증 열)
  const certEndColLetter = targetSheet.getColumn(totalColNum - 1).letter;
  try {
    targetSheet.mergeCells(`G2:${certEndColLetter}2`);
  } catch (e) {}

  // 통계 헤더 열 세로 병합 (Row 2 ~ Row 3)
  const colLetter = targetSheet.getColumn(totalColNum).letter;
  const colLetter1 = targetSheet.getColumn(totalColNum + 1).letter;
  const colLetter2 = targetSheet.getColumn(totalColNum + 2).letter;
  const colLetter3 = targetSheet.getColumn(totalColNum + 3).letter;
  try { targetSheet.mergeCells(`${colLetter}2:${colLetter}3`); } catch (e) {}
  try { targetSheet.mergeCells(`${colLetter1}2:${colLetter1}3`); } catch (e) {}
  try { targetSheet.mergeCells(`${colLetter2}2:${colLetter2}3`); } catch (e) {}
  try { targetSheet.mergeCells(`${colLetter3}2:${colLetter3}3`); } catch (e) {}
}

// 템플릿의 특정 열의 스타일(너비, 테두리, 배경색 등)을 대상 열로 복사하는 헬퍼 함수
function copyColumnStyles(
  sourceSheet: ExcelJS.Worksheet,
  targetSheet: ExcelJS.Worksheet,
  sourceColNum: number,
  targetColNum: number,
  startRow: number,
  endRow: number
) {
  const sourceCol = sourceSheet.getColumn(sourceColNum);
  const targetCol = targetSheet.getColumn(targetColNum);
  if (sourceCol.width) {
    targetCol.width = sourceCol.width;
  }
  for (let r = startRow; r <= endRow; r++) {
    const sourceCell = sourceSheet.getRow(r).getCell(sourceColNum);
    const targetCell = targetSheet.getRow(r).getCell(targetColNum);
    if (sourceCell.style) {
      targetCell.style = { ...sourceCell.style };
    }
  }
}

// (이전의 정적 MAJORS_IN_EXCEL 제거 - 학년별 동적 추출로 대체됨)

export async function GET(request: NextRequest) {
  try {
    // 1. 관리자 및 교직원 권한 확인 (다운로드 권한 확대)
    const profile = await getCurrentUserProfile();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ayStr = searchParams.get('ay');

    const supabase = await createClient();
    
    // 시스템 학사학년도 조회
    const { data: settingsData } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();
    
    const baseYear = settingsData?.value?.year || 2026;
    const ay = ayStr ? parseInt(ayStr) : baseYear;

    // 학년별 졸업 학년도 연산
    const gradYearMap = {
      1: ay + 3, // 1학년
      2: ay + 2, // 2학년
      3: ay + 1  // 3학년
    };

    // 타겟 학년의 전체 3학년 데이터 로드
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('graduation_year, student_name, major, class_info, certificates')
      .in('graduation_year', [gradYearMap[1], gradYearMap[2], gradYearMap[3]]);

    if (studentsError) {
      return new NextResponse(`Database error: ${studentsError.message}`, { status: 500 });
    }

    // 템플릿 경로 설정 (.xlsx 형식의 변환된 템플릿 로드)
    const templatePath = path.join(process.cwd(), '26년자격취득 현황(예시).xlsx');
    if (!fs.existsSync(templatePath)) {
      return new NextResponse('Excel template file not found on server.', { status: 404 });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sourceSheet = workbook.getWorksheet('종목별자격취득 24년 3학년');
    if (!sourceSheet) {
      return new NextResponse('Template sheet not found.', { status: 404 });
    }

    // 템플릿에서 기존 합계 열 위치 파악 (빈 셀이 있어도 스캔을 중단하지 않음)
    let templateTotalColNum = 48;
    for (let tColIndex = 7; tColIndex < 120; tColIndex++) {
      const cellValue = sourceSheet.getRow(3).getCell(tColIndex).value;
      if (cellValue && cellValue.toString().replace(/\s+/g, '') === '합계') {
        templateTotalColNum = tColIndex;
        break;
      }
    }

    const formattedDate = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // 1학년, 2학년, 3학년 각각 시트 생성
    const grades = [1, 2, 3] as const;

    for (const grade of grades) {
      const gradYear = gradYearMap[grade];

      // 해당 학년 학생이 실제 취득한 자격증만 추출 (count > 0인 것만 열로 구성)
      const gradeStudents = (students || []).filter(s => s.graduation_year === gradYear);
      const rawCertNames = Array.from(new Set(
        gradeStudents.flatMap(s => Array.isArray(s.certificates) ? s.certificates : []).filter(Boolean) as string[]
      ));
      
      const craftsmanCerts = rawCertNames.filter(name => isCraftsman(name)).sort((a, b) => a.localeCompare(b, 'ko'));
      const nonCraftsmanCerts = rawCertNames.filter(name => !isCraftsman(name)).sort((a, b) => a.localeCompare(b, 'ko'));
      const gradeCertNames = [...craftsmanCerts, ...nonCraftsmanCerts];

      const certColumns = gradeCertNames.map((certName, i) => ({ colNum: 7 + i, certName }));
      const totalColNum = 7 + gradeCertNames.length;

      const sheetName = `종목별자격취득 ${ay.toString().slice(-2)}년 ${grade}학년`;
      const targetSheet = workbook.addWorksheet(sheetName);

      // 서식 복제
      copyWorksheet(sourceSheet, targetSheet, templateTotalColNum, totalColNum);

      // A1 대제목 갱신
      targetSheet.getCell('A1').value = `${ay}학년도 ${grade}학년 계열별, 종목별 자격증 취득 현황  (${formattedDate} 기준)`;

      // 템플릿의 기존 자격증·통계 열 범위를 광범위하게 초기화
      // - 헤더(3행): null로 제거
      // - 데이터행(4~11행): 0으로 덮어써 formula 셀까지 확실히 초기화
      // - 충분히 넓게 (max+20) 초기화해 어떤 위치의 잔재도 제거
      const aggressiveClearTo = Math.max(templateTotalColNum, totalColNum) + 20;
      for (let col = 7; col <= aggressiveClearTo; col++) {
        targetSheet.getRow(3).getCell(col).value = null;
        for (let rowNum = 4; rowNum <= 11; rowNum++) {
          targetSheet.getRow(rowNum).getCell(col).value = 0;
        }
      }

      // 2~11행에 걸쳐 자격증 열 서식(G열 스타일) 복제
      for (let col = 7; col < totalColNum; col++) {
        copyColumnStyles(sourceSheet, targetSheet, 7, col, 2, 11);
      }

      // 2~11행에 걸쳐 통계 열 서식(합계, 취득률, 취득률(ITQ제외), 취득비율) 복제
      copyColumnStyles(sourceSheet, targetSheet, templateTotalColNum, totalColNum, 2, 11);
      copyColumnStyles(sourceSheet, targetSheet, templateTotalColNum + 1, totalColNum + 1, 2, 11);
      copyColumnStyles(sourceSheet, targetSheet, templateTotalColNum + 2, totalColNum + 2, 2, 11);
      copyColumnStyles(sourceSheet, targetSheet, templateTotalColNum + 3, totalColNum + 3, 2, 11);

      // 기존 Row 2와 Row 3에 있던 병합된 잔여 텍스트값 초기화
      [totalColNum, totalColNum + 1, totalColNum + 2, totalColNum + 3].forEach(col => {
        targetSheet.getRow(2).getCell(col).value = null;
        targetSheet.getRow(3).getCell(col).value = null;
      });

      // 2행: 대주제 헤더 기입
      targetSheet.getRow(2).getCell(7).value = "2. 종  목  별   자  격  증   취  득   현  황";

      // 3행: 실제 자격증 이름 헤더 기입
      certColumns.forEach(({ colNum, certName }) => {
        targetSheet.getRow(3).getCell(colNum).value = certName;
      });

      // 2행 & 3행: 합계·통계 열 헤더 기입 (세로 병합 셀 대응)
      targetSheet.getRow(2).getCell(totalColNum).value = "합\n\n\n계";
      targetSheet.getRow(3).getCell(totalColNum).value = "합\n\n\n계";

      targetSheet.getRow(2).getCell(totalColNum + 1).value = "기능사 포함\n취득률";
      targetSheet.getRow(3).getCell(totalColNum + 1).value = "기능사 포함\n취득률";

      targetSheet.getRow(2).getCell(totalColNum + 2).value = "기능사\n취득률";
      targetSheet.getRow(3).getCell(totalColNum + 2).value = "기능사\n취득률";

      targetSheet.getRow(2).getCell(totalColNum + 3).value = "취득비율\n(자격증 \n취득수)";
      targetSheet.getRow(3).getCell(totalColNum + 3).value = "취득비율\n(자격증 \n취득수)";

      // 해당 학년 학생들의 고유 학과 추출 및 표준 정렬 순서 적용
      const uniqueMajors = Array.from(new Set(gradeStudents.map(s => s.major).filter(Boolean) as string[]));
      
      uniqueMajors.sort((a, b) => {
        const idxA = MAJOR_SORT_ORDER.indexOf(a);
        const idxB = MAJOR_SORT_ORDER.indexOf(b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });

      // 학과별 데이터 기입 (템플릿 상의 4행 ~ 10행 고정 구역 순회)
      for (let idx = 0; idx < 7; idx++) {
        const rowNum = 4 + idx;
        const row = targetSheet.getRow(rowNum);

        if (idx < uniqueMajors.length) {
          const majorName = uniqueMajors[idx];
          const majorStudents = gradeStudents.filter(s => s.major === majorName);
          const B = majorStudents.length;

          // 학과명 & 과정원 기입
          row.getCell(1).value = majorName;
          row.getCell(2).value = B;

          let cCount = 0;
          let dCount = 0;
          let eCount = 0;
          let craftsmanCertifiedCount = 0;

          majorStudents.forEach(student => {
            const certs = student.certificates || [];
            // 템플릿 상에 존재하는 자격증들만 유효 자격증으로 필터링
            const validCerts = (Array.isArray(certs) ? certs : []).filter(Boolean);
            const certCount = validCerts.length;

            if (certCount === 1) cCount++;
            else if (certCount === 2) dCount++;
            else if (certCount >= 3) eCount++;

            // 기능사 자격증 취득 여부 판별
            const hasCraftsman = validCerts.some(c => isCraftsman(c));
            if (hasCraftsman) {
              craftsmanCertifiedCount++;
            }
          });

          // 1개, 2개, 3개이상 취득자수 기입
          row.getCell(3).value = cCount;
          row.getCell(4).value = dCount;
          row.getCell(5).value = eCount;

          // F: 계 (C + D + E) 공식 주입
          row.getCell(6).value = { formula: `SUM(C${rowNum}:E${rowNum})` };

          // G~: 각 자격증 수 계산 및 기입 (정확한 이름 매칭)
          certColumns.forEach(({ colNum, certName }) => {
            const count = majorStudents.filter(student => {
              const certs = student.certificates || [];
              return (Array.isArray(certs) ? certs : []).includes(certName);
            }).length;
            row.getCell(colNum).value = count;
          });

          const totalColLetter = targetSheet.getColumn(totalColNum).letter;
          const endCertColLetter = targetSheet.getColumn(totalColNum - 1).letter;

          // AV: 종목 자격증 합계 공식 주입 (동적 범위 지정)
          row.getCell(totalColNum).value = { formula: `SUM(G${rowNum}:${endCertColLetter}${rowNum})` };

          // AW: 취득률 (인원대비) 공식 주입 (과정원이 0인 경우 대비해 IFERROR 사용)
          row.getCell(totalColNum + 1).value = { formula: `IFERROR(F${rowNum}/B${rowNum}*100, 0)` };

          // AX: 기능사 취득률 기입
          row.getCell(totalColNum + 2).value = B > 0 ? (craftsmanCertifiedCount / B) * 100 : 0;

          // AY: 취득비율 (자격증 취득수) 공식 주입
          row.getCell(totalColNum + 3).value = { formula: `IFERROR(${totalColLetter}${rowNum}/B${rowNum}*100, 0)` };
        } else {
          const endCertColLetter = targetSheet.getColumn(totalColNum - 1).letter;
          // 남는 엑셀 행 영역은 0 및 빈값 처리하여 하단 '계' 연산(SUM)에 영향이 가지 않도록 정화
          row.getCell(1).value = '';
          row.getCell(2).value = 0;
          row.getCell(3).value = 0;
          row.getCell(4).value = 0;
          row.getCell(5).value = 0;
          row.getCell(6).value = { formula: `SUM(C${rowNum}:E${rowNum})` };
          
          certColumns.forEach(({ colNum }) => {
            row.getCell(colNum).value = 0;
          });
          
          row.getCell(totalColNum).value = { formula: `SUM(G${rowNum}:${endCertColLetter}${rowNum})` };
          row.getCell(totalColNum + 1).value = 0;
          row.getCell(totalColNum + 2).value = 0;
          row.getCell(totalColNum + 3).value = 0;
        }
      }

      // 11행: 계 (소계) 수식 및 연산 기입
      const totalRow = targetSheet.getRow(11);
      totalRow.getCell(1).value = '계';
      totalRow.getCell(2).value = { formula: 'SUM(B4:B10)' };
      totalRow.getCell(3).value = { formula: 'SUM(C4:C10)' };
      totalRow.getCell(4).value = { formula: 'SUM(D4:D10)' };
      totalRow.getCell(5).value = { formula: 'SUM(E4:E10)' };
      totalRow.getCell(6).value = { formula: 'SUM(F4:F10)' };

      // G11부터 AV11(totalColNum)까지 소계 공식 기입
      for (let colNum = 7; colNum <= totalColNum; colNum++) {
        const colLetter = targetSheet.getColumn(colNum).letter;
        totalRow.getCell(colNum).value = { formula: `SUM(${colLetter}4:${colLetter}10)` };
      }

      // AW11 (totalColNum + 1): 계 취득률 공식
      totalRow.getCell(totalColNum + 1).value = { formula: 'IFERROR(F11/B11*100, 0)' };

      // AX11 (totalColNum + 2): 계 기능사 취득률 (합계)
      const totalStudentsCount = gradeStudents.length;
      const totalCraftsmanCertifiedCount = gradeStudents.filter(s => {
        const certs = s.certificates || [];
        const validCerts = (Array.isArray(certs) ? certs : []).filter(Boolean);
        return validCerts.some(c => isCraftsman(c));
      }).length;
      totalRow.getCell(totalColNum + 2).value = totalStudentsCount > 0 ? (totalCraftsmanCertifiedCount / totalStudentsCount) * 100 : 0;

      // AY11 (totalColNum + 3): 계 취득비율 공식
      const totalColLetter = targetSheet.getColumn(totalColNum).letter;
      totalRow.getCell(totalColNum + 3).value = { formula: `IFERROR(${totalColLetter}11/B11*100, 0)` };

      // U13, U14 병합 영역 요약 정보 수식 연동
      const awColLetter = targetSheet.getColumn(totalColNum + 1).letter;
      const ayColLetter = targetSheet.getColumn(totalColNum + 3).letter;
      targetSheet.getCell('AB13').value = { formula: `${awColLetter}11` };
      targetSheet.getCell('AB14').value = { formula: `${ayColLetter}11` };

      // 기능사 제외 취득률 컬럼은 숨기지 않고 노출함
      // targetSheet.getColumn(totalColNum + 2).hidden = true;

      // used area(totalColNum+3) 이후 잔여 열의 값·스타일 완전 제거
      // copyWorksheet가 복사한 템플릿의 색상/테두리가 남아 빈 색칸으로 보이는 문제 방지
      for (let col = totalColNum + 4; col <= aggressiveClearTo + 5; col++) {
        for (let rowNum = 2; rowNum <= 12; rowNum++) {
          const cell = targetSheet.getRow(rowNum).getCell(col);
          cell.value = null;
          try { cell.style = {}; } catch (_) { /* 스타일 초기화 실패 무시 */ }
        }
      }
    }

    // 원본 템플릿의 소스 시트 및 임시 시트 삭제
    workbook.removeWorksheet('종목별자격취득 24년 3학년');
    const dummySheet = workbook.getWorksheet('VXXXXX');
    if (dummySheet) {
      workbook.removeWorksheet('VXXXXX');
    }

    // 버퍼로 쓰고 파일 응답 전달
    const buffer = await workbook.xlsx.writeBuffer();
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${ay}_grade_certificate_status.xlsx"`,
      },
    });

  } catch (error: any) {
    console.error('Excel export error:', error);
    return new NextResponse(`Server error during Excel export: ${error.message}`, { status: 500 });
  }
}
