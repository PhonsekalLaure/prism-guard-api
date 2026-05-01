const express = require('express');
const adminController = require('@controllers/adminController');
const {
  requireAuth,
  requireRole,
  requireAdminRole,
  requireAdminPermission,
} = require('@middlewares/authMiddleware');
const { createRateLimitMiddleware } = require('@middlewares/rateLimitMiddleware');

const router = express.Router();

router.use(requireAuth, requireRole('admin'), requireAdminPermission('admins.manage'));

router.get('/', adminController.getAllAdmins);
router.post('/', createRateLimitMiddleware('adminWrite'), adminController.createAdmin);
router.patch('/:id', requireAdminRole('president'), adminController.updateAdmin);
router.delete('/:id', requireAdminRole('president'), adminController.deleteAdmin);

module.exports = router;
