const {
  buildBadRequestError,
  normalizeAddressWithCoordinates,
} = require('./shared');

const CLIENT_CONTRACT_EXPIRY_WARNING_DAYS = 30;

function toProperCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
}

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function compareDateOnly(left, right) {
  if (!left || !right) return 0;
  return String(left).localeCompare(String(right));
}

function addDaysToDateString(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function getContractStatus(contractStartDate, contractEndDate) {
  if (!contractStartDate || !contractEndDate) {
    return 'No Contract';
  }

  const now = new Date();
  const start = new Date(contractStartDate);
  const end = new Date(contractEndDate);

  if (now < start) {
    return 'Upcoming';
  }

  if (now > end) {
    return 'Expired';
  }

  return 'Active';
}

function getClientContractState(contractStartDate, contractEndDate, today = getTodayDateString()) {
  if (!contractStartDate || !contractEndDate) {
    return {
      status: 'missing',
      isValid: false,
      needsRenewal: true,
      message: 'No service contract dates are on file. Set contract dates before proceeding.',
    };
  }

  if (compareDateOnly(contractStartDate, today) > 0) {
    return {
      status: 'upcoming',
      isValid: false,
      needsRenewal: false,
      message: 'Service contract is not effective yet.',
    };
  }

  if (compareDateOnly(contractEndDate, today) < 0) {
    return {
      status: 'expired',
      isValid: false,
      needsRenewal: true,
      message: 'Service contract has expired. Renew the contract to continue operations.',
    };
  }

  const warningDate = addDaysToDateString(today, CLIENT_CONTRACT_EXPIRY_WARNING_DAYS);
  if (compareDateOnly(contractEndDate, warningDate) <= 0) {
    return {
      status: 'expiring_soon',
      isValid: true,
      needsRenewal: true,
      message: `Service contract expires on ${contractEndDate}. Renew the contract before it ends.`,
    };
  }

  return {
    status: 'valid',
    isValid: true,
    needsRenewal: false,
    message: null,
  };
}

function getClientInitials(company, firstName, lastName) {
  if (company && company !== 'N/A') {
    return company.split(' ').map((name) => name[0]).join('').substring(0, 2).toUpperCase();
  }

  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

function normalizeClientSites(rawSites) {
  if (!rawSites) return [];
  if (!Array.isArray(rawSites)) {
    throw buildBadRequestError('Sites must be an array.');
  }

  const rows = [];

  rawSites.forEach((site, index) => {
    if (!site || typeof site !== 'object') {
      throw buildBadRequestError(`Site ${index + 1} is invalid.`);
    }

    const siteName = (site.siteName || '').trim();
    const siteAddress = (site.siteAddress || '').trim();
    const hasLatitude = site.latitude !== '' && site.latitude !== null && site.latitude !== undefined;
    const hasLongitude = site.longitude !== '' && site.longitude !== null && site.longitude !== undefined;
    const hasRadius = site.geofenceRadius !== '' && site.geofenceRadius !== null && site.geofenceRadius !== undefined;

    const hasAnyValue = siteName || siteAddress || hasLatitude || hasLongitude || hasRadius;
    if (!hasAnyValue) return;

    if (!siteName || !siteAddress || !hasLatitude || !hasLongitude) {
      throw buildBadRequestError(
        `Site ${index + 1} is incomplete. Site name, address, latitude, and longitude are required.`
      );
    }

    const normalizedAddress = normalizeAddressWithCoordinates(
      siteAddress,
      site.latitude,
      site.longitude,
      {
        addressLabel: `Site ${index + 1} address`,
        requireAddress: true,
        requireCoordinates: true,
      }
    );

    const geofenceRadius = hasRadius ? Number(site.geofenceRadius) : 50;

    if (Number.isNaN(geofenceRadius) || geofenceRadius <= 0) {
      throw buildBadRequestError(`Site ${index + 1} has an invalid geofence radius.`);
    }

    rows.push({
      site_name: siteName,
      site_address: normalizedAddress.address,
      latitude: normalizedAddress.latitude,
      longitude: normalizedAddress.longitude,
      geofence_radius_meters: Math.round(geofenceRadius),
    });
  });

  return rows;
}

module.exports = {
  toProperCase,
  getContractStatus,
  getClientContractState,
  getClientInitials,
  normalizeClientSites,
};
