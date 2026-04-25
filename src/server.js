require('module-alias/register');
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('@routes/authRoutes');
const profileRoutes = require('@routes/profileRoutes');
const employeeRoutes = require('@routes/employeeRoutes');
const clientRoutes = require('@routes/clientRoutes');
const deployedGuardsRoutes = require('@routes/deployedGuardsRoutes');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`);
});