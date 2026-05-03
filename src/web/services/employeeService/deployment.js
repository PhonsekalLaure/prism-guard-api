const {
  supabaseAdmin,
  buildBadRequestError,
} = require('./shared');
const {
  normalizeDateRange,
  normalizeSchedule,
  getEmployeeProfileForDeployment,
  getActiveSiteAssignment,
  getEmploymentContractState,
  getActiveEmploymentContracts,
  getValidActiveEmploymentContract,
} = require('./helpers');
const { getClosureEndDate } = require('./mutationDates');

async function deployEmployee(employeeId, {
  siteId,
  baseSalary,
  contractStartDate,
  contractEndDate,
  daysOfWeek,
  shiftStart,
  shiftEnd,
  deploymentOrderUrl,
}) {
  const employeeProfile = await getEmployeeProfileForDeployment(employeeId);
  const siteAssignment = await getActiveSiteAssignment(siteId);
  const parsedBaseSalary = baseSalary === undefined || baseSalary === null || baseSalary === ''
    ? employeeProfile.base_salary
    : Number(baseSalary);
  const {
    contractStartDate: normalizedContractStartDate,
    contractEndDate: normalizedContractEndDate,
  } = normalizeDateRange(contractStartDate, contractEndDate, {
    startLabel: 'Deployment contract start date',
    endLabel: 'Deployment contract end date',
  });
  const normalizedSchedule = normalizeSchedule({ daysOfWeek, shiftStart, shiftEnd });
  const validEmploymentContract = await getValidActiveEmploymentContract(employeeId);

  if (parsedBaseSalary !== null && Number.isNaN(parsedBaseSalary)) {
    throw buildBadRequestError('Base salary must be a valid number.');
  }

  if (!validEmploymentContract) {
    const currentContract = (await getActiveEmploymentContracts(employeeId))[0] || null;
    const contractState = getEmploymentContractState(currentContract);
    throw buildBadRequestError(contractState.message || 'Employee must have a valid active employment contract before deployment.');
  }

  const { data: existing } = await supabaseAdmin
    .from('deployments')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('status', 'active');

  if (existing && existing.length > 0) {
    throw buildBadRequestError('Employee is already actively deployed to a site.');
  }

  const shouldUpdateBaseSalary = parsedBaseSalary !== employeeProfile.base_salary;
  if (shouldUpdateBaseSalary) {
    const { error: salaryUpdateError } = await supabaseAdmin
      .from('employees')
      .update({ base_salary: parsedBaseSalary })
      .eq('id', employeeId);

    if (salaryUpdateError) throw salaryUpdateError;
  }

  const { data: deployment, error: depError } = await supabaseAdmin
    .from('deployments')
    .insert([{
      employee_id: employeeId,
      site_id: siteAssignment.id,
      deployment_order_url: deploymentOrderUrl || null,
      start_date: normalizedContractStartDate,
      end_date: normalizedContractEndDate,
      status: 'active',
    }])
    .select('id')
    .single();

  if (depError) {
    if (shouldUpdateBaseSalary) {
      await supabaseAdmin
        .from('employees')
        .update({ base_salary: employeeProfile.base_salary })
        .eq('id', employeeId);
    }
    throw depError;
  }

  const { data: schedule, error: scheduleError } = await supabaseAdmin
    .from('schedules')
    .insert([{
      deployment_id: deployment.id,
      ...normalizedSchedule,
      is_active: true,
    }])
    .select('id')
    .single();

  if (scheduleError) {
    await supabaseAdmin
      .from('deployments')
      .delete()
      .eq('id', deployment.id);
    if (shouldUpdateBaseSalary) {
      await supabaseAdmin
        .from('employees')
        .update({ base_salary: employeeProfile.base_salary })
        .eq('id', employeeId);
    }
    throw scheduleError;
  }

  return {
    success: true,
    deployment_id: deployment.id,
    schedule_id: schedule.id,
    base_salary: parsedBaseSalary,
    previous_base_salary: employeeProfile.base_salary,
    employment_contract_id: validEmploymentContract.id,
  };
}

async function transferEmployeeAssignment(employeeId, {
  siteId,
  baseSalary,
  contractStartDate,
  contractEndDate,
  daysOfWeek,
  shiftStart,
  shiftEnd,
  deploymentOrderUrl,
}) {
  const employeeProfile = await getEmployeeProfileForDeployment(employeeId);
  const siteAssignment = await getActiveSiteAssignment(siteId);
  const parsedBaseSalary = baseSalary === undefined || baseSalary === null || baseSalary === ''
    ? employeeProfile.base_salary
    : Number(baseSalary);
  const {
    contractStartDate: normalizedContractStartDate,
    contractEndDate: normalizedContractEndDate,
  } = normalizeDateRange(contractStartDate, contractEndDate, {
    startLabel: 'Deployment contract start date',
    endLabel: 'Deployment contract end date',
  });
  const normalizedSchedule = normalizeSchedule({ daysOfWeek, shiftStart, shiftEnd });
  const validEmploymentContract = await getValidActiveEmploymentContract(employeeId);

  if (parsedBaseSalary !== null && Number.isNaN(parsedBaseSalary)) {
    throw buildBadRequestError('Base salary must be a valid number.');
  }

  if (!validEmploymentContract) {
    const currentContract = (await getActiveEmploymentContracts(employeeId))[0] || null;
    const contractState = getEmploymentContractState(currentContract);
    throw buildBadRequestError(contractState.message || 'Employee must have a valid active employment contract before transfer.');
  }

  const { data: activeDeployments, error: activeDeploymentError } = await supabaseAdmin
    .from('deployments')
    .select('id, site_id, start_date, end_date')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .order('start_date', { ascending: false });

  if (activeDeploymentError) throw activeDeploymentError;
  if (!activeDeployments || activeDeployments.length === 0) {
    throw buildBadRequestError('Employee does not have an active deployment to transfer.');
  }

  const currentDeployment = activeDeployments[0];
  if (currentDeployment.site_id === siteAssignment.id) {
    throw buildBadRequestError('Employee is already assigned to the selected site.');
  }

  const closureEndDate = getClosureEndDate(currentDeployment.start_date, normalizedContractStartDate);
  const shouldUpdateBaseSalary = parsedBaseSalary !== employeeProfile.base_salary;
  if (shouldUpdateBaseSalary) {
    const { error: salaryUpdateError } = await supabaseAdmin
      .from('employees')
      .update({ base_salary: parsedBaseSalary })
      .eq('id', employeeId);

    if (salaryUpdateError) throw salaryUpdateError;
  }

  const { data: newDeployment, error: deploymentError } = await supabaseAdmin
    .from('deployments')
    .insert([{
      employee_id: employeeId,
      site_id: siteAssignment.id,
      deployment_order_url: deploymentOrderUrl || null,
      start_date: normalizedContractStartDate,
      end_date: normalizedContractEndDate,
      status: 'active',
    }])
    .select('id')
    .single();

  if (deploymentError) {
    if (shouldUpdateBaseSalary) {
      await supabaseAdmin
        .from('employees')
        .update({ base_salary: employeeProfile.base_salary })
        .eq('id', employeeId);
    }
    throw deploymentError;
  }

  const { data: newSchedule, error: scheduleError } = await supabaseAdmin
    .from('schedules')
    .insert([{
      deployment_id: newDeployment.id,
      ...normalizedSchedule,
      is_active: true,
    }])
    .select('id')
    .single();

  if (scheduleError) {
    await supabaseAdmin.from('deployments').delete().eq('id', newDeployment.id);
    if (shouldUpdateBaseSalary) {
      await supabaseAdmin
        .from('employees')
        .update({ base_salary: employeeProfile.base_salary })
        .eq('id', employeeId);
    }
    throw scheduleError;
  }

  const { error: previousScheduleError } = await supabaseAdmin
    .from('schedules')
    .update({ is_active: false })
    .eq('deployment_id', currentDeployment.id)
    .eq('is_active', true);

  if (previousScheduleError) {
    await supabaseAdmin.from('schedules').delete().eq('id', newSchedule.id);
    await supabaseAdmin.from('deployments').delete().eq('id', newDeployment.id);
    if (shouldUpdateBaseSalary) {
      await supabaseAdmin
        .from('employees')
        .update({ base_salary: employeeProfile.base_salary })
        .eq('id', employeeId);
    }
    throw previousScheduleError;
  }

  const { error: previousDeploymentError } = await supabaseAdmin
    .from('deployments')
    .update({
      status: 'inactive',
      end_date: closureEndDate,
    })
    .eq('id', currentDeployment.id);

  if (previousDeploymentError) {
    await supabaseAdmin
      .from('schedules')
      .update({ is_active: true })
      .eq('deployment_id', currentDeployment.id);
    await supabaseAdmin.from('schedules').delete().eq('id', newSchedule.id);
    await supabaseAdmin.from('deployments').delete().eq('id', newDeployment.id);
    if (shouldUpdateBaseSalary) {
      await supabaseAdmin
        .from('employees')
        .update({ base_salary: employeeProfile.base_salary })
        .eq('id', employeeId);
    }
    throw previousDeploymentError;
  }

  return {
    success: true,
    deployment_id: newDeployment.id,
    transferred_from_deployment_id: currentDeployment.id,
    employment_contract_id: validEmploymentContract.id,
    base_salary: parsedBaseSalary,
    previous_base_salary: employeeProfile.base_salary,
  };
}

module.exports = {
  deployEmployee,
  transferEmployeeAssignment,
};
