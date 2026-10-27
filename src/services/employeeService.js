const pool = require('../config/db');

async function addEmployee(employee) {

    const [result] = await pool.query(
        `CALL company.sp_add_employee(
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
        )`,
        [
            employee.actorEmployeeId,

            employee.username,
            employee.email,
            employee.passwordHash,

            employee.firstName,
            employee.lastName,
            employee.phone,
            employee.dateOfBirth,
            employee.gender,

            employee.profilePic,
            employee.resume,

            employee.departmentId,
            employee.roleId,
            employee.jobTitle,
            employee.managerId,
            employee.joiningDate
        ]
    );

    return result[0][0];
}

module.exports = {
    addEmployee
};