const { supabaseAdmin } = require('@src/supabaseClient');
const {
  buildBadRequestError,
  normalizeMobileNumber,
} = require('@utils/requestValidation');
const { rollbackProvisionedUser } = require('@utils/userProvisioning');
const {
  getAdminPermissions,
  isValidAdminRole,
} = require('@utils/adminPermissions');

function toProperCase(value, fieldLabel) {
  if (!value || typeof value !== 'string') {
    throw buildBadRequestError(`${fieldLabel} is required.`);
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAdminPosition(adminRole) {
  switch (adminRole) {
    case 'president':
      return 'President';
    case 'operations_manager':
      return 'Operations Manager';
    case 'finance_manager':
      return 'Finance Manager';
    case 'secretary':
      return 'Secretary';
    default:
      return 'Administrator';
  }
}

async function getExistingAdminOrThrow(adminId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      first_name,
      middle_name,
      last_name,
      suffix,
      contact_email,
      phone_number,
      role,
      admin_role,
      status,
      deleted_at,
      employees (
        position
      )
    `)
    .eq('id', adminId)
    .eq('role', 'admin')
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  if (!data) {
    const err = new Error('Admin account not found.');
    err.status = 404;
    throw err;
  }

  if (data.deleted_at) {
    const err = new Error('Admin account not found.');
    err.status = 404;
    throw err;
  }

  return data;
}

async function getNextAdminEmployeeId() {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('employee_id_number')
    .like('employee_id_number', 'AD-%')
    .order('employee_id_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  const currentNumber = data?.employee_id_number
    ? Number(String(data.employee_id_number).replace('AD-', ''))
    : 0;

  return `AD-${String(currentNumber + 1).padStart(5, '0')}`;
}

async function createAdmin(data) {
  const adminRole = typeof data.adminRole === 'string' ? data.adminRole.trim() : '';
  if (!isValidAdminRole(adminRole)) {
    throw buildBadRequestError('A valid admin role is required.');
  }

  const firstName = toProperCase(data.firstName, 'First name');
  const lastName = toProperCase(data.lastName, 'Last name');
  const middleName = data.middleName ? toProperCase(data.middleName, 'Middle name') : null;
  const suffix = data.suffix ? String(data.suffix).trim() : null;
  const phoneNumber = normalizeMobileNumber(data.mobile, {
    required: true,
    fieldLabel: 'Mobile number',
  });

  if (!data.email || typeof data.email !== 'string') {
    throw buildBadRequestError('Email address is required.');
  }

  const email = data.email.trim().toLowerCase();
  const employeeIdNumber = await getNextAdminEmployeeId();
  const position = getAdminPosition(adminRole);
  const hireDate = new Date().toISOString().split('T')[0];
  let userId = null;

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: 'http://localhost:5173/set-password',
        data: {
          must_change_password: true,
        }
      }
    );

    if (authError) throw authError;
    userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: userId,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix,
        contact_email: email,
        phone_number: phoneNumber,
        role: 'admin',
        admin_role: adminRole,
        status: 'active',
      }]);

    if (profileError) throw profileError;

    const { error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert([{
        id: userId,
        employee_id_number: employeeIdNumber,
        position,
        hire_date: hireDate,
        base_salary: null,
        pay_frequency: null,
        employment_type: 'regular',
      }]);

    if (employeeError) throw employeeError;

    return {
      userId,
      employee_id_number: employeeIdNumber,
      admin_role: adminRole,
      permissions: getAdminPermissions(adminRole),
    };
  } catch (error) {
    if (userId) {
      await rollbackProvisionedUser(supabaseAdmin, userId, 'createAdmin');
    }
    throw error;
  }
}

async function updateAdmin(adminId, data, actorUserId) {
  if (!adminId) {
    throw buildBadRequestError('Admin ID is required.');
  }

  if (adminId === actorUserId) {
    throw buildBadRequestError('You cannot edit your own admin account from Admin Management.');
  }

  const existingAdmin = await getExistingAdminOrThrow(adminId);
  const currentEmployee = Array.isArray(existingAdmin.employees)
    ? existingAdmin.employees[0]
    : existingAdmin.employees;

  const adminRole = typeof data.adminRole === 'string' ? data.adminRole.trim() : '';
  if (!isValidAdminRole(adminRole)) {
    throw buildBadRequestError('A valid admin role is required.');
  }

  const firstName = toProperCase(data.firstName, 'First name');
  const lastName = toProperCase(data.lastName, 'Last name');
  const middleName = data.middleName ? toProperCase(data.middleName, 'Middle name') : null;
  const suffix = data.suffix ? String(data.suffix).trim() : null;
  const phoneNumber = normalizeMobileNumber(data.mobile, {
    required: true,
    fieldLabel: 'Mobile number',
  });

  if (!data.email || typeof data.email !== 'string') {
    throw buildBadRequestError('Email address is required.');
  }

  const email = data.email.trim().toLowerCase();
  const nextPosition = getAdminPosition(adminRole);
  const previousState = {
    first_name: existingAdmin.first_name,
    middle_name: existingAdmin.middle_name,
    last_name: existingAdmin.last_name,
    suffix: existingAdmin.suffix,
    contact_email: existingAdmin.contact_email,
    phone_number: existingAdmin.phone_number,
    admin_role: existingAdmin.admin_role,
    position: currentEmployee?.position || getAdminPosition(existingAdmin.admin_role),
  };

  const profilePatch = {
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    suffix,
    contact_email: email,
    phone_number: phoneNumber,
    admin_role: adminRole,
  };

  let profileUpdated = false;
  let employeeUpdated = false;

  try {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profilePatch)
      .eq('id', adminId)
      .eq('role', 'admin');

    if (profileError) throw profileError;
    profileUpdated = true;

    const { error: employeeError } = await supabaseAdmin
      .from('employees')
      .update({ position: nextPosition })
      .eq('id', adminId);

    if (employeeError) throw employeeError;
    employeeUpdated = true;

    if (email !== previousState.contact_email) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(adminId, {
        email,
        email_confirm: true,
      });

      if (authError) throw authError;
    }

    return {
      id: adminId,
      admin_role: adminRole,
      permissions: getAdminPermissions(adminRole),
    };
  } catch (error) {
    if (employeeUpdated) {
      await supabaseAdmin
        .from('employees')
        .update({ position: previousState.position })
        .eq('id', adminId);
    }

    if (profileUpdated) {
      await supabaseAdmin
        .from('profiles')
        .update({
          first_name: previousState.first_name,
          middle_name: previousState.middle_name,
          last_name: previousState.last_name,
          suffix: previousState.suffix,
          contact_email: previousState.contact_email,
          phone_number: previousState.phone_number,
          admin_role: previousState.admin_role,
        })
        .eq('id', adminId);
    }

    throw error;
  }
}

async function deleteAdmin(adminId, actorUserId) {
  if (!adminId) {
    throw buildBadRequestError('Admin ID is required.');
  }

  if (adminId === actorUserId) {
    throw buildBadRequestError('You cannot delete your own admin account from Admin Management.');
  }

  await getExistingAdminOrThrow(adminId);

  const deletedAt = new Date().toISOString();

  const { error: profileDeleteError } = await supabaseAdmin
    .from('profiles')
    .update({
      status: 'inactive',
      deleted_at: deletedAt,
    })
    .eq('id', adminId)
    .eq('role', 'admin');

  if (profileDeleteError) {
    const err = new Error(profileDeleteError.message);
    err.status = 500;
    throw err;
  }

  return {
    id: adminId,
    deleted_at: deletedAt,
    status: 'inactive',
  };
}

module.exports = {
  createAdmin,
  updateAdmin,
  deleteAdmin,
};
