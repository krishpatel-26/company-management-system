const pool = require('./src/config/db');

async function testConnection() {
    try {
        const connection = await pool.getConnection();

        console.log('MySQL connection successful!');

        connection.release();
        await pool.end();
    } catch (error) {
        console.error('MySQL connection failed:');
        console.error(error.message);
    }
}

testConnection();