const {
  supabaseAdmin,
  buildBadRequestError,
  normalizeMobileNumber,
  normalizeAddressWithCoordinates,
  rollbackProvisionedUser,
} = require('./shared');
const {
  toProperCase,
  CLEARANCE_EXPIRY_YEARS,
  normalizeContractDates,
  normalizeSchedule,
  getEmployeeProfileForDeployment,
  getActiveSiteAssignment,
  getLatestContractDocumentUrl,
} = require('./helpers');

async function createEmployee(data, clearancesData, avatarUrl = null, extras = {}) {
  const firstName = toProperCase(data.firstName, 'First name');
  const middleName = data.middleName ? toProperCase(data.middleName, 'Middle name') : null;
  const lastName = toProperCase(data.lastName, 'Last name');
  const suffix = data.suffix ? data.suffix.trim() : null;
  const employmentType = typeof data.employmentType === 'string'
    ? data.employmentType.toLowerCase()
    : 'regular';
  const payFrequency = 'semi_monthly';
  const mobile = normalizeMobileNumber(data.mobile, { required: true, fieldLabel: 'Mobile number' });
  const emergencyContactNumber = normalizeMobileNumber(data.emergencyContact, {
    required: true,
    fieldLabel: 'Emergency contact number',
  });
  const normalizedAddress = normalizeAddressWithCoordinates(
    data.address,
    data.latitude,
    data.longitude,
    {
      addressLabel: 'Residential address',
      requireAddress: true,
      requireCoordinates: true,
    }
  );

  const allowedEmploymentTypes = new Set(['regular', 'reliever']);
  if (!allowedEmploymentTypes.has(employmentType)) {
    throw buildBadRequestError('Invalid employment type.');
  }

  if (data.hireDate && data.dob) {
    const hireDate = new Date(data.hireDate);
    const birthDate = new Date(data.dob);
    if (hireDate < birthDate) {
      throw buildBadRequestError('Hire date cannot be earlier than date of birth.');
    }
  }

  const {
    contractDocUrl,
    contractEndDate,
    deploymentStartDate,
    deploymentEndDate,
    daysOfWeek,
    shiftStart,
    shiftEnd,
    deploymentOrderUrl,
    initialSiteId,
  } = extras;
  if (!contractDocUrl) {
    throw buildBadRequestError('Employee onboarding requires an employment contract document.');
  }

  const startingBaseSalary = initialSiteId && data.basicRate ? parseFloat(data.basicRate) : null;
  const shouldCreateDeployment = !!initialSiteId;
  const shouldCreateContract = true;
  const { contractStartDate, contractEndDate: normalizedContractEndDate } = shouldCreateContract
    ? normalizeContractDates(data.hireDate, contractEndDate, data.hireDate)
    : { contractStartDate: null, contractEndDate: null };
  const { contractStartDate: normalizedDeploymentStartDate, contractEndDate: normalizedDeploymentEndDate } = shouldCreateDeployment
    ? normalizeContractDates(deploymentStartDate, deploymentEndDate, data.hireDate)
    : { contractStartDate: null, contractEndDate: null };
  const normalizedSchedule = shouldCreateDeployment
    ? normalizeSchedule({ daysOfWeek, shiftStart, shiftEnd })
    : null;

  let siteAssignment = null;
  if (shouldCreateDeployment) {
    siteAssignment = await getActiveSiteAssignment(initialSiteId);
  }

  let userId = null;

  try {
    const email = data.email.trim().toLowerCase();
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
        phone_number: mobile,
        avatar_url: avatarUrl,
        role: 'employee',
        status: 'active',
      }]);

    if (profileError) throw profileError;

    const { error: empError } = await supabaseAdmin
      .from('employees')
      .insert([{
        id: userId,
        employee_id_number: data.employeeId,
        position: data.position,
        hire_date: data.hireDate,
        base_salary: startingBaseSalary,
        pay_frequency: payFrequency,
        tin_number: data.tinNumber || null,
        sss_number: data.sssNumber || null,
        philhealth_number: data.philhealthNumber || null,
        pagibig_number: data.pagibigNumber || null,
        date_of_birth: data.dob,
        gender: data.gender,
        civil_status: data.civilStatus,
        height_cm: data.height ? parseFloat(data.height) : null,
        educational_level: data.educationalLevel,
        residential_address: normalizedAddress.address,
        provincial_address: data.provincialAddress || null,
        place_of_birth: data.placeOfBirth || null,
        blood_type: data.bloodType || null,
        citizenship: data.citizenship || 'Filipino',
        badge_number: data.badgeNumber || null,
        license_number: data.licenseNumber || null,
        license_expiry_date: data.licenseExpiryDate || null,
        emergency_contact_name: toProperCase(data.emergencyName, 'Emergency contact name'),
        emergency_contact_number: emergencyContactNumber,
        emergency_contact_relationship: data.emergencyRelationship
          ? toProperCase(data.emergencyRelationship, 'Emergency contact relationship')
          : null,
        employment_type: employmentType,
        latitude: normalizedAddress.latitude,
        longitude: normalizedAddress.longitude,
      }]);

    if (empError) throw empError;

    if (clearancesData && clearancesData.length > 0) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const clearancesToInsert = clearancesData.map((c) => {
        const expiryYears = CLEARANCE_EXPIRY_YEARS[c.type];
        let expiryDate = null;
        if (expiryYears) {
          const expiry = new Date(today);
          expiry.setFullYear(expiry.getFullYear() + expiryYears);
          expiryDate = expiry.toISOString().split('T')[0];
        }

        return {
          employee_id: userId,
          clearance_type: c.type,
          document_url: c.url,
          issue_date: todayStr,
          expiry_date: expiryDate,
          status: 'valid',
        };
      });

      const { error: clearError } = await supabaseAdmin
        .from('clearances')
        .insert(clearancesToInsert);

      if (clearError) throw clearError;
    }

    if (shouldCreateContract) {
      const { error: contractError } = await supabaseAdmin
        .from('employee_contracts')
        .insert([{
          employee_id: userId,
          contract_type: 'employment',
          start_date: contractStartDate,
          end_date: normalizedContractEndDate,
          salary_at_signing: startingBaseSalary,
          rate_per_guard: siteAssignment?.clients?.rate_per_guard ?? null,
          document_url: contractDocUrl || null,
          status: 'active',
        }]);

      if (contractError) throw contractError;
    }

    if (shouldCreateDeployment) {
      const { data: deployment, error: deployError } = await supabaseAdmin
        .from('deployments')
        .insert([{
          employee_id: userId,
          site_id: siteAssignment.id,
          deployment_order_url: deploymentOrderUrl || null,
          start_date: normalizedDeploymentStartDate,
          end_date: normalizedDeploymentEndDate,
          status: 'active',
        }])
        .select('id')
        .single();

      if (deployError) throw deployError;

      const { error: scheduleError } = await supabaseAdmin
        .from('schedules')
        .insert([{
          deployment_id: deployment.id,
          ...normalizedSchedule,
          is_active: true,
        }]);

      if (scheduleError) throw scheduleError;
    }

    return { userId };
  } catch (err) {
    if (userId) {
      await rollbackProvisionedUser(supabaseAdmin, userId, 'createEmployee');
    }
    throw err;
  }
}

async function updateEmployee(id, data, clearances = [], avatarUrl = null, deploymentOrderUrl = null) {
  const profilePatch = {};
  if (data.phone_number !== undefined) {
    profilePatch.phone_number = normalizeMobileNumber(data.phone_number, {
      required: true,
      fieldLabel: 'Phone number',
    });
  }
  if (data.contact_email !== undefined) profilePatch.contact_email = data.contact_email || null;
  if (data.status !== undefined) profilePatch.status = data.status;
  if (avatarUrl) profilePatch.avatar_url = avatarUrl;

  if (Object.keys(profilePatch).length > 0) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profilePatch)
      .eq('id', id);
    if (profileError) throw profileError;
  }

  const empPatch = {};
  if (data.date_of_birth !== undefined) empPatch.date_of_birth = data.date_of_birth || null;
  if (data.gender !== undefined) empPatch.gender = data.gender || null;
  if (data.civil_status !== undefined) empPatch.civil_status = data.civil_status || null;
  if (data.height_cm !== undefined) empPatch.height_cm = data.height_cm ? parseFloat(data.height_cm) : null;
  if (data.educational_level !== undefined) empPatch.educational_level = data.educational_level || null;
  if (data.provincial_address !== undefined) empPatch.provincial_address = data.provincial_address || null;
  if (data.place_of_birth !== undefined) empPatch.place_of_birth = data.place_of_birth || null;
  if (data.blood_type !== undefined) empPatch.blood_type = data.blood_type || null;
  if (data.badge_number !== undefined) empPatch.badge_number = data.badge_number || null;
  if (data.license_number !== undefined) empPatch.license_number = data.license_number || null;
  if (data.license_expiry_date !== undefined) empPatch.license_expiry_date = data.license_expiry_date || null;
  if (data.residential_address !== undefined || data.latitude !== undefined || data.longitude !== undefined) {
    const normalizedAddress = normalizeAddressWithCoordinates(
      data.residential_address,
      data.latitude,
      data.longitude,
      {
        addressLabel: 'Residential address',
        requireAddress: false,
        requireCoordinates: false,
      }
    );
    empPatch.residential_address = normalizedAddress.address;
    empPatch.latitude = normalizedAddress.latitude;
    empPatch.longitude = normalizedAddress.longitude;
  }
  if (data.emergency_contact_name !== undefined) {
    const name = (data.emergency_contact_name || '').trim();
    empPatch.emergency_contact_name = name
      ? name.replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
  }
  if (data.emergency_contact_number !== undefined) {
    empPatch.emergency_contact_number = normalizeMobileNumber(data.emergency_contact_number, {
      required: false,
      fieldLabel: 'Emergency contact number',
    });
  }
  if (data.emergency_contact_relationship !== undefined) {
    const relationship = (data.emergency_contact_relationship || '').trim();
    empPatch.emergency_contact_relationship = relationship
      ? relationship.replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
  }
  if (data.position !== undefined) empPatch.position = data.position || null;
  if (data.employment_type !== undefined) empPatch.employment_type = (data.employment_type || '').toLowerCase() || null;
  if (Object.keys(empPatch).length > 0) {
    const { error: empError } = await supabaseAdmin
      .from('employees')
      .update(empPatch)
      .eq('id', id);
    if (empError) throw empError;
  }

  if (clearances.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const upsertRows = clearances.map((c) => ({
      employee_id: id,
      clearance_type: c.type,
      document_url: c.url,
      issue_date: today,
      status: 'valid',
    }));

    const { error: clearError } = await supabaseAdmin
      .from('clearances')
      .upsert(upsertRows, { onConflict: 'employee_id,clearance_type' });

    if (clearError) throw clearError;
  }

  if (deploymentOrderUrl) {
    const { data: activeDeployment, error: deploymentError } = await supabaseAdmin
      .from('deployments')
      .select('id')
      .eq('employee_id', id)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (deploymentError) throw deploymentError;
    if (!activeDeployment) {
      throw buildBadRequestError('An active deployment is required before uploading a deployment order.');
    }

    const { error: updateDeploymentError } = await supabaseAdmin
      .from('deployments')
      .update({ deployment_order_url: deploymentOrderUrl })
      .eq('id', activeDeployment.id);

    if (updateDeploymentError) throw updateDeploymentError;
  }

  return { success: true };
}

async function deployEmployee(employeeId, {
  siteId,
  ratePerGuard,
  baseSalary,
  contractStartDate,
  contractEndDate,
  daysOfWeek,
  shiftStart,
  shiftEnd,
  contractDocUrl,
  deploymentOrderUrl,
}) {
  const employeeProfile = await getEmployeeProfileForDeployment(employeeId);
  const siteAssignment = await getActiveSiteAssignment(siteId);
  const normalizedRatePerGuard = ratePerGuard ?? siteAssignment.clients?.rate_per_guard ?? null;
  const parsedBaseSalary = baseSalary === undefined || baseSalary === null || baseSalary === ''
    ? employeeProfile.base_salary
    : Number(baseSalary);
  const {
    contractStartDate: normalizedContractStartDate,
    contractEndDate: normalizedContractEndDate,
  } = normalizeContractDates(contractStartDate, contractEndDate);
  const normalizedSchedule = normalizeSchedule({ daysOfWeek, shiftStart, shiftEnd });
  const effectiveContractDocUrl = contractDocUrl || await getLatestContractDocumentUrl(employeeId);

  if (parsedBaseSalary !== null && Number.isNaN(parsedBaseSalary)) {
    throw buildBadRequestError('Base salary must be a valid number.');
  }

  if (!effectiveContractDocUrl) {
    throw buildBadRequestError('Employee must have an employment contract on file before deployment.');
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

  const { data: contract, error: contractError } = await supabaseAdmin
    .from('employee_contracts')
    .insert([{
      employee_id: employeeId,
      contract_type: 'employment',
      rate_per_guard: normalizedRatePerGuard,
      salary_at_signing: parsedBaseSalary,
      start_date: normalizedContractStartDate,
      end_date: normalizedContractEndDate,
      document_url: effectiveContractDocUrl,
      status: 'active',
    }])
    .select('id')
    .single();

  if (contractError) {
    if (shouldUpdateBaseSalary) {
      await supabaseAdmin
        .from('employees')
        .update({ base_salary: employeeProfile.base_salary })
        .eq('id', employeeId);
    }
    throw contractError;
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
    await supabaseAdmin
      .from('employee_contracts')
      .delete()
      .eq('id', contract.id);
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
    await supabaseAdmin
      .from('employee_contracts')
      .delete()
      .eq('id', contract.id);
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
    contract_id: contract.id,
    schedule_id: schedule.id,
    base_salary: parsedBaseSalary,
    previous_base_salary: employeeProfile.base_salary,
  };
}

function subtractOneDay(dateString) {
  const date = new Date(dateString);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

function getClosureEndDate(currentStartDate, nextStartDate) {
  if (!nextStartDate) return currentStartDate || null;

  const candidateEndDate = subtractOneDay(nextStartDate);
  if (!currentStartDate) return candidateEndDate;

  return new Date(candidateEndDate) < new Date(currentStartDate)
    ? currentStartDate
    : candidateEndDate;
}

async function transferEmployeeAssignment(employeeId, {
  siteId,
  ratePerGuard,
  contractStartDate,
  contractEndDate,
  daysOfWeek,
  shiftStart,
  shiftEnd,
  contractDocUrl,
  deploymentOrderUrl,
}) {
  const employeeProfile = await getEmployeeProfileForDeployment(employeeId);
  const siteAssignment = await getActiveSiteAssignment(siteId);
  const normalizedRatePerGuard = ratePerGuard ?? siteAssignment.clients?.rate_per_guard ?? null;
  const {
    contractStartDate: normalizedContractStartDate,
    contractEndDate: normalizedContractEndDate,
  } = normalizeContractDates(contractStartDate, contractEndDate);
  const normalizedSchedule = normalizeSchedule({ daysOfWeek, shiftStart, shiftEnd });
  const effectiveContractDocUrl = contractDocUrl || await getLatestContractDocumentUrl(employeeId);

  if (!effectiveContractDocUrl) {
    throw buildBadRequestError('Employee must have an employment contract on file before transfer.');
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

  const { data: activeContracts, error: activeContractError } = await supabaseAdmin
    .from('employee_contracts')
    .select('id, start_date')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .order('start_date', { ascending: false });

  if (activeContractError) throw activeContractError;

  const currentContract = activeContracts?.[0] || null;
  const closureEndDate = getClosureEndDate(currentDeployment.start_date, normalizedContractStartDate);
  const contractClosureEndDate = currentContract
    ? getClosureEndDate(currentContract.start_date, normalizedContractStartDate)
    : null;

  const { data: newContract, error: contractError } = await supabaseAdmin
    .from('employee_contracts')
    .insert([{
      employee_id: employeeId,
      contract_type: 'employment',
      rate_per_guard: normalizedRatePerGuard,
      salary_at_signing: employeeProfile.base_salary,
      start_date: normalizedContractStartDate,
      end_date: normalizedContractEndDate,
      document_url: effectiveContractDocUrl,
      status: 'active',
    }])
    .select('id')
    .single();

  if (contractError) throw contractError;

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
    await supabaseAdmin.from('employee_contracts').delete().eq('id', newContract.id);
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
    await supabaseAdmin.from('employee_contracts').delete().eq('id', newContract.id);
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
    await supabaseAdmin.from('employee_contracts').delete().eq('id', newContract.id);
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
    await supabaseAdmin.from('employee_contracts').delete().eq('id', newContract.id);
    throw previousDeploymentError;
  }

  if (currentContract) {
    const { error: previousContractError } = await supabaseAdmin
      .from('employee_contracts')
      .update({
        status: 'inactive',
        end_date: contractClosureEndDate,
      })
      .eq('id', currentContract.id);

    if (previousContractError) {
      await supabaseAdmin
        .from('deployments')
        .update({ status: 'active', end_date: currentDeployment.end_date || null })
        .eq('id', currentDeployment.id);
      await supabaseAdmin
        .from('schedules')
        .update({ is_active: true })
        .eq('deployment_id', currentDeployment.id);
      await supabaseAdmin.from('schedules').delete().eq('id', newSchedule.id);
      await supabaseAdmin.from('deployments').delete().eq('id', newDeployment.id);
      await supabaseAdmin.from('employee_contracts').delete().eq('id', newContract.id);
      throw previousContractError;
    }
  }

  return {
    success: true,
    deployment_id: newDeployment.id,
    transferred_from_deployment_id: currentDeployment.id,
  };
}

function getEffectiveClosureDate(currentStartDate, requestedEndDate = null) {
  const today = new Date().toISOString().split('T')[0];
  const desiredEndDate = requestedEndDate || today;

  if (!currentStartDate) {
    return desiredEndDate;
  }

  return new Date(desiredEndDate) < new Date(currentStartDate)
    ? currentStartDate
    : desiredEndDate;
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

  const { data: activeContracts, error: activeContractError } = await supabaseAdmin
    .from('employee_contracts')
    .select('id, start_date, end_date, status')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .order('start_date', { ascending: false });

  if (activeContractError) throw activeContractError;

  const currentContract = activeContracts?.[0] || null;
  const contractClosureEndDate = currentContract
    ? getEffectiveClosureDate(currentContract.start_date, effectiveReliefDate)
    : null;

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

  if (currentContract) {
    const { error: deactivateContractError } = await supabaseAdmin
      .from('employee_contracts')
      .update({
        status: 'inactive',
        end_date: contractClosureEndDate,
      })
      .eq('id', currentContract.id);

    if (deactivateContractError) {
      await supabaseAdmin
        .from('deployments')
        .update({
          status: 'active',
          end_date: currentDeployment.end_date || null,
        })
        .eq('id', currentDeployment.id);

      if (activeScheduleIds.length > 0) {
        await supabaseAdmin
          .from('schedules')
          .update({ is_active: true })
          .in('id', activeScheduleIds);
      }

      throw deactivateContractError;
    }
  }

  return {
    success: true,
    employee_id: employeeProfile.id,
    relieved_from_deployment_id: currentDeployment.id,
  };
}

module.exports = {
  createEmployee,
  updateEmployee,
  deployEmployee,
  transferEmployeeAssignment,
  relieveEmployeeAssignment,
};
