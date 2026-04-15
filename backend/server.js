const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const groceryRoutes = require('./groceryroutes');
app.use('/api/groceries', groceryRoutes);

app.get('/', (req, res) => {
  res.json({
    message: '🥦 Grocery Management System API is running!',
    version: '1.0.0',
    endpoints: {
      getAllItems: 'GET /api/groceries',
      getItem: 'GET /api/groceries/:id',
      getStats: 'GET /api/groceries/stats',
      addItem: 'POST /api/groceries',
      updateItem: 'PUT /api/groceries/:id',
      deleteItem: 'DELETE /api/groceries/:id'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.url} not found` });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log(`║  🛒 Grocery API running on port ${PORT}   ║`);
  console.log('║  http://localhost:5000                 ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
});