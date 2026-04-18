const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const paginationMiddleware = require('../middlewares/paginationMiddleware');
const { getAllEmployees, getEmployeeDetails } = require('../controllers/employeeController');

const router = express.Router();

// Require all employee web routes to be authenticated and accessed by HRIS admins
router.use(requireAuth, requireRole('admin'));

// GET /api/web/employees
router.get('/', paginationMiddleware(6), getAllEmployees);

// GET /api/web/employees/:id
router.get('/:id', requireRole('admin'), getEmployeeDetails);

module.exports = router;
