const express = require('express');
const { requireAuth, requireRole, requireAdminPermission } = require('@middlewares/authMiddleware');
const paginationMiddleware = require('@middlewares/paginationMiddleware');
const filterMiddleware = require('@middlewares/filterMiddleware');
const { createRateLimitMiddleware } = require('@middlewares/rateLimitMiddleware');
const { uploadAny } = require('@middlewares/uploadMiddleware');
const {
  getAllEmployees,
  getDeployableEmployees,
  getEmployeeDetails,
  getEmployeeStats,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  getNextEmployeeId,
  deployEmployee,
  transferEmployeeAssignment,
  relieveEmployeeAssignment
} = require('@controllers/employeeController');

const router = express.Router();

// Require all employee web routes to be authenticated and accessed by HRIS admins
router.use(requireAuth, requireRole('admin'));

// GET /api/web/employees
router.get('/', requireAdminPermission('employees.read'), paginationMiddleware(6), filterMiddleware, getAllEmployees);

// POST /api/web/employees (handle any incoming multi-part files)
router.post(
  '/',
  requireAdminPermission('employees.write'),
  createRateLimitMiddleware('employeeWrite'),
  uploadAny,
  createEmployee
);

// GET /api/web/employees/stats (Must be before /:id)
router.get('/stats', requireAdminPermission('employees.read'), getEmployeeStats);

// GET /api/web/employees/next-id (Must be before /:id)
router.get('/next-id', requireAdminPermission('employees.read'), createRateLimitMiddleware('employeeNextId'), getNextEmployeeId);

// GET /api/web/employees/deployable (Must be before /:id)
router.get('/deployable', requireAdminPermission('employees.read'), getDeployableEmployees);


// GET /api/web/employees/:id
router.get('/:id', requireAdminPermission('employees.read'), getEmployeeDetails);

// PATCH /api/web/employees/:id
router.patch(
  '/:id',
  requireAdminPermission('employees.write'),
  createRateLimitMiddleware('employeeWrite'),
  uploadAny,
  updateEmployee
);

router.post(
  '/:id/deactivate',
  requireAdminPermission('employees.write'),
  createRateLimitMiddleware('employeeWrite'),
  deactivateEmployee
);

// POST /api/web/employees/:id/deploy
router.post(
  '/:id/deploy',
  requireAdminPermission('employees.write'),
  createRateLimitMiddleware('deploymentWrite'),
  uploadAny,
  deployEmployee
);

// POST /api/web/employees/:id/transfer
router.post(
  '/:id/transfer',
  requireAdminPermission('employees.write'),
  createRateLimitMiddleware('deploymentWrite'),
  uploadAny,
  transferEmployeeAssignment
);

// POST /api/web/employees/:id/relieve
router.post(
  '/:id/relieve',
  requireAdminPermission('employees.write'),
  createRateLimitMiddleware('deploymentRelieve'),
  relieveEmployeeAssignment
);

module.exports = router;
