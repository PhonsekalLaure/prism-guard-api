const {
  supabaseAdmin,
  buildBadRequestError,
} = require('./shared');
const {
  getTodayDateString,
  getEmployeeProfileForDeployment,
  getActiveEmploymentContracts,
  closeEmploymentContracts,
} = require('./helpers');
const { getEffectiveClosureDate } = require('./mutationDates');

async function getEmployeeForStatusChange(employeeId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, role, status')
    .eq('id', employeeId)
    .eq('role', 'employee')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const err = new Error('Employee not found');
    err.status = 404;
    throw err;
  }

  return data;
}

async function hasActiveEmployeeDeployment(employeeId) {
  const { data, error } = await supabaseAdmin
    .from('deployments')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data?.id);
}

async function deactivateEmployee(employeeId) {
  const employeeProfile = await getEmployeeForStatusChange(employeeId);

  if (employeeProfile.status === 'inactive') {
    throw buildBadRequestError('Employee is already inactive.');
  }

  if (await hasActiveEmployeeDeployment(employeeId)) {
    throw buildBadRequestError('Relieve the employee from their current assignment before deactivating them.');
  }

  const deletedAt = new Date().toISOString();
  const deactivationDate = getTodayDateString();
  const activeContracts = await getActiveEmploymentContracts(employeeId);
  const closedContracts = await closeEmploymentContracts(activeContracts, (contract) => (
    getEffectiveClosureDate(contract.start_date, deactivationDate)
  ));

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      status: 'inactive',
      deleted_at: deletedAt,
    })
    .eq('id', employeeId)
    .eq('role', 'employee');

  if (error) {
    for (const contract of closedContracts) {
      await supabaseAdmin
        .from('employee_contracts')
        .update({
          status: contract.status,
          end_date: contract.end_date,
        })
        .eq('id', contract.id);
    }
    throw error;
  }

  return {
    success: true,
    employee_id: employeeId,
    status: 'inactive',
    deleted_at: deletedAt,
    closed_contract_ids: closedContracts.map((contract) => contract.id),
  };
}

async function relieveEmployeeAssignment(employeeId, { reliefDate } = {}) {
  const employeeProfile = await getEmployeeProfileForDeployment(employeeId);
  const effectiveReliefDate = reliefDate || new Date().toISOString().split('T')[0];

  const { data: activeDeployments, error: activeDeploymentError } = await supabaseAdmin
    .from('deployments')
    .select('id, site_id, start_date, end_date')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .order('start_date', { ascending: false });

  if (activeDeploymentError) throw activeDeploymentError;
  if (!activeDeployments || activeDeployments.length === 0) {
    throw buildBadRequestError('Employee does not have an active deployment to relieve.');
  }

  const currentDeployment = activeDeployments[0];
  const deploymentClosureEndDate = getEffectiveClosureDate(currentDeployment.start_date, effectiveReliefDate);

  const { data: activeSchedules, error: activeScheduleError } = await supabaseAdmin
    .from('schedules')
    .select('id, is_active')
    .eq('deployment_id', currentDeployment.id)
    .eq('is_active', true);

  if (activeScheduleError) throw activeScheduleError;

  const activeScheduleIds = (activeSchedules || []).map((schedule) => schedule.id);

  if (activeScheduleIds.length > 0) {
    const { error: deactivateScheduleError } = await supabaseAdmin
      .from('schedules')
      .update({ is_active: false })
      .in('id', activeScheduleIds);

    if (deactivateScheduleError) throw deactivateScheduleError;
  }

  const { error: deactivateDeploymentError } = await supabaseAdmin
    .from('deployments')
    .update({
      status: 'inactive',
      end_date: deploymentClosureEndDate,
    })
    .eq('id', currentDeployment.id);

  if (deactivateDeploymentError) {
    if (activeScheduleIds.length > 0) {
      await supabaseAdmin
        .from('schedules')
        .update({ is_active: true })
        .in('id', activeScheduleIds);
    }
    throw deactivateDeploymentError;
  }

  return {
    success: true,
    employee_id: employeeProfile.id,
    relieved_from_deployment_id: currentDeployment.id,
  };
}

module.exports = {
  deactivateEmployee,
  relieveEmployeeAssignment,
};
