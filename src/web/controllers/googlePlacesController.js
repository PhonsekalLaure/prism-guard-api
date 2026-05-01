const googlePlacesService = require('@services/googlePlacesService');

async function autocomplete(req, res) {
  try {
    const result = await googlePlacesService.autocompletePlaces(req.query.q, req.user?.id);
    return res.json(result);
  } catch (error) {
    if (error.status === 429) {
      res.set('Retry-After', String(error.retryAfterSeconds));
    }

    return res.status(error.status || 500).json({
      error: error.message || 'Failed to autocomplete address.',
      code: error.code || 'GOOGLE_AUTOCOMPLETE_FAILED',
      retryAfterSeconds: error.retryAfterSeconds || null,
    });
  }
}

async function placeDetails(req, res) {
  try {
    const result = await googlePlacesService.getPlaceDetails(req.query.placeId, req.user?.id);
    return res.json(result);
  } catch (error) {
    if (error.status === 429) {
      res.set('Retry-After', String(error.retryAfterSeconds));
    }

    return res.status(error.status || 500).json({
      error: error.message || 'Failed to retrieve address details.',
      code: error.code || 'GOOGLE_PLACE_DETAILS_FAILED',
      retryAfterSeconds: error.retryAfterSeconds || null,
    });
  }
}

module.exports = {
  autocomplete,
  placeDetails,
};
