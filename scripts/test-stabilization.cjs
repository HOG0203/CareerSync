const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Load the real TypeScript modules without adding a test framework or emitting files.
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(filename), name);
      const file = [target, target + '.ts', target + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      return load(file, mocks, cache);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

async function main() {
  const policy = load('src/lib/access-policy.ts');
  assert.equal(policy.canAccessPath('student', '/students'), false);
  assert.equal(policy.canAccessPath('student', '/student/certification'), true);
  assert.equal(policy.canAccessPath('student', '/student-accounts'), false);
  assert.equal(policy.canAccessPath('teacher', '/admin/users'), false);
  assert.equal(policy.canAccessPath('teacher', '/admin/certification/grades'), true);
  assert.equal(policy.canAccessPath(undefined, '/dashboard'), false);
  assert.equal(policy.canEditStudentField('teacher', 'employment_status'), false);
  assert.equal(policy.canEditStudentField('student', 'phone_number'), false);
  assert.equal(policy.canEditStudentField('admin', 'id'), false);
  assert.equal(policy.canEditStudentField('admin', 'unknown_column'), false);
  const teacher = { role: 'teacher', assigned_grade: 3, assigned_major: '전기과', assigned_class: '1' };
  const student = { graduation_year: 2027, major: '전기과', class_info: '1' };
  assert.equal(policy.isAssignedStudent(teacher, student, 2026), true);
  assert.equal(policy.isAssignedStudent(teacher, { ...student, class_info: '2' }, 2026), false);
  assert.equal(policy.isAssignedStudent(teacher, student, 2027), false);
  assert.equal(policy.isAssignedStudent({ role: 'teacher' }, student, 2026), false);
  console.log('PASS: role, field and assigned-class boundaries');

  let profile = null;
  let reads = 0;
  let students = [{ id: 's1', ...student }];
  const { authorizeStudentUpdates } = load('src/lib/student-access.ts', {
    '@/lib/data': { getCurrentUserProfile: async () => profile },
    '@/app/(dashboard)/admin/settings/actions': { getSystemSettings: async () => ({ baseYear: 2026 }) },
    '@/lib/supabase/server': { createAdminClient: () => ({ from: () => ({ select: () => ({ in: async () => { reads++; return { data: students, error: null }; } }) }) }) },
  });
  assert.ok(await authorizeStudentUpdates([{ id: 's1', field: 'phone_number' }]));
  assert.equal(reads, 0);
  profile = teacher;
  assert.equal(await authorizeStudentUpdates([{ id: 's1', field: 'phone_number' }]), null);
  assert.ok(await authorizeStudentUpdates([{ id: 's1', field: 'phone_number' }, { id: 's2', field: 'phone_number' }]));
  students = [{ id: 's1', ...student, class_info: '2' }];
  assert.ok(await authorizeStudentUpdates([{ id: 's1', field: 'phone_number' }]));
  console.log('PASS: whole-request authorization rejects missing/foreign students');

  let databaseAccesses = 0;
  const actions = load('src/app/students/actions.ts', {
    '@/lib/data': { getCurrentUserProfile: async () => null },
    '@/lib/student-access': { authorizeStudentUpdates: async () => '로그인이 필요합니다.' },
    '@/app/(dashboard)/admin/settings/actions': { getSystemSettings: async () => ({ baseYear: 2026 }) },
    '@/lib/supabase/server': {
      createAdminClient: () => { databaseAccesses++; throw new Error('Unauthorized DB access'); },
      createClient: () => { databaseAccesses++; throw new Error('Unauthorized DB access'); },
    },
  });
  for (const name of ['uploadStudentsCSV', 'uploadBasicStudentsCSV', 'bulkPromoteFromExcel']) {
    assert.equal((await actions[name]('header\nrow')).success, false);
  }
  assert.equal((await actions.createStudent({})).success, false);
  assert.equal((await actions.deleteStudents(['s1'])).success, false);
  assert.equal((await actions.updateStudentField('s1', 'phone_number', '010')).success, false);
  assert.equal((await actions.bulkUpdateStudentData([{ id: 's1', field: 'phone_number', value: '010' }])).success, false);
  assert.equal(databaseAccesses, 0);
  console.log('PASS: unauthenticated real student actions reject before database access');

  const { saveInOrder } = load('src/lib/bulk-save.ts');
  const seen = [];
  const partial = await saveInOrder([1, 2, 3], async value => {
    seen.push(value);
    return value === 2 ? { success: false, error: 'DB unavailable' } : { success: true };
  });
  assert.deepEqual(seen, [1, 2]);
  assert.equal(partial.success, false);
  assert.equal(partial.savedCount, 1);
  assert.match(partial.error, /DB unavailable/);
  assert.equal((await saveInOrder([1], async () => { throw new Error('network'); })).savedCount, 0);
  assert.equal((await saveInOrder([1, 2], async () => ({ success: true }))).savedCount, 2);
  console.log('PASS: partial writes and thrown failures stop the batch');

  const { updateStudentFieldTrainingRecord } = load('src/lib/student-training.ts');
  function trainingDb(latest, failures = {}) {
    return { from(table) {
      let operation = 'read';
      const response = () => ({ data: operation === 'read' ? latest : null, error: failures[`${table}:${operation}`] ? { message: failures[`${table}:${operation}`] } : null });
      const query = {
        select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
        update() { operation = 'update'; return query; }, delete() { operation = 'delete'; return query; },
        insert() { operation = 'insert'; return query; }, upsert() { operation = 'upsert'; return query; },
        then(resolve, reject) { return Promise.resolve(response()).then(resolve, reject); },
      };
      return query;
    } };
  }
  assert.equal((await updateStudentFieldTrainingRecord(trainingDb([], { 'field_training_records:read': 'read failed' }), 's1', 'latest_training_company', '회사')).success, false);
  assert.equal((await updateStudentFieldTrainingRecord(trainingDb([{ id: 't1' }], { 'field_training_records:delete': 'delete failed' }), 's1', 'latest_training_company', '')).success, false);
  assert.equal((await updateStudentFieldTrainingRecord(trainingDb([{ id: 't1', company: '회사', hiring_status: '채용전환' }], { 'student_employments:upsert': 'sync failed' }), 's1', 'latest_training_company', '새 회사')).success, false);
  assert.equal((await updateStudentFieldTrainingRecord(trainingDb([], { 'field_training_records:insert': 'insert failed' }), 's1', 'latest_training_company', '회사')).success, false);
  console.log('PASS: training read, delete, insert and employment sync errors are reported');

  const { getEffectiveTeacherSlot } = load('src/lib/substitute/effective-teacher-slot.ts');
  const timetableTeacher = { teacherName: '교사A', slots: {
    '월_1': { subjectName: '수학', classCode: '11', deptName: '전기과' },
    '화_2': { subjectName: '영어', classCode: '12', deptName: '전기과' },
  } };
  assert.equal(getEffectiveTeacherSlot(undefined, '2026-10-05', 1, '월', []).hasClass, false);
  assert.equal(getEffectiveTeacherSlot(timetableTeacher, '2026-10-05', 1, '월', []).subjectName, '수학');
  assert.equal(getEffectiveTeacherSlot(timetableTeacher, '2026-10-05', 3, '월', []).hasClass, false);
  const config = { specialDaySchedules: [{ date: '2026-10-05', targetDayOfWeek: '화', periodOverrides: { 1: 2 }, shortenedPeriods: 1 }] };
  assert.equal(getEffectiveTeacherSlot(timetableTeacher, '2026-10-05', 1, '월', [], config).subjectName, '영어');
  assert.equal(getEffectiveTeacherSlot(timetableTeacher, '2026-10-05', 2, '월', [], config).hasClass, false);
  const applications = [{ status: 'approved', applicantTeacher: '교사A', items: [{ type: 'substitute', originalTeacher: '교사A', substituteTeacher: '교사B', sourceDate: '2026-10-05', sourcePeriod: 1, subjectName: '수학' }] }];
  assert.equal(getEffectiveTeacherSlot(timetableTeacher, '2026-10-05', 1, '월', applications).hasClass, false);
  assert.equal(getEffectiveTeacherSlot({ teacherName: '교사B', slots: {} }, '2026-10-05', 1, '월', applications).hasClass, true);
  assert.equal(getEffectiveTeacherSlot(timetableTeacher, '2026-10-05', 1, '월', [{ ...applications[0], status: 'rejected' }]).hasClass, true);
  console.log('PASS: regular, remapped, shortened and substitute timetable slots');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
