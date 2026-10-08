export const normalizeDate = (dateStr: string | null | undefined): string | null => {
  if (!dateStr || dateStr.trim() === '') return null
  const match = dateStr.trim().match(/^[\d.\-\/]+/)
  if (!match) return null
  let datePart = match[0]
  let clean = datePart.replace(/[.\/]$/, '').replace(/[.\/]/g, '-')
  const parts = clean.split('-').filter(p => p !== '')
  if (parts.length === 3) {
    let year = parts[0]
    const month = parts[1].padStart(2, '0')
    const day = parts[2].padStart(2, '0')
    if (year.length === 2) year = '20' + year
    return `${year}-${month}-${day}`
  }
  return null
}

export async function updateStudentFieldTrainingRecord(
  supabase: any,
  studentId: string,
  field: string,
  value: any
) {
  let finalVal = value;
  if (value === '' || value === 'CLEARED' || (Array.isArray(value) && value.length === 0)) finalVal = null;

  // 최신 실습 기록 조회 (내림차순 정렬 1건)
  const { data: latestRecords, error: readError } = await supabase
    .from('field_training_records')
    .select('*')
    .eq('student_id', studentId)
    .order('training_order', { ascending: false })
    .limit(1);

  if (readError) return { success: false, error: readError.message };
  const latest = latestRecords && latestRecords.length > 0 ? latestRecords[0] : null;

  if (latest) {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (field === 'latest_training_company') {
      updateData.company = finalVal || '';
    } else if (field === 'start_date') {
      updateData.start_date = normalizeDate(finalVal);
    } else if (field === 'end_date') {
      updateData.end_date = normalizeDate(finalVal);
    } else if (field === 'training_stipend_status') {
      updateData.stipend_status = finalVal || 'X';
    } else if (field === 'is_hiring_conversion') {
      if (finalVal && finalVal !== 'X') {
        updateData.hiring_status = '채용전환';
        updateData.conversion_date = normalizeDate(finalVal) || (finalVal === 'O' ? (latest.end_date || new Date().toISOString().slice(0, 10)) : finalVal);
        updateData.return_reason = null; // 복교사유 초기화
      } else {
        updateData.hiring_status = '진행중';
        updateData.conversion_date = null;
      }
    } else if (field === 'is_returned' || field === 'return_reason') {
      if (finalVal && finalVal !== 'X') {
        updateData.hiring_status = '복교';
        updateData.return_reason = finalVal;
        updateData.conversion_date = null; // 채용전환 초기화
      } else {
        updateData.hiring_status = '진행중';
        updateData.return_reason = null;
      }
    }

    // 수정 후 데이터가 모두 비어 있는지 확인 (실습처, 시작일, 종료일, 복교사유, 전환일 등이 모두 빈 값인 유령 데이터 방지)
    const merged = { ...latest, ...updateData };
    const hasCompany = Boolean(merged.company && String(merged.company).trim() !== '');
    const hasStartDate = Boolean(merged.start_date);
    const hasEndDate = Boolean(merged.end_date);
    const hasConversion = Boolean(merged.conversion_date || (merged.hiring_status === '채용전환'));
    const hasReturn = Boolean(merged.return_reason && String(merged.return_reason).trim() !== '');

    if (!hasCompany && !hasStartDate && !hasEndDate && !hasConversion && !hasReturn) {
      // 모든 주요 실습 데이터가 비워진 경우 유령 레코드 남기지 않고 삭제
      const { error } = await supabase.from('field_training_records').delete().eq('id', latest.id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    const { error } = await supabase
      .from('field_training_records')
      .update(updateData)
      .eq('id', latest.id);

    if (error) return { success: false, error: error.message };

    // 채용전환 상태인 경우 취업처도 동기화
    const effectiveCompany = field === 'latest_training_company' && finalVal ? finalVal : latest.company;
    if ((updateData.hiring_status === '채용전환' || latest.hiring_status === '채용전환') && effectiveCompany) {
      const { error: syncError } = await supabase.from('student_employments').upsert({ id: studentId, company: effectiveCompany, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (syncError) return { success: false, error: syncError.message };
    }

    return { success: true };
  } else {
    // 실습 이력이 없는 상태에서 빈 값/취소 커밋인 경우 1차 실습 레코드를 생성하지 않음
    const cleanStr = String(finalVal || '').trim();
    if (!finalVal || cleanStr === '' || cleanStr === 'X' || cleanStr === 'CLEARED' || cleanStr === '-') {
      return { success: true };
    }

    // 유효한 값이 입력된 경우에만 1차 실습으로 신규 등록
    const isConv = field === 'is_hiring_conversion' && finalVal && finalVal !== 'X';
    const isRet = (field === 'is_returned' || field === 'return_reason') && finalVal && finalVal !== 'X';

    const newRecord: any = {
      student_id: studentId,
      training_order: 1,
      company: field === 'latest_training_company' ? (finalVal || '') : '',
      start_date: field === 'start_date' ? normalizeDate(finalVal) : null,
      end_date: field === 'end_date' ? normalizeDate(finalVal) : null,
      stipend_status: field === 'training_stipend_status' ? (finalVal || 'X') : 'X',
      hiring_status: isRet ? '복교' : (isConv ? '채용전환' : '진행중'),
      conversion_date: isConv ? (normalizeDate(finalVal) || (finalVal === 'O' ? new Date().toISOString().slice(0, 10) : finalVal)) : null,
      return_reason: isRet ? finalVal : null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('field_training_records')
      .insert([newRecord]);

    if (error) return { success: false, error: error.message };

    if (isConv && newRecord.company) {
      const { error: syncError } = await supabase.from('student_employments').upsert({ id: studentId, company: newRecord.company, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (syncError) return { success: false, error: syncError.message };
    }

    return { success: true };
  }
}
