// ==============================================================================
// src/lib/employment/kai-excel-generator.ts
// 한국항공우주산업(주) KAI 고교 내신등급 계산표 엑셀 생성 엔진 (ExcelJS 기반)
// 원본 서식 100% 완벽 보존: 배경색(Fill), 글꼴(Font), 테두리(Border), 열너비, 수식(Formula)
// ==============================================================================

import ExcelJS from 'exceljs';
import * as path from 'path';
import { KaiCalculationResult } from './kai-calculator';

// 학기별 엑셀 열 매핑 (1-1 ~ 3-1)
// C: 과목명, D: 단위수, E: 석차등급, F: 단위수X등급 (수식)
const SEMESTER_COLUMNS = [
  { subjectCol: 'C', creditsCol: 'D', gradeCol: 'E', multCol: 'F' }, // 1-1
  { subjectCol: 'G', creditsCol: 'H', gradeCol: 'I', multCol: 'J' }, // 1-2
  { subjectCol: 'K', creditsCol: 'L', gradeCol: 'M', multCol: 'N' }, // 2-1
  { subjectCol: 'O', creditsCol: 'P', gradeCol: 'Q', multCol: 'R' }, // 2-2
  { subjectCol: 'S', creditsCol: 'T', gradeCol: 'U', multCol: 'V' }, // 3-1
];

const ROW_START = 14; // 데이터 시작 행 (14행)
const ROW_END = 28;   // 데이터 끝 행 (28행, 총 15개 행)

/**
 * 템플릿 파일 로드
 */
async function loadTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const templatePath = path.join(process.cwd(), '(붙임 5) (참고) 한국항공우주산업(주) 고교 내신등급 계산표.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  return workbook;
}

/**
 * 특정 시트에 성적 데이터 주입 (스타일/배경색/테두리/수식 100% 보존)
 */
function fillWorksheetWithResult(ws: ExcelJS.Worksheet, result: KaiCalculationResult) {
  result.semesters.forEach((sem, semIdx) => {
    const colMap = SEMESTER_COLUMNS[semIdx];
    if (!colMap) return;

    for (let r = ROW_START; r <= ROW_END; r++) {
      const subjectCell = ws.getCell(`${colMap.subjectCol}${r}`);
      const creditsCell = ws.getCell(`${colMap.creditsCol}${r}`);
      const gradeCell = ws.getCell(`${colMap.gradeCol}${r}`);
      const multCell = ws.getCell(`${colMap.multCol}${r}`);

      const rowIndex = r - ROW_START; // 0 ~ 14

      if (rowIndex < sem.rows.length) {
        const rowData = sem.rows[rowIndex];
        // 셀 서식(배경색, 폰트, 테두리, 정렬)은 그대로 유지하고 값만 변경
        subjectCell.value = rowData.subject;
        creditsCell.value = rowData.credits;
        gradeCell.value = rowData.rankGrade;

        // 곱셈 수식 셀(=D14*E14 등)은 기존 수식을 유지하면서 결과값만 갱신
        const existingFormula = multCell.formula || `${colMap.creditsCol}${r}*${colMap.gradeCol}${r}`;
        multCell.value = {
          formula: existingFormula,
          result: rowData.weightedGrade,
        };
      } else {
        // 데이터가 없는 행은 기존 예시 텍스트 비우기 (서식은 100% 유지)
        subjectCell.value = null;
        creditsCell.value = null;
        gradeCell.value = null;

        const existingFormula = multCell.formula || `${colMap.creditsCol}${r}*${colMap.gradeCol}${r}`;
        multCell.value = {
          formula: existingFormula,
          result: 0,
        };
      }
    }

    // 29행 학기별 합계 수식 보존 및 계산 결과 반영
    const sumCreditsCell = ws.getCell(`${colMap.creditsCol}29`);
    if (sumCreditsCell) {
      const formula = sumCreditsCell.formula || `SUM(${colMap.creditsCol}${ROW_START}:${colMap.creditsCol}${ROW_END})`;
      sumCreditsCell.value = { formula, result: sem.totalCredits };
    }

    const sumMultCell = ws.getCell(`${colMap.multCol}29`);
    if (sumMultCell) {
      const formula = sumMultCell.formula || `SUM(${colMap.multCol}${ROW_START}:${colMap.multCol}${ROW_END})`;
      sumMultCell.value = { formula, result: sem.totalWeightedGrade };
    }
  });

  // 34행 최종 산출성적 셀 (E34) 수식 보존 및 최종 반올림 등급 반영
  const finalCell = ws.getCell('E34');
  if (finalCell) {
    const formula = finalCell.formula || 'ROUND(($F$29+$J$29+$N$29+$R$29+$V$29)/($D$29+$H$29+$L$29+$P$29+$T$29),2)';
    finalCell.value = {
      formula,
      result: result.finalGrade,
    };
  }
}

/**
 * 전과목 및 국영수 결과가 모두 주입된 KAI 엑셀 워크북 Buffer 생성 (ExcelJS)
 */
export async function generateKaiExcelBuffer(
  allResult: KaiCalculationResult,
  kemResult: KaiCalculationResult
): Promise<Buffer> {
  const wb = await loadTemplateWorkbook();

  // 1. 시트 1: 내신등급 계산표(전과목 평균) 주입
  const wsAll = wb.getWorksheet('내신등급 계산표(전과목 평균)');
  if (wsAll) {
    fillWorksheetWithResult(wsAll, allResult);
  }

  // 2. 시트 2: 내신등급 계산표(국영수) 주입
  const wsKem = wb.getWorksheet('내신등급 계산표(국영수)');
  if (wsKem) {
    fillWorksheetWithResult(wsKem, kemResult);
  }

  // ExcelJS 버퍼 생성
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Base64 인코딩된 엑셀 데이터 반환 (클라이언트 브라우저 즉시 다운로드용)
 */
export async function generateKaiExcelBase64(
  allResult: KaiCalculationResult,
  kemResult: KaiCalculationResult
): Promise<string> {
  const buffer = await generateKaiExcelBuffer(allResult, kemResult);
  return buffer.toString('base64');
}
