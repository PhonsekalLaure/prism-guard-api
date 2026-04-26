function buildBadRequestError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function normalizeMobileNumber(rawMobile, options = {}) {
  const { required = true, fieldLabel = 'Mobile number' } = options;
  if (rawMobile !== null && rawMobile !== undefined && typeof rawMobile !== 'string' && typeof rawMobile !== 'number') {
    throw buildBadRequestError(`${fieldLabel} must be a text value.`);
  }

  const digits = String(rawMobile || '').replace(/\D/g, '');

  if (!digits) {
    if (required) {
      throw buildBadRequestError(`${fieldLabel} is required.`);
    }
    return null;
  }

  let main = digits;
  if (digits.length === 11 && digits.startsWith('0')) {
    main = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('63')) {
    main = digits.slice(2);
  }

  if (main.length !== 10) {
    throw buildBadRequestError(`${fieldLabel} must contain exactly 10 digits (excluding +63).`);
  }

  return `+63${main}`;
}

function normalizeAddressWithCoordinates(rawAddress, rawLatitude, rawLongitude, options = {}) {
  const {
    addressLabel = 'Address',
    requireAddress = false,
    requireCoordinates = false,
  } = options;

  const address = (rawAddress || '').trim();
  const hasAddress = !!address;
  const hasLatitude = rawLatitude !== '' && rawLatitude !== null && rawLatitude !== undefined;
  const hasLongitude = rawLongitude !== '' && rawLongitude !== null && rawLongitude !== undefined;

  if (requireAddress && !hasAddress) {
    throw buildBadRequestError(`${addressLabel} is required.`);
  }

  if ((hasLatitude && !hasLongitude) || (!hasLatitude && hasLongitude)) {
    throw buildBadRequestError(`${addressLabel} coordinates are incomplete. Latitude and longitude are both required.`);
  }

  if ((hasLatitude || hasLongitude) && !hasAddress) {
    throw buildBadRequestError(`${addressLabel} is required when coordinates are provided.`);
  }

  if (requireCoordinates && hasAddress && (!hasLatitude || !hasLongitude)) {
    throw buildBadRequestError(`${addressLabel} requires latitude and longitude.`);
  }

  let latitude = null;
  let longitude = null;

  if (hasLatitude && hasLongitude) {
    latitude = Number(rawLatitude);
    longitude = Number(rawLongitude);

    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw buildBadRequestError(`${addressLabel} has an invalid latitude.`);
    }

    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw buildBadRequestError(`${addressLabel} has an invalid longitude.`);
    }
  }

  return {
    address: hasAddress ? address : null,
    latitude,
    longitude,
  };
}

module.exports = {
  buildBadRequestError,
  normalizeMobileNumber,
  normalizeAddressWithCoordinates,
};
