const employeeService = require('../services/employeeService');

/**
 * GET /api/web/employees
 */
async function getAllEmployees(req, res) {
  try {
    const employees = await employeeService.getAllEmployees();
    return res.json(employees);
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
