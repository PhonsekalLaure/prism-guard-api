const employeeService = require('@services/employeeService');
const { formatPaginatedResponse } = require('@utils/pagination');
const { uploadBufferToCloudinary } = require('../../config/cloudinary');

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
    const employees = await employeeService.getDeployableEmployees();
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

    const data = {};
    // Trim string inputs
    Object.keys(req.body).forEach(key => {
      data[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
    });

    const files = req.files || []; // from multer
    let avatarUrl = null;
    let contractDocUrl = null;
    let deploymentOrderUrl = null;

    // 1. Process files to Cloudinary
    const clearancesData = [];
    for (const file of files) {
      if (file.fieldname === 'avatar') {
        avatarUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/avatars');
      } else if (file.fieldname === 'document_contract') {
        contractDocUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/contracts');
      } else if (file.fieldname === 'document_deployment_order') {
        deploymentOrderUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/deployment_orders');
      } else if (file.fieldname.startsWith('document_')) {
        const type = file.fieldname.replace('document_', '');
        const secureUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/documents');
        clearancesData.push({ type, url: secureUrl });
      }
    }

    // 2. Call service to create user in DB
    const { userId } = await employeeService.createEmployee(
      data,
      clearancesData,
      avatarUrl,
      {
        contractDocUrl,
        contractEndDate: data.contractEndDate || null,
        deploymentOrderUrl,
        initialSiteId: data.initialSiteId || null,
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
    const data = {};

    // Trim all string body fields
    Object.keys(req.body).forEach(key => {
      data[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
    });

    const files = req.files || [];
    const clearancesData = [];
    let avatarUrl = null;
    let deploymentOrderUrl = null;

    // Upload any replacement clearance documents to Cloudinary
    for (const file of files) {
      if (file.fieldname === 'avatar') {
        avatarUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/avatars');
      } else if (file.fieldname === 'document_deployment_order') {
        deploymentOrderUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/deployment_orders');
      } else if (file.fieldname.startsWith('document_')) {
        const type = file.fieldname.replace('document_', '');
        const secureUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/documents');
        clearancesData.push({ type, url: secureUrl });
      }
    }

    await employeeService.updateEmployee(id, data, clearancesData, avatarUrl, deploymentOrderUrl);

    return res.json({ message: 'Employee updated successfully' });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to update employee' });
  }
}

async function deployEmployee(req, res) {
  try {
    const { id } = req.params;
    const {
      siteId,
      ratePerGuard,
      contractStartDate,
      contractEndDate,
      daysOfWeek,
      shiftStart,
      shiftEnd
    } = req.body;
    const files = req.files || [];
    let deploymentOrderUrl = null;

    for (const file of files) {
      if (file.fieldname === 'document_deployment_order') {
        deploymentOrderUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/deployment_orders');
      }
    }

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    const result = await employeeService.deployEmployee(id, {
      siteId,
      ratePerGuard,
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

module.exports = {
  getAllEmployees,
  getDeployableEmployees,
  getEmployeeDetails,
  getEmployeeStats,
  createEmployee,
  updateEmployee,
  deployEmployee,
  getNextEmployeeId
};
