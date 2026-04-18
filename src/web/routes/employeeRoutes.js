const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const paginationMiddleware = require('../middlewares/paginationMiddleware');
const filterMiddleware = require('../middlewares/filterMiddleware');
const { getAllEmployees, getEmployeeDetails, getEmployeeStats } = require('../controllers/employeeController');

const router = express.Router();

// Require all employee web routes to be authenticated and accessed by HRIS admins
router.use(requireAuth, requireRole('admin'));

// GET /api/web/employees
router.get('/', paginationMiddleware(6), filterMiddleware, getAllEmployees);

// GET /api/web/employees/stats (Must be before /:id)
router.get('/stats', requireRole('admin'), getEmployeeStats);

// GET /api/web/employees/:id
router.get('/:id', requireRole('admin'), getEmployeeDetails);

module.exports = router;
