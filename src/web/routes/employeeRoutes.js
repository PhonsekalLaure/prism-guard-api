const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const { getAllEmployees, getEmployeeDetails } = require('../controllers/employeeController');

const router = express.Router();

// Require all employee web routes to be authenticated and accessed by HRIS admins
router.use(requireAuth, requireRole('admin', 'hr')); // Assumed roles based on earlier convos, maybe just 'admin' if 'hr' doesn't exist, but 'admin' is good. Wait, requireRole just checks roles. I'll pass 'admin' since they said only administrators can access HRIS.

// GET /api/web/employees
router.get('/', requireRole('admin'), getAllEmployees);

// GET /api/web/employees/:id
router.get('/:id', requireRole('admin'), getEmployeeDetails);

module.exports = router;
