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

module.exports = {
  getClosureEndDate,
  getEffectiveClosureDate,
};
