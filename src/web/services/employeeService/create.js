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
} = require('../shared/accountIdentity');
const {
  toProperCase,
  CLEARANCE_EXPIRY_YEARS,
  normalizeDateRange,
  validateDateIsTodayOrLater,
  normalizeSchedule,
  getActiveSiteAssignment,
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
  const { contractStartDate, contractEndDate: normalizedContractEndDate } = normalizeDateRange(data.hireDate, contractEndDate, {
    startLabel: 'Employment contract start date',
    endLabel: 'Employment contract end date',
    fallbackStartDate: data.hireDate,
  });
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

    const { error: contractError } = await supabaseAdmin
      .from('employee_contracts')
      .insert([{
        employee_id: userId,
        contract_type: 'employment',
        start_date: contractStartDate,
        end_date: normalizedContractEndDate,
        document_url: contractDocUrl,
        status: 'active',
      }]);

    if (contractError) throw contractError;

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

module.exports = {
  assertEmployeeCreateAvailable,
  createEmployee,
};
