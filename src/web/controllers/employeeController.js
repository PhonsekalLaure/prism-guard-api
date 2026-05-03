const employeeService = require('@services/employeeService');
const { formatPaginatedResponse } = require('@utils/pagination');
const {
  trimBodyStrings,
  processEmployeeUploads,
  processDeploymentOrderUpload,
} = require('./employeeController/uploads');

/**
 * GET /api/web/employees
 */
async function getAllEmployees(req, res) {
  try {
    const { page, limit } = req.pagination;
    const filters = req.filters;

    const { employees, totalCount } = await employeeService.getAllEmployees(page, limit, filters);

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
    const employee = await employeeService.getEmployeeDetails(id);
    return res.json(employee);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/web/employees/stats
 */
async function getEmployeeStats(req, res) {
  try {
    const stats = await employeeService.getEmployeeStats();
    return res.json(stats);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/web/employees/deployable
 */
async function getDeployableEmployees(req, res) {
  try {
    const employees = await employeeService.getDeployableEmployees(req.query || {});
    return res.json(employees);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * POST /api/web/employees
 */
async function createEmployee(req, res) {
  try {
    const {
      email,
      firstName,
      lastName,
      mobile,
      address,
      latitude,
      longitude,
      employeeId,
      position,
      hireDate,
    } = req.body;

    if (
      !email || !firstName || !lastName || !mobile ||
      !address || latitude === undefined || longitude === undefined ||
      !employeeId || !position || !hireDate
    ) {
      return res.status(400).json({
        error: 'Missing required fields: email, firstName, lastName, mobile, address, latitude, longitude, employeeId, position, and hireDate are required.'
      });
    }

    const data = trimBodyStrings(req.body);

    await employeeService.assertEmployeeCreateAvailable(data);

    const {
      avatarUrl,
      contractDocUrl,
      deploymentOrderUrl,
      clearancesData,
    } = await processEmployeeUploads(req.files || [], req.user?.id);

    const { userId } = await employeeService.createEmployee(
      data,
      clearancesData,
      avatarUrl,
      {
        contractDocUrl,
        contractEndDate: data.contractEndDate || null,
        deploymentStartDate: data.deploymentStartDate || null,
        deploymentEndDate: data.deploymentEndDate || null,
        daysOfWeek: data.daysOfWeek,
        shiftStart: data.shiftStart || null,
        shiftEnd: data.shiftEnd || null,
        deploymentOrderUrl,
        initialSiteId: data.initialSiteId || null,
        actorUserId: req.user?.id,
      }
    );

    return res.status(201).json({ message: 'Employee created and invited successfully', userId });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to create employee' });
  }
}

/**
 * GET /api/web/employees/next-id
 */
async function getNextEmployeeId(req, res) {
  try {
    const nextId = await employeeService.getNextEmployeeId();
    return res.json({ nextId });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * PATCH /api/web/employees/:id
 */
async function updateEmployee(req, res) {
  try {
    const { id } = req.params;
    const data = trimBodyStrings(req.body);
    const {
      avatarUrl,
      contractDocUrl,
      deploymentOrderUrl,
      clearancesData,
    } = await processEmployeeUploads(req.files || [], req.user?.id);

    await employeeService.updateEmployee(id, data, clearancesData, avatarUrl, deploymentOrderUrl, contractDocUrl);

    return res.json({ message: 'Employee updated successfully' });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to update employee' });
  }
}

async function deactivateEmployee(req, res) {
  try {
    const { id } = req.params;
    const result = await employeeService.deactivateEmployee(id);
    return res.json({ message: 'Employee deactivated successfully', data: result });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to deactivate employee' });
  }
}

async function deployEmployee(req, res) {
  try {
    const { id } = req.params;
    const {
      siteId,
      baseSalary,
      contractStartDate,
      contractEndDate,
      daysOfWeek,
      shiftStart,
      shiftEnd
    } = req.body;
    const deploymentOrderUrl = await processDeploymentOrderUpload(req.files || [], req.user?.id);

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    const result = await employeeService.deployEmployee(id, {
      siteId,
      baseSalary,
      contractStartDate,
      contractEndDate,
      daysOfWeek,
      shiftStart,
      shiftEnd,
      deploymentOrderUrl
    });

    return res.json({ message: 'Employee deployed successfully', data: result });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to deploy employee' });
  }
}

async function transferEmployeeAssignment(req, res) {
  try {
    const { id } = req.params;
    const {
      siteId,
      baseSalary,
      contractStartDate,
      contractEndDate,
      daysOfWeek,
      shiftStart,
      shiftEnd
    } = req.body;
    const deploymentOrderUrl = await processDeploymentOrderUpload(req.files || [], req.user?.id);

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    const result = await employeeService.transferEmployeeAssignment(id, {
      siteId,
      baseSalary,
      contractStartDate,
      contractEndDate,
      daysOfWeek,
      shiftStart,
      shiftEnd,
      deploymentOrderUrl
    });

    return res.json({ message: 'Employee transferred successfully', data: result });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to transfer employee assignment' });
  }
}

async function relieveEmployeeAssignment(req, res) {
  try {
    const { id } = req.params;
    const { reliefDate } = req.body;

    const result = await employeeService.relieveEmployeeAssignment(id, {
      reliefDate: reliefDate || null,
    });

    return res.json({ message: 'Employee relieved from assignment successfully', data: result });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to relieve employee assignment' });
  }
}

module.exports = {
  getAllEmployees,
  getDeployableEmployees,
  getEmployeeDetails,
  getEmployeeStats,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  deployEmployee,
  transferEmployeeAssignment,
  relieveEmployeeAssignment,
  getNextEmployeeId
};
