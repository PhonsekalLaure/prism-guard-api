require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./web/routes/authRoutes');
const profileRoutes = require('./web/routes/profileRoutes');
const employeeRoutes = require('./web/routes/employeeRoutes');
const clientRoutes = require('./web/routes/clientRoutes');
const mobileAuthRoutes = require('./mobile/routes/authRoutes');

const app = express();

app.use(cors({
  origin: [
    process.env.CORS_ORIGIN || 'http://localhost:5173',
    'http://localhost:8081',
  ],
  credentials: true,
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('PRISM-GUARD API is running!');
});

// Web Routes
app.use('/api/web/auth', authRoutes);
app.use('/api/web/profile', profileRoutes);
app.use('/api/web/employees', employeeRoutes);
app.use('/api/web/clients', clientRoutes);

// Mobile Routes
app.use('/api/mobile/auth', mobileAuthRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`);
});