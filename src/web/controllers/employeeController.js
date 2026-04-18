const employeeService = require('../services/employeeService');
const { formatPaginatedResponse } = require('../utils/pagination');

/**
 * GET /api/web/employees
 */
async function getAllEmployees(req, res) {
  try {
    const { page, limit } = req.pagination;
    
    const { employees, totalCount } = await employeeService.getAllEmployees(page, limit);
    
    return res.json(formatPaginatedResponse(employees, totalCount, page, limit));
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/web/employees/:id
 */
async function getEmployeeDetails(req, res) {
  try {
    const { id } = req.params;
    const employeeDetails = await employeeService.getEmployeeDetails(id);
    return res.json(employeeDetails);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = {
  getAllEmployees,
  getEmployeeDetails
};
