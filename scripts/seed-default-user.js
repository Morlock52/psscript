#!/usr/bin/env node
/**
 * Seed script to create default admin and demo users
 *
 * Default credentials:
 *   Admin: admin@psscript.local / Admin123!
 *   Demo:  demo@psscript.local / Demo123!
 *
 * IMPORTANT: Change these credentials after first login in production!
 *
 * Usage: node scripts/seed-default-user.js
 */

const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config({ path: './src/backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'psscript',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
});

// Use 12 rounds per OWASP 2025 recommendations (minimum for production)
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

const defaultUsers = [
  {
    username: 'admin',
    email: 'admin@psscript.local',
    password: 'Admin123!',
    role: 'admin'
  },
  {
    username: 'demo',
    email: 'demo@psscript.local',
    password: 'Demo123!',
    role: 'user'
  }
];

async function seedUsers() {
  console.log('🌱 Starting user seeding...\n');

  const client = await pool.connect();

  try {
    for (const user of defaultUsers) {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
        [user.username, user.email]
      );

      if (existingUser.rows.length > 0) {
        console.log(`⏭️  User "${user.username}" already exists (id: ${existingUser.rows[0].id}), skipping...`);
        continue;
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

      // Insert the user
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, username, email, role`,
        [user.username, user.email, passwordHash, user.role]
      );

      const createdUser = result.rows[0];
      console.log(`✅ Created ${user.role} user:`);
      console.log(`   Username: ${createdUser.username}`);
      console.log(`   Email:    ${createdUser.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Role:     ${createdUser.role}`);
      console.log('');
    }

    console.log('─────────────────────────────────────────────');
    console.log('🎉 User seeding complete!\n');
    console.log('Default login credentials:');
    console.log('  Admin: admin@psscript.local / Admin123!');
    console.log('  Demo:  demo@psscript.local / Demo123!');
    console.log('\n⚠️  IMPORTANT: Change these passwords in production!');
    console.log('─────────────────────────────────────────────');

  } catch (error) {
    console.error('❌ Error seeding users:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed
seedUsers().catch((error) => {
  console.error('Failed to seed users:', error);
  process.exit(1);
});
