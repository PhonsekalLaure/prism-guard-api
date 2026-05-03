const {
  supabaseAdmin,
  buildBadRequestError,
  normalizeMobileNumber,
  normalizeAddressWithCoordinates,
} = require('./shared');
const {
  normalizeEmailAddress,
  restoreAuthEmail,
  restoreProfileState,
  updateAccountProfileAndAuthEmail,
} = require('../shared/accountIdentity');
const {
  normalizeDateRange,
  validateDateIsTodayOrLater,
  getActiveEmploymentContracts,
  closeEmploymentContracts,
} = require('./helpers');
const { getClosureEndDate } = require('./mutationDates');

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

module.exports = {
  updateEmployee,
};
