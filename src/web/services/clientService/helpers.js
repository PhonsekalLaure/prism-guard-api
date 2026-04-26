const {
  buildBadRequestError,
  normalizeAddressWithCoordinates,
} = require('./shared');

function toProperCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
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
  getClientInitials,
  normalizeClientSites,
};
