require('dotenv').config();

const mysql = require('mysql2/promise');
const crypto = require('crypto');

async function resetLogin() {
    const username = 'arjun.sharma';
    const password = 'Arjun@1234';

    const salt = crypto.randomBytes(16).toString('hex');

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString('hex');

    const passwordHash = `scrypt:${salt}:${hash}`;

    const db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'company'
    });

    const [result] = await db.execute(
        `UPDATE employees
         SET password_hash = ?
         WHERE username = ?`,
        [passwordHash, username]
    );

    if (result.affectedRows === 0) {
        console.log('ERROR: Username not found:', username);
    } else {
        console.log('Password reset successfully.');
        console.log('Username:', username);
        console.log('Password:', password);
    }

    await db.end();
}

resetLogin().catch(console.error);