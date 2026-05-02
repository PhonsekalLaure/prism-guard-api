require('module-alias/register');
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('@routes/authRoutes');
const profileRoutes = require('@routes/profileRoutes');
const employeeRoutes = require('@routes/employeeRoutes');
const clientRoutes = require('@routes/clientRoutes');
const deployedGuardsRoutes = require('@routes/deployedGuardsRoutes');
const promoClientRoutes = require('./promo/routes/clientRoutes');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('PRISM-GUARD API is running!');
});

// ─── Web Routes ──────────────────────────────────────────────
app.use('/api/web/auth', authRoutes);
app.use('/api/web/profile', profileRoutes);
app.use('/api/web/employees', employeeRoutes);
app.use('/api/web/clients', clientRoutes);
app.use('/api/web/deployed-guards', deployedGuardsRoutes);

// Promo Routes
app.use('/api/promo/clients', promoClientRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`);
});
