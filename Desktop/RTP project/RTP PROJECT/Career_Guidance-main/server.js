const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const RAPIDAPI_KEY = 'fa6f63f776msh01634544d8322e1p17587ejsn2266f834c524'; // Replace with your API Key

// ✅ PostgreSQL pool setup with hardcoded credentials
const pool = new Pool({
  user: 'myuser',
  host: 'localhost',
  database: 'mydb',
  password: 'mypassword',
  port: 5432,
  ssl: false  // Set to false for local development
});

// ✅ Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// ✅ Create users table
const createTable = async () => {
  try {
    // Try creating table directly in public schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        password VARCHAR(255) NOT NULL
      )
    `);
    console.log('✅ Users table ready');
  } catch (err) {
    console.error('❌ Error creating table:', err);
    // If table creation fails, try to check if table exists
    try {
      const result = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')");
      if (result.rows[0].exists) {
        console.log('✅ Users table already exists');
      } else {
        console.error('❌ Users table does not exist and cannot be created');
      }
    } catch (checkErr) {
      console.error('❌ Error checking table existence:', checkErr);
    }
  }
};
createTable();

// ✅ Signup route
app.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;
  console.log('Signup attempt:', username);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
      [username, email, hashedPassword]
    );
    res.status(201).send('Sign up successful!');
  } catch (err) {
    console.error('❌ Signup error:', err);
    if (err.code === '23505') {
      res.status(400).send('Username already exists');
    } else {
      res.status(500).send('Server error');
    }
  }
});

// ✅ Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username);

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(400).send('User not found');
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      res.status(200).send('Login successful!');
    } else {
      res.status(401).send('Incorrect password');
    }
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).send('Server error');
  }
});

// ✅ Job Search from JSearch API
app.get('/api/jobs', async (req, res) => {
  const {
    query,
    location,
    page = 1,
    results_per_page = 10,
  } = req.query;

  const url = 'https://jsearch.p.rapidapi.com/search';
  const headers = {
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
  };

  const params = new URLSearchParams({
    query: query || 'developer',
    location: location || 'India',
    page: page.toString(),
    num_pages: '1',
  });

  try {
    const response = await axios.get(`${url}?${params.toString()}`, { headers });
    res.json(response.data);
  } catch (error) {
    console.error('🔴 Job Search Error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch jobs from JSearch' });
  }
});

// ✅ Location Suggestions for Indian Cities
app.get('/api/locations', async (req, res) => {
  const location = req.query.location;

  const indianCities = [
    "Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata", "Hyderabad",
    "Pune", "Ahmedabad", "Chandigarh", "Jaipur", "Lucknow", "Kochi",
    "Kochi", "Surat", "Indore", "Patna", "Bhubaneswar"
  ];

  if (!location) {
    return res.status(400).json({ error: 'Missing location query' });
  }

  const filteredCities = indianCities.filter(city => 
    city.toLowerCase().includes(location.toLowerCase())
  );

  res.json(filteredCities);
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
