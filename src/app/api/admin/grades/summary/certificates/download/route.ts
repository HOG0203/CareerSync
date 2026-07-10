import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { MAJOR_SORT_ORDER } from '@/lib/types';

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

// 템플릿 시트 스타일, 열 너비, 병합 정보 복제 함수
function copyWorksheet(sourceSheet: ExcelJS.Worksheet, targetSheet: ExcelJS.Worksheet) {
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

  // 병합 영역 복제
  const merges = (sourceSheet as any).model?.merges;
  if (merges) {
    merges.forEach((mergeRange: string) => {
      try {
        targetSheet.mergeCells(mergeRange);
      } catch (e) {
        // 중복 병합 무시
      }
    });
  }
}

// (이전의 정적 MAJORS_IN_EXCEL 제거 - 학년별 동적 추출로 대체됨)

export async function GET(request: NextRequest) {
  try {
    // 1. 관리자 권한 확인
    const profile = await getCurrentUserProfile();
    if (!profile || profile.role !== 'admin') {
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

    // 자격증 컬럼 헤더 이름 추출 (G열(7)부터 시작하여 '합계' 헤더가 나타나기 전까지의 열)
    const certColumns: { colNum: number; certName: string }[] = [];
    let totalColNum = 48; // 기본값
    let colIndex = 7;
    while (colIndex < 100) {
      const cellValue = sourceSheet.getRow(3).getCell(colIndex).value;
      if (!cellValue) break;
      const cleanHeader = cellValue.toString().replace(/\s+/g, '');
      if (cleanHeader === '합계') {
        totalColNum = colIndex;
        break;
      }
      certColumns.push({
        colNum: colIndex,
        certName: cellValue.toString().trim()
      });
      colIndex++;
    }

    const getValidCerts = (certs: string[]) => {
      return certs.filter((c: string) => {
        return certColumns.some(({ certName }) => matchCertificate(c, certName));
      });
    };

    const formattedDate = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // 1학년, 2학년, 3학년 각각 시트 생성
    const grades = [1, 2, 3] as const;
    
    for (const grade of grades) {
      const gradYear = gradYearMap[grade];
      const sheetName = `종목별자격취득 ${ay.toString().slice(-2)}년 ${grade}학년`;
      const targetSheet = workbook.addWorksheet(sheetName);

      // 서식 복제
      copyWorksheet(sourceSheet, targetSheet);

      // A1 대제목 갱신
      targetSheet.getCell('A1').value = `${ay}학년도 ${grade}학년 계열별, 종목별 자격증 취득 현황  (${formattedDate} 기준)`;

      // 해당 학년 학생들의 고유 학과 추출 및 표준 정렬 순서 적용
      const gradeStudents = (students || []).filter(s => s.graduation_year === gradYear);
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
          let nonItqCertifiedCount = 0;

          majorStudents.forEach(student => {
            const certs = student.certificates || [];
            // 템플릿 상에 존재하는 자격증들만 유효 자격증으로 필터링 (ITQ 및 기타 비대상 자격증 제외)
            const validCerts = getValidCerts(certs);
            const certCount = validCerts.length;

            if (certCount === 1) cCount++;
            else if (certCount === 2) dCount++;
            else if (certCount >= 3) eCount++;

            if (certCount > 0) nonItqCertifiedCount++;
          });

          // 1개, 2개, 3개이상 취득자수 기입
          row.getCell(3).value = cCount;
          row.getCell(4).value = dCount;
          row.getCell(5).value = eCount;

          // F: 계 (C + D + E) 공식 주입
          row.getCell(6).value = { formula: `SUM(C${rowNum}:E${rowNum})` };

          // G~AU: 각 자격증 수 계산 및 기입
          certColumns.forEach(({ colNum, certName }) => {
            const count = majorStudents.filter(student => {
              const certs = student.certificates || [];
              const validCerts = getValidCerts(certs);
              return validCerts.some((c: string) => matchCertificate(c, certName));
            }).length;
            row.getCell(colNum).value = count;
          });

          const totalColLetter = targetSheet.getColumn(totalColNum).letter;
          const endCertColLetter = targetSheet.getColumn(totalColNum - 1).letter;

          // AV: 종목 자격증 합계 공식 주입 (동적 범위 지정)
          row.getCell(totalColNum).value = { formula: `SUM(G${rowNum}:${endCertColLetter}${rowNum})` };

          // AW: 취득률 (인원대비) 공식 주입 (과정원이 0인 경우 대비해 IFERROR 사용)
          row.getCell(totalColNum + 1).value = { formula: `IFERROR(F${rowNum}/B${rowNum}*100, 0)` };

          // AX: ITQ 제외 취득률 기입 (DB 통계 수치 직접 기입)
          row.getCell(totalColNum + 2).value = B > 0 ? (nonItqCertifiedCount / B) * 100 : 0;

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

      // AX11 (totalColNum + 2): 계 ITQ 제외 취득률 (합계)
      const totalStudentsCount = (students || []).filter(s => s.graduation_year === gradYear).length;
      const totalNonItqCertifiedCount = (students || []).filter(s => {
        if (s.graduation_year !== gradYear) return false;
        const certs = s.certificates || [];
        const validCerts = getValidCerts(certs);
        return validCerts.length > 0;
      }).length;
      totalRow.getCell(totalColNum + 2).value = totalStudentsCount > 0 ? (totalNonItqCertifiedCount / totalStudentsCount) * 100 : 0;

      // AY11 (totalColNum + 3): 계 취득비율 공식
      const totalColLetter = targetSheet.getColumn(totalColNum).letter;
      totalRow.getCell(totalColNum + 3).value = { formula: `IFERROR(${totalColLetter}11/B11*100, 0)` };

      // U13, U14 병합 영역 요약 정보 수식 연동
      const awColLetter = targetSheet.getColumn(totalColNum + 1).letter;
      const ayColLetter = targetSheet.getColumn(totalColNum + 3).letter;
      targetSheet.getCell('AB13').value = { formula: `${awColLetter}11` };
      targetSheet.getCell('AB14').value = { formula: `${ayColLetter}11` };

      // 취득률 (ITQ 제외) 컬럼(AX, 50번째 열) 숨김 처리 (전체 시트가 이미 ITQ를 제외하고 연산되므로 불필요한 중복 열임)
      targetSheet.getColumn(totalColNum + 2).hidden = true;
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
