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
  const firstName = toProperCase(data.firstName);
  const middleName = data.middleName ? toProperCase(data.middleName) : null;
  const lastName = toProperCase(data.lastName);
  const suffix = data.suffix ? data.suffix.trim() : null;
  const employmentType = (data.employmentType || 'regular').toLowerCase();
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

  let siteAssignment = null;
  if (shouldCreateDeployment) {
    siteAssignment = await getActiveSiteAssignment(initialSiteId);
  }

  let userId = null;

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { redirectTo: 'http://localhost:5173/set-password' }
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
        contact_email: data.email,
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
        emergency_contact_name: toProperCase(data.emergencyName),
        emergency_contact_number: emergencyContactNumber,
        emergency_contact_relationship: data.emergencyRelationship ? toProperCase(data.emergencyRelationship) : null,
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
      const { error: deployError } = await supabaseAdmin
        .from('deployments')
        .insert([{
          employee_id: userId,
          site_id: siteAssignment.id,
          deployment_order_url: deploymentOrderUrl || null,
          start_date: contractStartDate,
          end_date: normalizedContractEndDate,
          status: 'active',
        }]);

      if (deployError) throw deployError;
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

  const { data: contract, error: contractError } = await supabaseAdmin
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
    throw depError;
  }

  const { error: scheduleError } = await supabaseAdmin
    .from('schedules')
    .insert([{
      deployment_id: deployment.id,
      ...normalizedSchedule,
      is_active: true,
    }]);

  if (scheduleError) {
    await supabaseAdmin
      .from('deployments')
      .delete()
      .eq('id', deployment.id);
    await supabaseAdmin
      .from('employee_contracts')
      .delete()
      .eq('id', contract.id);
    throw scheduleError;
  }

  return { success: true, deployment_id: deployment.id };
}

module.exports = {
  createEmployee,
  updateEmployee,
  deployEmployee,
};
