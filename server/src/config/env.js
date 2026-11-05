'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function validateEnv() {
  const required = ['JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');
  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    console.warn(`[env] WARNING: ${message}. Some features may not work correctly.`);
  }
}

validateEnv();