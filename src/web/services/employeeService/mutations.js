const {
  supabaseAdmin,
  buildBadRequestError,
  normalizeMobileNumber,
  normalizeAddressWithCoordinates,
  rollbackProvisionedUser,
} = require('./shared');
const { sendInviteEmail } = require('@services/inviteService');
const {
  normalizeEmailAddress,
  mapEmailConflictError,
  restoreAuthEmail,
  restoreProfileState,
  updateAccountProfileAndAuthEmail,
} = require('../shared/accountIdentity');
const {
  toProperCase,
  CLEARANCE_EXPIRY_YEARS,
  normalizeDateRange,
  validateDateIsTodayOrLater,
  normalizeSchedule,
  getTodayDateString,
  getEmployeeProfileForDeployment,
  getActiveSiteAssignment,
  getEmploymentContractState,
  getActiveEmploymentContracts,
  getValidActiveEmploymentContract,
  closeEmploymentContracts,
} = require('./helpers');

async function assertEmployeeCreateAvailable(data) {
  const email = normalizeEmailAddress(data.email);
  const employeeId = typeof data.employeeId === 'string'
    ? data.employeeId.trim()
    : data.employeeId;

  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('contact_email', email)
    .limit(1)
    .maybeSingle();

  if (profileLookupError) throw profileLookupError;

  if (existingProfile) {
    throw buildBadRequestError('Email address is already in use.');
  }

  if (employeeId) {
    const { data: existingEmployee, error: employeeLookupError } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('employee_id_number', employeeId)
      .limit(1)
      .maybeSingle();

    if (employeeLookupError) throw employeeLookupError;

    if (existingEmployee) {
      throw buildBadRequestError('Employee ID is already in use.');
    }
  }
}

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
    actorUserId,
  } = extras;
  if (!contractDocUrl) {
    throw buildBadRequestError('Employee onboarding requires an employment contract document.');
  }

  const startingBaseSalary = initialSiteId && data.basicRate ? parseFloat(data.basicRate) : null;
  const shouldCreateDeployment = !!initialSiteId;
  const shouldCreateContract = true;
  const { contractStartDate, contractEndDate: normalizedContractEndDate } = shouldCreateContract
    ? normalizeDateRange(data.hireDate, contractEndDate, {
      startLabel: 'Employment contract start date',
      endLabel: 'Employment contract end date',
      fallbackStartDate: data.hireDate,
    })
    : { contractStartDate: null, contractEndDate: null };
  const { contractStartDate: normalizedDeploymentStartDate, contractEndDate: normalizedDeploymentEndDate } = shouldCreateDeployment
    ? normalizeDateRange(deploymentStartDate, deploymentEndDate, {
      startLabel: 'Deployment start date',
      endLabel: 'Deployment end date',
      fallbackStartDate: data.hireDate,
    })
    : { contractStartDate: null, contractEndDate: null };
  const normalizedSchedule = shouldCreateDeployment
    ? normalizeSchedule({ daysOfWeek, shiftStart, shiftEnd })
    : null;
  const normalizedLicenseExpiryDate = validateDateIsTodayOrLater(
    data.licenseExpiryDate || null,
    'License expiry date'
  );

  let siteAssignment = null;
  if (shouldCreateDeployment) {
    siteAssignment = await getActiveSiteAssignment(initialSiteId);
  }

  let userId = null;

  try {
    const email = normalizeEmailAddress(data.email);
    const { data: authData, error: authError } = await sendInviteEmail(email, actorUserId);

    if (authError) throw mapEmailConflictError(authError);
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

    if (profileError) throw mapEmailConflictError(profileError);

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
        license_expiry_date: normalizedLicenseExpiryDate,
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

async function getExistingEmployeeForUpdate(id) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      role,
      first_name,
      middle_name,
      last_name,
      suffix,
      contact_email,
      phone_number,
      status,
      avatar_url,
      employees (
        date_of_birth,
        gender,
        civil_status,
        height_cm,
        educational_level,
        provincial_address,
        place_of_birth,
        blood_type,
        badge_number,
        license_number,
        license_expiry_date,
        residential_address,
        latitude,
        longitude,
        emergency_contact_name,
        emergency_contact_number,
        emergency_contact_relationship,
        position,
        employment_type
      )
    `)
    .eq('id', id)
    .eq('role', 'employee')
    .maybeSingle();

  if (error) throw error;

  if (!profile) {
    const err = new Error('Employee not found');
    err.status = 404;
    throw err;
  }

  const employee = Array.isArray(profile.employees) ? profile.employees[0] : profile.employees;

  return {
    profile,
    employee: employee || {},
  };
}

function buildProfileRollbackState(existingProfile) {
  return {
    first_name: existingProfile.first_name,
    middle_name: existingProfile.middle_name,
    last_name: existingProfile.last_name,
    suffix: existingProfile.suffix,
    contact_email: existingProfile.contact_email,
    phone_number: existingProfile.phone_number,
    status: existingProfile.status,
    avatar_url: existingProfile.avatar_url,
  };
}

function buildEmployeeRollbackState(existingEmployee) {
  return {
    date_of_birth: existingEmployee.date_of_birth || null,
    gender: existingEmployee.gender || null,
    civil_status: existingEmployee.civil_status || null,
    height_cm: existingEmployee.height_cm ?? null,
    educational_level: existingEmployee.educational_level || null,
    provincial_address: existingEmployee.provincial_address || null,
    place_of_birth: existingEmployee.place_of_birth || null,
    blood_type: existingEmployee.blood_type || null,
    badge_number: existingEmployee.badge_number || null,
    license_number: existingEmployee.license_number || null,
    license_expiry_date: existingEmployee.license_expiry_date || null,
    residential_address: existingEmployee.residential_address || null,
    latitude: existingEmployee.latitude ?? null,
    longitude: existingEmployee.longitude ?? null,
    emergency_contact_name: existingEmployee.emergency_contact_name || null,
    emergency_contact_number: existingEmployee.emergency_contact_number || null,
    emergency_contact_relationship: existingEmployee.emergency_contact_relationship || null,
    position: existingEmployee.position || null,
    employment_type: existingEmployee.employment_type || null,
  };
}

async function renewEmploymentContract(employeeId, {
  contractDocUrl,
  renewalStartDate,
  renewalEndDate,
}) {
  if (!contractDocUrl && renewalStartDate === undefined && renewalEndDate === undefined) {
    return { renewed: false };
  }

  if (!contractDocUrl) {
    throw buildBadRequestError('Employee contract renewal requires a replacement contract document.');
  }

  if (!renewalStartDate || !renewalEndDate) {
    throw buildBadRequestError('Employee contract renewal requires both renewal start and end dates.');
  }

  const { contractStartDate, contractEndDate } = normalizeDateRange(renewalStartDate, renewalEndDate, {
    startLabel: 'Employment contract renewal start date',
    endLabel: 'Employment contract renewal end date',
  });

  const activeContracts = await getActiveEmploymentContracts(employeeId);

  const currentContract = activeContracts?.[0] || null;
  if (currentContract && new Date(contractStartDate) <= new Date(currentContract.start_date)) {
    throw buildBadRequestError('Employment contract renewal start date must be later than the current contract start date.');
  }

  const contractInsert = {
    employee_id: employeeId,
    contract_type: 'employment',
    start_date: contractStartDate,
    end_date: contractEndDate,
    document_url: contractDocUrl,
    status: 'active',
  };

  const { data: newContract, error: newContractError } = await supabaseAdmin
    .from('employee_contracts')
    .insert([contractInsert])
    .select('id')
    .single();

  if (newContractError) throw newContractError;

  const previousContracts = activeContracts.filter((contract) => contract.id !== newContract.id);
  if (previousContracts.length === 0) {
    return { renewed: true, contractId: newContract.id };
  }

  try {
    await closeEmploymentContracts(previousContracts, (contract) => (
      getClosureEndDate(contract.start_date, contractStartDate)
    ));
  } catch (closeContractError) {
    await supabaseAdmin.from('employee_contracts').delete().eq('id', newContract.id);
    throw closeContractError;
  }

  return {
    renewed: true,
    contractId: newContract.id,
    previousContractId: currentContract.id,
    previousContractIds: previousContracts.map((contract) => contract.id),
  };
}

async function updateEmployee(id, data, clearances = [], avatarUrl = null, deploymentOrderUrl = null, contractDocUrl = null) {
  const { profile: existingProfile, employee: existingEmployee } = await getExistingEmployeeForUpdate(id);
  const previousProfileState = buildProfileRollbackState(existingProfile);
  const previousEmployeeState = buildEmployeeRollbackState(existingEmployee);
  const profilePatch = {};
  if (data.phone_number !== undefined) {
    profilePatch.phone_number = normalizeMobileNumber(data.phone_number, {
      required: true,
      fieldLabel: 'Phone number',
    });
  }
  if (data.contact_email !== undefined) {
    profilePatch.contact_email = normalizeEmailAddress(data.contact_email);
  }
  if (data.status !== undefined) profilePatch.status = data.status;
  if (avatarUrl) profilePatch.avatar_url = avatarUrl;

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
  if (data.license_expiry_date !== undefined) {
    empPatch.license_expiry_date = validateDateIsTodayOrLater(
      data.license_expiry_date || null,
      'License expiry date'
    );
  }
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

  let profileUpdated = false;
  let employeeUpdated = false;
  let emailChanged = false;

  try {
    if (Object.keys(profilePatch).length > 0) {
      const profileResult = await updateAccountProfileAndAuthEmail({
        userId: id,
        role: 'employee',
        profilePatch,
        previousProfileState,
      });
      profileUpdated = profileResult.profileUpdated;
      emailChanged = profileResult.emailChanged;
    }

    if (Object.keys(empPatch).length > 0) {
      const { error: empError } = await supabaseAdmin
        .from('employees')
        .update(empPatch)
        .eq('id', id);
      if (empError) throw empError;
      employeeUpdated = true;
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

    const contractRenewalResult = await renewEmploymentContract(id, {
      contractDocUrl,
      renewalStartDate: data.contract_start_date,
      renewalEndDate: data.contract_end_date,
    });

    return { success: true, contractRenewalResult };
  } catch (error) {
    if (employeeUpdated) {
      await supabaseAdmin
        .from('employees')
        .update(previousEmployeeState)
        .eq('id', id);
    }

    if (profileUpdated) {
      await restoreProfileState(id, 'employee', previousProfileState);
      if (emailChanged) {
        await restoreAuthEmail(id, previousProfileState.contact_email);
      }
    }

    throw error;
  }
}

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
  let closedContracts = [];

  try {
    closedContracts = await closeEmploymentContracts(activeContracts, (contract) => (
      getEffectiveClosureDate(contract.start_date, deactivationDate)
    ));
  } catch (contractError) {
    throw contractError;
  }

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
  }
}

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
  assertEmployeeCreateAvailable,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  deployEmployee,
  transferEmployeeAssignment,
  relieveEmployeeAssignment,
};
