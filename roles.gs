// roles.gs — role constants, labels, permission helpers

function Roles_normalize(role) {
  role = String(role || '').trim();
  if (role === 'commander') return 'companyCommander';
  return role;
}

function Roles_label(role) {
  const r = Roles_normalize(role);
  const map = {
    admin: 'סגל',
    unitCommander: 'מגד',
    companyCommander: 'מפקצ',
    departmentCommander: 'ממ',
    tutor: 'חונך',
    trainee: 'חניך'
  };
  return map[r] || r;
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
  const r = Roles_normalize(role);
  return ['unitCommander', 'companyCommander', 'departmentCommander', 'tutor'].indexOf(r) !== -1;
}

function Roles_canSeeAllExercises(role) {
  return Roles_isAdmin(role) || Roles_isUnitCommander(role);
}

function Roles_isTeamCommanderRole(role) {
  return Roles_isCompanyCommander(role);
}
