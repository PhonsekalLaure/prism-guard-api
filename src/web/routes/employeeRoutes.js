const express = require('express');
const { requireAuth, requireRole, requireAdminPermission } = require('@middlewares/authMiddleware');
const paginationMiddleware = require('@middlewares/paginationMiddleware');
const filterMiddleware = require('@middlewares/filterMiddleware');
const {
  getAllEmployees,
  getDeployableEmployees,
  getEmployeeDetails,
  getEmployeeStats,
  createEmployee,
  updateEmployee,
  getNextEmployeeId,
  deployEmployee,
  transferEmployeeAssignment,
  relieveEmployeeAssignment
} = require('@controllers/employeeController');
const multer = require('multer');

// Setup multer mapping (files stored in node memory briefly for Cloudinary upload)
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Require all employee web routes to be authenticated and accessed by HRIS admins
router.use(requireAuth, requireRole('admin'));

// GET /api/web/employees
router.get('/', requireAdminPermission('employees.read'), paginationMiddleware(6), filterMiddleware, getAllEmployees);

// POST /api/web/employees (handle any incoming multi-part files)
router.post('/', requireAdminPermission('employees.write'), upload.any(), createEmployee);

// GET /api/web/employees/stats (Must be before /:id)
router.get('/stats', requireAdminPermission('employees.read'), getEmployeeStats);

// GET /api/web/employees/next-id (Must be before /:id)
router.get('/next-id', requireAdminPermission('employees.read'), getNextEmployeeId);

// GET /api/web/employees/deployable (Must be before /:id)
router.get('/deployable', requireAdminPermission('employees.read'), getDeployableEmployees);


// GET /api/web/employees/:id
router.get('/:id', requireAdminPermission('employees.read'), getEmployeeDetails);

// PATCH /api/web/employees/:id
router.patch('/:id', requireAdminPermission('employees.write'), upload.any(), updateEmployee);

// POST /api/web/employees/:id/deploy
router.post('/:id/deploy', requireAdminPermission('employees.write'), upload.any(), deployEmployee);

// POST /api/web/employees/:id/transfer
router.post('/:id/transfer', requireAdminPermission('employees.write'), upload.any(), transferEmployeeAssignment);

// POST /api/web/employees/:id/relieve
router.post('/:id/relieve', requireAdminPermission('employees.write'), relieveEmployeeAssignment);

module.exports = router;
