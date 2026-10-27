
import { useCallback, useEffect, useState } from "react";
import { apiRequest, getAuthToken, setAuthSession, clearAuthSession } from "./services/api";
import Timesheets from "./Timesheets";
import ManagerApprovals from "./ManagerApprovals";
import CommunicationCentre from "./CommunicationCentre";
import "./App.css";

function getList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function getEmployeeName(employee) {
  return (
    employee.full_name ||
    [
      employee.first_name || employee.firstname,
      employee.last_name || employee.lastname,
    ]
      .filter(Boolean)
      .join(" ") ||
    employee.employee_name ||
    employee.username ||
    `Employee ${employee.employee_id || employee.id || ""}`
  );
}

function App() {
  const [token, setToken] = useState(
    () => getAuthToken()
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || data.error || "Login failed.");
      }

      if (!data.token) {
        throw new Error("The server did not return an authentication token.");
      }

      setAuthSession(data.token, data.employee || null);

      setToken(data.token);
      setPassword("");
    } catch (err) {
      setLoginError(err.message || "Unable to sign in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    clearAuthSession();

    setToken("");
    setUser(null);
    setEmployees([]);
    setDepartments([]);
    setRoles([]);
    setError("");
    setLoginError("");
  };

  const loadDashboard = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [userResult, employeeResult, departmentResult, roleResult] =
        await Promise.allSettled([
          apiRequest("/auth/me"),
          apiRequest("/employees"),
          apiRequest("/departments"),
          apiRequest("/roles"),
        ]);

      if (userResult.status === "rejected") {
        throw userResult.reason;
      }

      const userData = userResult.value;

      if (userData.success === false || !userData.employee) {
        throw new Error(
          userData.message || "Unable to verify your login session."
        );
      }

      setUser(userData.employee);

      if (employeeResult.status === "fulfilled") {
        setEmployees(getList(employeeResult.value, "employees"));
      } else {
        setEmployees([]);
      }

      if (departmentResult.status === "fulfilled") {
        setDepartments(getList(departmentResult.value, "departments"));
      } else {
        setDepartments([]);
      }

      if (roleResult.status === "fulfilled") {
        setRoles(getList(roleResult.value, "roles"));
      } else {
        setRoles([]);
      }

      const failures = [
        employeeResult,
        departmentResult,
        roleResult,
      ].filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        setError(
          "Your login worked, but some dashboard data could not be loaded. Check your permissions and API routes."
        );
      }
    } catch (err) {
      setError(err.message || "Unable to load dashboard.");

      if (
        err.message?.includes("401") ||
        /session expired|please log in|invalid session/i.test(err.message || "")
      ) {
        clearAuthSession();
        setToken("");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    loadDashboard();
  }, [token, loadDashboard]);

  const activeEmployees = employees.filter((employee) => {
    const status = String(
      employee.account_status || employee.status || ""
    ).toUpperCase();

    return status === "ACTIVE" || status === "1";
  }).length;

  const displayName = user ? getEmployeeName(user) : "Company user";
const roleName = user?.role_name || user?.role || "Employee";

const normalizedRole = String(roleName || "").trim().toLowerCase();
const isManager = normalizedRole.includes("manager");
const isPrivileged = ["hr", "ceo"].includes(normalizedRole);
const canReviewTimesheets = isPrivileged || isManager;
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const cards = [
    {
      label: "Employees",
      value: employees.length,
      description: "Employee records",
    },
    {
      label: "Active",
      value: activeEmployees,
      description: "Active accounts",
    },
    {
      label: "Departments",
      value: departments.length,
      description: "Organizational units",
    },
    {
      label: "Roles",
      value: roles.length,
      description: "Security roles",
    },
  ];

  const filteredEmployees = [...employees]
    .sort(
      (a, b) =>
        Number(b.employee_id || b.id || 0) -
        Number(a.employee_id || a.id || 0)
    )
    .filter((employee) =>
      getEmployeeName(employee)
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      String(employee.email || "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      String(employee.job_title || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .slice(0, 5);

  if (!token) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f4f7fc",
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            width: "100%",
            maxWidth: 420,
            boxSizing: "border-box",
            padding: 32,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 18,
            boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <span
              className="brand-icon"
              style={{ display: "grid", placeItems: "center" }}
            >
              C
            </span>
            <strong style={{ fontSize: 21 }}>
              Company Management
            </strong>
          </div>

          <h1 style={{ marginBottom: 8 }}>Welcome back</h1>
          <p style={{ color: "#64748b", marginBottom: 24 }}>
            Sign in to access your company dashboard.
          </p>

          <label
            htmlFor="login-username"
            style={{ display: "block", marginBottom: 8 }}
          >
            Username
          </label>
          <input
            id="login-username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 12,
              marginBottom: 18,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
            }}
          />

          <label
            htmlFor="login-password"
            style={{ display: "block", marginBottom: 8 }}
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 12,
              marginBottom: 18,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
            }}
          />

          {loginError && (
            <p className="error-message" role="alert">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={loginLoading}
            style={{
              width: "100%",
              cursor: loginLoading ? "wait" : "pointer",
              justifyContent: "center",
            }}
          >
            {loginLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  // Vite falls back to index.html for unknown .html paths. Explicitly render
  // the React pages for these URLs so they do not silently show the Overview.
  const currentPath = window.location.pathname.toLowerCase();
  if (currentPath === "/timesheets.html") {
    if (loading || !user) {
      return <main className="dashboard"><p className="empty-state">Loading your session…</p></main>;
    }
    return <Timesheets user={user} onLogout={logout} />;
  }
  if (currentPath === "/approvals.html" || currentPath === "/pending-approvals.html") {
    if (loading || !user) {
      return <main className="dashboard"><p className="empty-state">Loading your session…</p></main>;
    }
    return <ManagerApprovals user={user} onLogout={logout} />;
  }
  if (currentPath === "/communication.html" || currentPath === "/messages.html") {
    if (loading || !user) {
      return <main className="dashboard"><p className="empty-state">Loading your session…</p></main>;
    }
    return <CommunicationCentre user={user} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">C</span>
          <strong>
            Company
            <br />
            Management
          </strong>
        </div>

        <p className="nav-heading">WORKSPACE</p>

        <nav>
          <a className={`nav-item ${currentPath === "/" ? "active" : ""}`} href="/">
            ⌂ <span>Overview</span>
          </a>
          <a className="nav-item" href="/employees.html">
            ♙ <span>Employees</span>
          </a>
          <a className={`nav-item ${currentPath === "/timesheets.html" ? "active" : ""}`} href="/timesheets.html">
            ◷ <span>Timesheets</span>
          </a>
          <a className={`nav-item ${["/communication.html", "/messages.html"].includes(currentPath) ? "active" : ""}`} href="/communication.html">
            ✉ <span>Messages &amp; requests</span>
          </a>
          {canReviewTimesheets && (
            <a className={`nav-item ${["/approvals.html", "/pending-approvals.html"].includes(currentPath) ? "active" : ""}`} href="/approvals.html">
              ✓ <span>Manager Approvals</span>
            </a>
          )}
          <a className="nav-item" href="/departments.html">
            ▤ <span>Departments</span>
          </a>
          <a className="nav-item" href="/projects.html">
            ◈ <span>Projects</span>
          </a>
        </nav>

        <p className="nav-heading">SECURITY</p>

        <nav>
          <a className="nav-item" href="/roles.html">
            ◆ <span>Roles &amp; Permissions</span>
          </a>
          <a className="nav-item" href="/audit-logs.html">
            ◎ <span>Audit Logs</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" /> API connected
          <p>Development workspace</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search employees, email or job title"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="topbar-actions">
            <div className="api-status">
              <span className="status-dot" />
              API ONLINE
            </div>
            <div className="user-menu">
              <span className="avatar">{initials}</span>
              <div className="user-copy">
                <strong>{displayName}</strong>
                <span>{roleName}</span>
              </div>
              <button className="signout-button" type="button" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        </header>

        <section className="dashboard">
          <div className="page-heading">
            <div>
              <span className="eyebrow">COMPANY WORKSPACE</span>
              <h1>Overview</h1>
              <p>Manage people, organization, access and timesheets.</p>
            </div>

            <a className="primary-button" href="/add-employee.html">
              + Add employee
            </a>
          </div>

          {error && (
            <div className="error-message" role="alert">
              <strong>Dashboard notice</strong>
              <p>{error}</p>
              <button type="button" onClick={loadDashboard}>
                Retry
              </button>
            </div>
          )}

          <div className="stats-grid">
            {cards.map((card) => (
              <article className="stat-card" key={card.label}>
                <span className="stat-label">{card.label}</span>
                <strong className="stat-value">
                  {loading ? "—" : card.value}
                </strong>
                <span className="stat-description">
                  {card.description}
                </span>
              </article>
            ))}
          </div>

          <div className="content-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Recently added employees</h2>
                <a href="/employees.html">View all</a>
              </div>

              {loading ? (
                <p className="empty-state">Loading employees...</p>
              ) : filteredEmployees.length === 0 ? (
                <p className="empty-state">
                  {search
                    ? "No employees match your search."
                    : "No employee records found."}
                </p>
              ) : (
                filteredEmployees.map((employee, index) => {
                  const name = getEmployeeName(employee);

                  return (
                    <div
                      className="employee-row"
                      key={employee.employee_id || employee.id || index}
                    >
                      <span className="avatar">
                        {name
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>

                      <div className="employee-details">
                        <strong>{name}</strong>
                        <span>
                          {employee.job_title ||
                            employee.designation ||
                            employee.role_name ||
                            employee.department_name ||
                            "Employee"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>Workspace</h2>
              </div>

              <a className="workspace-link" href="/employees.html">
                <strong>Employee management</strong>
                <span>View and manage employee records.</span>
              </a>

              <a className="workspace-link" href="/timesheets.html">
                <strong>Timesheets</strong>
                <span>View and record working hours.</span>
              </a>

              <a className="workspace-link" href="/departments.html">
                <strong>Departments</strong>
                <span>
                  {loading
                    ? "Loading..."
                    : `${departments.length} departments available`}
                </span>
              </a>

              <a className="workspace-link" href="/projects.html">
                <strong>Projects</strong>
                <span>View company projects and assignments.</span>
              </a>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
