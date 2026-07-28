// roles.gs — role constants, labels, permission helpers

function Roles_normalize(role) {
  role = String(role || '').trim();
  if (role === 'commander') return 'companyCommander';
  return role;
}

function Roles_label(role) {
  const r = Roles_normalize(role);
  const map = {
    admin: 'אגמ מלפק',
    unitCommander: 'מגד',
    companyCommander: 'מפקצ',
    departmentCommander: 'ממ',
    tutor: 'חונך',
    trainee: 'חניך'
  };
  return map[r] || 'משתמש';
}

/** המרה מתפקיד בעברית / באנגלית לקוד מערכת */
function Roles_fromImport(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'trainee';
  const lower = s.toLowerCase();
  const byCode = {
    admin: 'admin',
    unitcommander: 'unitCommander',
    companycommander: 'companyCommander',
    departmentcommander: 'departmentCommander',
    tutor: 'tutor',
    trainee: 'trainee',
    commander: 'companyCommander'
  };
  if (byCode[lower]) return byCode[lower];
  const byHe = {
    'אגמ מלפק': 'admin',
    'אג״מ מלפק': 'admin',
    'מגד': 'unitCommander',
    'מפקצ': 'companyCommander',
    'מפקד צוות': 'companyCommander',
    'ממ': 'departmentCommander',
    'חונך': 'tutor',
    'חניך': 'trainee',
    'מפ': 'trainee'
  };
  if (byHe[s]) return byHe[s];
  return Roles_isValid(s) ? Roles_normalize(s) : 'trainee';
}

function Roles_allValid() {
  return ['admin', 'unitCommander', 'companyCommander', 'departmentCommander', 'tutor', 'trainee', 'commander'];
}

function Roles_selectOptions() {
  return ['trainee', 'tutor', 'departmentCommander', 'companyCommander', 'unitCommander', 'admin']
    .map(function(code) { return [code, Roles_label(code)]; });
}

function Roles_badgeType(role) {
  const r = Roles_normalize(role);
  if (r === 'admin' || r === 'unitCommander') return 'green';
  if (r === 'companyCommander' || r === 'departmentCommander') return 'blue';
  if (r === 'tutor') return 'yellow';
  return 'muted';
}

function Roles_isValid(role) {
  return Roles_allValid().indexOf(String(role || '').trim()) !== -1;
}

function Roles_isTrainee(role) { return Roles_normalize(role) === 'trainee'; }
function Roles_isAdmin(role) { return Roles_normalize(role) === 'admin'; }
function Roles_isUnitCommander(role) { return Roles_normalize(role) === 'unitCommander'; }
function Roles_isCompanyCommander(role) { return Roles_normalize(role) === 'companyCommander'; }
function Roles_isDepartmentCommander(role) { return Roles_normalize(role) === 'departmentCommander'; }
function Roles_isTutor(role) { return Roles_normalize(role) === 'tutor'; }

function Roles_hasAdminAccess(role) {
  return Roles_isAdmin(role);
}

function Roles_hasTimelineAccess(role) {
  // כל ישות מחוברת יכולה לצפות בציר הזמן (עריכה נשארת לסגל)
  return !!Roles_normalize(role);
}

function Roles_canSeeAllExercises(role) {
  // כל ישות במערכת יכולה לצפות בכל התרגילים והשיבוצים
  return !!Roles_normalize(role);
}

function Roles_isTeamCommanderRole(role) {
  return Roles_isCompanyCommander(role);
}
