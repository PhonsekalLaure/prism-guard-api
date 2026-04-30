const { supabaseAdmin } = require('@src/supabaseClient');
const { getAdminPermissions } = require('@utils/adminPermissions');

async function getAllAdmins() {
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
      created_at,
      employees (
        employee_id_number,
        position,
        hire_date
      )
    `)
    .eq('role', 'admin')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  return (data || []).map((profile) => {
    const employee = Array.isArray(profile.employees) ? profile.employees[0] : profile.employees;
    const fullName = [
      profile.first_name,
      profile.middle_name,
      profile.last_name,
      profile.suffix,
    ].filter(Boolean).join(' ');

    return {
      id: profile.id,
      full_name: fullName,
      first_name: profile.first_name,
      middle_name: profile.middle_name,
      last_name: profile.last_name,
      suffix: profile.suffix,
      contact_email: profile.contact_email,
      phone_number: profile.phone_number,
      role: profile.role,
      admin_role: profile.admin_role,
      status: profile.status,
      created_at: profile.created_at,
      employee_id_number: employee?.employee_id_number || null,
      position: employee?.position || null,
      hire_date: employee?.hire_date || null,
      permissions: getAdminPermissions(profile.admin_role),
    };
  });
}

module.exports = {
  getAllAdmins,
};
