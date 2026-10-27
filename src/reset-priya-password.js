
const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

function passwordHash(password) {
    const salt = crypto.randomBytes(16).toString('hex');

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString('hex');

    return `scrypt:${salt}:${hash}`;
}

async function main() {
    const username = process.argv[2];
    const newPassword = process.argv[3];

    if (!username || !newPassword || newPassword.length < 12) {
        console.error(
            'Usage: node reset-priya-password.js <username> <password>\n' +
            'Password must contain at least 12 characters.'
        );
        process.exitCode = 1;
        return;
    }

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'company'
    });

    try {
        const [result] = await pool.execute(
            `UPDATE company.employees
             SET password_hash = ?
             WHERE employee_id = 2
               AND username = ?`,
            [passwordHash(newPassword), username]
        );

        if (result.affectedRows !== 1) {
            console.error(
                'No account was updated. Check Priya’s username and employee ID.'
            );
            process.exitCode = 1;
            return;
        }

        console.log('Password reset successful for Priya Sharma (employee ID 2).');
        console.log('Sign in with the username supplied and your new password.');
    } finally {
        await pool.end();
    }
}

main().catch(error => {
    console.error('Password reset failed:', error.message);
    process.exitCode = 1;
});
