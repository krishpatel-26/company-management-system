Company Management System

A full-stack Company Management System designed to manage employees, departments, roles, permissions, payroll, and organizational hierarchy through a clean enterprise-style admin interface.

Overview

This project demonstrates how a real-world internal management application can be built using a REST API, relational database, role-based access control, employee hierarchy, and audit logging.

The application provides a centralized interface for managing employee information and organizational data while keeping the backend and database structured for future authentication and authorization.

Features
Employee management
Add, edit, view, and deactivate employees
Employee search and filtering
Department management
Employee manager hierarchy
Role and permission management
Role-Based Access Control (RBAC)
Payroll management
Employee profile picture uploads
Resume uploads
Audit logging
Password hashing
RESTful API
MySQL stored procedures
Enterprise-style admin dashboard
Responsive interface
Technology Stack
Frontend
HTML5
CSS3
JavaScript
REST API integration
Responsive enterprise dashboard
Backend
Node.js
Express.js
MySQL2
Multer
Node.js Crypto / scrypt
Database
MySQL
Foreign Keys
Stored Procedures
RBAC
Audit Logs
Relational Data Modeling
System Architecture
┌──────────────────────────────┐
│        Admin Dashboard       │
│       HTML / CSS / JS        │
└──────────────┬───────────────┘
               │
               │ REST API
               ▼
┌──────────────────────────────┐
│       Node.js + Express      │
│          Backend API         │
└──────────────┬───────────────┘
               │
               │ SQL
               ▼
┌──────────────────────────────┐
│            MySQL             │
│                              │
│ company                      │
│ security                     │
│ payroll                      │
└──────────────────────────────┘
Database Structure

The database is organized into three logical schemas.

Company
company
├── employees
├── departments
├── addresses
└── states
Security
security
├── roles
├── permissions
├── role_permissions
└── audit_logs
Payroll
payroll
└── salaries
Employee Hierarchy

Employees can be connected through manager_id to represent the organizational reporting structure.

Example:

CEO
├── HR
├── Director - Engineering
│   └── Senior Manager - AI
│       ├── Machine Learning Engineer
│       └── Software Engineer
│
└── Director - Corporate
    └── Senior Manager - Finance
        └── Manager - Finance
            ├── Financial Analyst
            └── Finance Associate
Role-Based Access Control

The system separates permissions from organizational hierarchy.

Permissions

Define what a role can do.

Examples:

Employee → VIEW / ADD / EDIT / DELETE
Department → VIEW / ADD / EDIT / DELETE
Address → VIEW / ADD / EDIT / DELETE
Salary → VIEW / ADD / EDIT
Reports → VIEW
Roles → VIEW / ADD / EDIT / DELETE
Employee Hierarchy

Defines which employees a user can access within the organization.

This allows the system to evolve toward scope-based authorization such as:

Employee
    ↓
Own data

Manager
    ↓
Own team

Director
    ↓
Subordinate hierarchy

CEO
    ↓
Organization

HR
    ↓
HR-related organizational access
REST API
Health
GET /api/health
Employees
GET    /api/employees
GET    /api/employees/:id
POST   /api/employees
PUT    /api/employees/:id
DELETE /api/employees/:id
Departments
GET  /api/departments
POST /api/departments
Roles
GET /api/roles
GET /api/role-permissions
Payroll
GET /api/salaries
Audit Logs
GET /api/audit-logs
Employee Files
POST /api/employees/:employeeId/profile
POST /api/employees/:employeeId/resume
Project Structure
CompanyManagementAPI/
│
├── src/
│   └── app.js
│
├── uploads/
│   ├── profiles/
│   └── resumes/
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── README.md

.env, node_modules, and uploaded files should not be committed to GitHub.

Getting Started
1. Clone the repository
git clone YOUR_REPOSITORY_URL
cd CompanyManagementAPI
2. Install dependencies
npm install
3. Configure environment variables

Create a .env file:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=company
PORT=3000
4. Start the server
node src/app.js

The application will run at:

http://localhost:3000
5. Check the API
http://localhost:3000/api/health

Expected result:

{
  "status": "OK",
  "database": "MySQL connected"
}
Security

The project includes:

Password hashing using scrypt
Role and permission data modeling
Employee hierarchy modeling
Audit logging
Environment variable protection
File upload restrictions
Employee account status management

Authentication and production-grade JWT authorization are planned as future improvements.

Future Improvements
JWT authentication
Login and logout
User session management
Backend permission middleware
Hierarchy-based data authorization
Password reset
Two-factor authentication
Advanced reporting
Payroll editing workflows
Notification system
Docker deployment
Automated testing
Production deployment
Project Status

Active Development

This project is being developed as a practical full-stack enterprise management system, with a focus on backend architecture, database design, security, and scalable application development.

Author

Krish Patel

B.Tech — Automation & Robotics Engineering

Interested in:

Artificial Intelligence
Machine Learning
Backend Development
Data Engineering
Full-Stack Development
Enterprise Software Systems
