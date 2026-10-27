const employeeService = require('../services/employeeService');

async function addEmployee(req, res) {

    try {

        const employee = {
            actorEmployeeId: req.body.actorEmployeeId,

            username: req.body.username,
            email: req.body.email,
            passwordHash: req.body.passwordHash,

            firstName: req.body.firstName,
            lastName: req.body.lastName,
            phone: req.body.phone,
            dateOfBirth: req.body.dateOfBirth,
            gender: req.body.gender,

            profilePic: req.body.profilePic,
            resume: req.body.resume,

            departmentId: req.body.departmentId,
            roleId: req.body.roleId,
            jobTitle: req.body.jobTitle,
            managerId: req.body.managerId,
            joiningDate: req.body.joiningDate
        };

        const result = await employeeService.addEmployee(employee);

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            employee: result
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    addEmployee
};