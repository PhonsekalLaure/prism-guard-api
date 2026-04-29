const express = require('express');
const { requireAuth, requireRole } = require('@middlewares/authMiddleware');
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
router.get('/', paginationMiddleware(6), filterMiddleware, getAllEmployees);

// POST /api/web/employees (handle any incoming multi-part files)
router.post('/', upload.any(), createEmployee);

// GET /api/web/employees/stats (Must be before /:id)
router.get('/stats', requireRole('admin'), getEmployeeStats);

// GET /api/web/employees/next-id (Must be before /:id)
router.get('/next-id', requireRole('admin'), getNextEmployeeId);

// GET /api/web/employees/deployable (Must be before /:id)
router.get('/deployable', requireRole('admin'), getDeployableEmployees);


// GET /api/web/employees/:id
router.get('/:id', requireRole('admin'), getEmployeeDetails);

// PATCH /api/web/employees/:id
router.patch('/:id', upload.any(), updateEmployee);

// POST /api/web/employees/:id/deploy
router.post('/:id/deploy', upload.any(), deployEmployee);

// POST /api/web/employees/:id/transfer
router.post('/:id/transfer', upload.any(), transferEmployeeAssignment);

// POST /api/web/employees/:id/relieve
router.post('/:id/relieve', relieveEmployeeAssignment);

module.exports = router;
