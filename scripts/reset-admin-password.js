#!/usr/bin/env node
/**
 * Reset admin password to a known value
 *
 * New password: Admin123!
 *
 * Usage: node scripts/reset-admin-password.js
 */

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'psscript',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
});

// Use 12 rounds per OWASP 2025 recommendations (minimum for production)
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const NEW_PASSWORD = 'Admin123!';

async function resetPassword() {
  console.log('🔐 Resetting admin password...\n');

  const client = await pool.connect();

  try {
    // Hash the new password
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, SALT_ROUNDS);

    // Update the admin user's password
    const result = await client.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW(), login_attempts = 0
       WHERE username = 'admin'
       RETURNING id, username, email, role`,
      [passwordHash]
    );

    if (result.rows.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }

    const user = result.rows[0];
    console.log('✅ Password reset successful!');
    console.log(`   Username: ${user.username}`);
    console.log(`   Email:    ${user.email}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log(`   Role:     ${user.role}`);
    console.log('\n⚠️  IMPORTANT: Change this password after logging in!');

  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the reset
resetPassword().catch((error) => {
  console.error('Failed to reset password:', error);
  process.exit(1);
});
