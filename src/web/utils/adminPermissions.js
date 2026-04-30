const ADMIN_ROLE_PERMISSIONS = {
  president: [
    'clients.read',
    'clients.write',
    'employees.read',
    'employees.write',
    'profile.self.read',
    'profile.self.write',
    'admins.manage',
  ],
  operations_manager: [
    'clients.read',
    'clients.write',
    'employees.read',
    'employees.write',
    'profile.self.read',
    'profile.self.write',
  ],
  finance_manager: [
    'clients.read',
    'clients.write',
    'employees.read',
    'employees.write',
    'profile.self.read',
    'profile.self.write',
  ],
  secretary: [
    'clients.read',
    'clients.write',
    'employees.read',
    'employees.write',
    'profile.self.read',
    'profile.self.write',
  ],
};

function isValidAdminRole(adminRole) {
  return Object.prototype.hasOwnProperty.call(ADMIN_ROLE_PERMISSIONS, adminRole);
}

function getAdminPermissions(adminRole) {
  if (!isValidAdminRole(adminRole)) {
    return [];
  }

  return [...ADMIN_ROLE_PERMISSIONS[adminRole]];
}

function getProfilePermissions(profile = {}) {
  if (profile.role !== 'admin') {
    return [];
  }

  return getAdminPermissions(profile.admin_role);
}

function assertValidAdminScope(profile = {}) {
  if (profile.role !== 'admin') {
    return;
  }

  if (!isValidAdminRole(profile.admin_role)) {
    const error = new Error('Admin account is missing a valid admin role.');
    error.status = 403;
    throw error;
  }
}

module.exports = {
  ADMIN_ROLE_PERMISSIONS,
  isValidAdminRole,
  getAdminPermissions,
  getProfilePermissions,
  assertValidAdminScope,
};
