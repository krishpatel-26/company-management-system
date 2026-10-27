import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./services/api";
import "./TimesheetsCalendar.css";

const HOURS_TEMPLATE = [8, 8, 8, 8, 8, 0, 0];
const createEntry = (hours = 0) => ({
  rowId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  projectId: "",
  customActivity: "",
  hours,
  description: "",
});
const createWeekEntries = (templates = Array(7).fill(0)) =>
  templates.map((hours) => [createEntry(hours)]);
const pad = (n) => String(n).padStart(2, "0");
const toISODate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function mondayOf(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function getList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function getName(user) {
  return (
    user?.full_name ||
    [user?.first_name || user?.firstname, user?.last_name || user?.lastname]
      .filter(Boolean)
      .join(" ") ||
    user?.employee_name ||
    user?.username ||
    "Employee"
  );
}

function getEmployeeId(user) {
  return Number(user?.employee_id || user?.id || 0);
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function statusOf(item) {
  return String(item.status || item.timesheet_status || "DRAFT").toUpperCase();
}

export default function Timesheets({ user, onLogout }) {
  const employeeId = getEmployeeId(user);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState({ project_name: "", project_code: "", description: "", start_date: toISODate(new Date()), end_date: "" });
  const [records, setRecords] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toISODate(new Date()));
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [dayEntries, setDayEntries] = useState(() => createWeekEntries(HOURS_TEMPLATE));
  const [commonDescription, setCommonDescription] = useState("");
  const [rangeFill, setRangeFill] = useState({
  projectId: "",
  startDate: "",
  endDate: "",
  hours: 8,
});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekKey = `${toISODate(days[0])} – ${toISODate(days[6])}`;
  const totalHours = dayEntries.reduce(
    (weekSum, entries) => weekSum + entries.reduce((daySum, entry) => daySum + (Number(entry.hours) || 0), 0),
    0
  );
  const daysWithHours = dayEntries.filter((entries) => entries.some((entry) => Number(entry.hours) > 0)).length;
  const plannedEntries = dayEntries.reduce((sum, entries) => sum + entries.filter((entry) => Number(entry.hours) > 0).length, 0);

  const myAssignments = useMemo(
    () =>
      assignments.filter((item) => {
        const assignedEmployee = Number(item.employee_id || item.employeeId || 0);
        const active = String(item.assignment_status || "ACTIVE").toUpperCase();
        return assignedEmployee === employeeId && !["INACTIVE", "CANCELLED", "CLOSED"].includes(active);
      }),
    [assignments, employeeId]
  );

  const recordsByDate = useMemo(() => {
    const map = new Map();
    for (const record of records) {
      const date = String(record.work_date || "").slice(0, 10);
      if (!date) continue;
      const current = map.get(date) || [];
      current.push(record);
      map.set(date, current);
    }
    return map;
  }, [records]);

  const weekRecords = useMemo(
    () => days.flatMap((day) => recordsByDate.get(toISODate(day)) || []),
    [days, recordsByDate]
  );

  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = addDays(first, -mondayOffset);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [calendarMonth]);

  const calendarEntriesByDate = useMemo(() => {
    const map = new Map();
    for (const record of records) {
      const date = String(record.work_date || '').slice(0, 10);
      if (!date) continue;
      const current = map.get(date) || [];
      current.push(record);
      map.set(date, current);
    }
    return map;
  }, [records]);

  const calendarSelectedRecords = calendarEntriesByDate.get(selectedCalendarDate) || [];
  const monthLabel = calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  function calendarStatus(date) {
    const iso = toISODate(date);
    const items = calendarEntriesByDate.get(iso) || [];
    if (items.some((item) => statusOf(item) === 'REJECTED')) return 'rejected';
    if (items.some((item) => statusOf(item) === 'SUBMITTED')) return 'submitted';
    if (items.some((item) => statusOf(item) === 'APPROVED')) return 'approved';
    if (items.some((item) => statusOf(item) === 'DRAFT')) return 'draft';
    const today = toISODate(new Date());
    if (iso < today && date.getDay() !== 0 && date.getDay() !== 6) return 'missing';
    return 'none';
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [assignmentResult, timesheetResult, projectResult] = await Promise.all([
        apiRequest("/project-assignments"),
        apiRequest(`/timesheets?employee_id=${encodeURIComponent(employeeId)}`),
        apiRequest("/projects"),
      ]);

      setAssignments(getList(assignmentResult, "assignments"));
      setProjects(getList(projectResult, "projects").filter((project) =>
        !["COMPLETED", "CANCELLED", "CLOSED"].includes(String(project.project_status || "").toUpperCase())
      ));
      // Never render another employee's rows in this screen, even if the
      // current GET route returns an unfiltered array. The backend must also
      // enforce this restriction; client-side filtering is only presentation.
      const allRecords = getList(timesheetResult, "timesheets");
      setRecords(
        allRecords.filter(
          (item) => Number(item.employee_id) === employeeId
        )
      );
    } catch (err) {
      setError(err?.message || "Unable to load timesheets.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Existing entries are shown as already logged. Don't pre-fill editable
    // hours from them, because the current API doesn't provide an update route.
    setNotice("");
  }, [weekStart]);
  const applyProjectToDateRange = () => {
    setError("");
    setNotice("");

    const { projectId, startDate, endDate, hours } = rangeFill;
    const parsedHours = Number(hours);

    if (!projectId) {
      setError("Choose an existing project or create a project first.");
      return;
    }

    if (!startDate || !endDate || startDate > endDate) {
      setError("Choose a valid start date and end date.");
      return;
    }

    const weekStartDate = toISODate(days[0]);
    const weekEndDate = toISODate(days[6]);
    if (startDate < weekStartDate || endDate > weekEndDate) {
      setError("Choose dates within the currently displayed week.");
      return;
    }

    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      setError("Enter hours per day between 0.25 and 24.");
      return;
    }

    const selectedDates = days
      .map((day, dayIndex) => ({ date: toISODate(day), dayIndex }))
      .filter(({ date }) => date >= startDate && date <= endDate);

    const alreadyLoggedDates = new Set(
      selectedDates
        .filter(({ date }) => (recordsByDate.get(date) || []).length > 0)
        .map(({ date }) => date)
    );

    const editableDates = selectedDates.filter(
      ({ date }) => !alreadyLoggedDates.has(date)
    );

    if (editableDates.length === 0) {
      setError("Every selected date already has a saved timesheet. Choose dates without saved entries.");
      return;
    }

    setDayEntries((current) =>
      current.map((entries, dayIndex) => {
        const date = toISODate(days[dayIndex]);
        if (date < startDate || date > endDate || alreadyLoggedDates.has(date)) {
          return entries;
        }

        const existingProjectIndex = entries.findIndex(
          (entry) => String(entry.projectId) === String(projectId) && !entry.customActivity
        );

        if (existingProjectIndex >= 0) {
          return entries.map((entry, index) =>
            index === existingProjectIndex
              ? {
                  ...entry,
                  projectId: String(projectId),
                  customActivity: "",
                  hours: parsedHours,
                  description: entry.description || commonDescription,
                }
              : entry
          );
        }

        // Reuse a blank row first so the week layout does not grow unnecessarily.
        // The default weekday template pre-fills 8 hours, so an unassigned
        // row is still reusable even when its hours are non-zero.
        const emptyIndex = entries.findIndex(
          (entry) => !entry.projectId && !String(entry.customActivity || "").trim()
        );

        const replacement = (entry) => ({
          ...entry,
          projectId: String(projectId),
          customActivity: "",
          hours: parsedHours,
          description: entry.description || commonDescription,
        });

        if (emptyIndex >= 0) {
          return entries.map((entry, index) =>
            index === emptyIndex ? replacement(entry) : entry
          );
        }

        return [
          ...entries,
          {
            ...createEntry(parsedHours),
            projectId: String(projectId),
            description: commonDescription,
          },
        ];
      })
    );

    setNotice(
      `Applied the selected project to ${editableDates.length} day(s). Saved dates were left unchanged. Review the daily cards, then submit for manager approval.`
    );
  };

  const applyTemplate = (template) => {
    setDayEntries((current) => current.map((entries, index) => {
      const [first = createEntry()] = entries;
      return [
        { ...first, hours: template[index] },
        ...entries.slice(1).map((entry) => ({ ...entry, hours: 0 })),
      ];
    }));
    setNotice("");
  };

  const updateDayEntry = (dayIndex, rowId, field, value) => {
    setDayEntries((current) => current.map((entries, index) => index !== dayIndex
      ? entries
      : entries.map((entry) => {
          if (entry.rowId !== rowId) return entry;
          if (field === "hours") {
            const parsed = value === "" ? "" : Math.max(0, Math.min(24, Number(value)));
            return { ...entry, hours: parsed };
          }
          return { ...entry, [field]: value };
        })
    ));
  };

  const addDayEntry = (dayIndex) => {
    setDayEntries((current) => current.map((entries, index) =>
      index === dayIndex ? [...entries, createEntry(0)] : entries
    ));
  };

  const removeDayEntry = (dayIndex, rowId) => {
    setDayEntries((current) => current.map((entries, index) => {
      if (index !== dayIndex || entries.length <= 1) return entries;
      return entries.filter((entry) => entry.rowId !== rowId);
    }));
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!newProject.project_name.trim()) {
      setError("Enter a project name.");
      return;
    }

    setCreatingProject(true);
    try {
      const result = await apiRequest("/my-projects", {
        method: "POST",
        body: JSON.stringify({
          project_name: newProject.project_name.trim(),
          project_code: newProject.project_code.trim(),
          description: newProject.description.trim(),
          start_date: newProject.start_date || null,
          end_date: newProject.end_date || null,
        }),
      });

      const projectId = Number(result.project_id || result.project?.project_id);
      if (!projectId) throw new Error("Project was created but the API did not return its ID.");

      await loadData();
      setDayEntries((current) => {
        let selected = false;
        const next = current.map((entries, dayIndex) => {
          if (selected) return entries;
          const targetIndex = entries.findIndex((entry) => !entry.projectId && Number(entry.hours) > 0);
          if (targetIndex >= 0) {
            selected = true;
            return entries.map((entry, index) => index === targetIndex ? { ...entry, projectId: String(projectId) } : entry);
          }
          if (dayIndex === 0 && entries.length === 1 && !entries[0].projectId) {
            selected = true;
            return [{ ...entries[0], projectId: String(projectId) }];
          }
          return entries;
        });
        return next;
      });
      setNewProject({ project_name: "", project_code: "", description: "", start_date: toISODate(new Date()), end_date: "" });
      setShowCreateProject(false);
      setNotice("Your project was created and assigned to your account. It is now available in each day's project selector.");
    } catch (err) {
      setError(err?.message || "Could not create your project.");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleSaveWeek = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!employeeId) {
      setError("Your employee ID could not be identified. Sign out and sign in again.");
      return;
    }

    const workItems = dayEntries.flatMap((entries, dayIndex) => entries.map((entry) => ({
      date: toISODate(days[dayIndex]),
      hours: Number(entry.hours || 0),
      projectId: String(entry.customActivity || "").trim() ? 0 : Number(entry.projectId || 0),
      customActivity: String(entry.customActivity || "").trim(),
      description: (entry.description || commonDescription || entry.customActivity || "Project work").trim(),
      dayIndex,
      rowId: entry.rowId,
    }))).filter((item) => item.hours > 0);

    if (!workItems.length) {
      setError("Enter hours for at least one project before saving.");
      return;
    }

    const missingAssignment = workItems.find((item) => !item.projectId && !item.customActivity);
    if (missingAssignment) {
      setError(`Choose a project or type a custom activity for ${formatDate(days[missingAssignment.dayIndex])}, entry ${dayEntries[missingAssignment.dayIndex].findIndex((entry) => entry.rowId === missingAssignment.rowId) + 1}.`);
      return;
    }

    if (workItems.some((item) => item.hours > 24 || item.hours < 0)) {
      setError("Each project entry must be between 0 and 24 hours.");
      return;
    }

    const overbookedDay = days.findIndex((day, dayIndex) =>
      dayEntries[dayIndex].reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0) > 24
    );
    if (overbookedDay >= 0) {
      setError(`${formatDate(days[overbookedDay])} has more than 24 total hours. Adjust the project entries for that day.`);
      return;
    }

    const duplicateProject = workItems.find((item, index) =>
      workItems.some((other, otherIndex) => otherIndex !== index && other.date === item.date && other.projectId === item.projectId)
    );
    if (duplicateProject) {
      setError(`The same project is listed more than once on ${formatDate(days[duplicateProject.dayIndex])}. Keep one row per project per day and combine its hours.`);
      return;
    }

    const duplicateExisting = workItems.find((item) =>
      (recordsByDate.get(item.date) || []).some((record) => {
        const projectId = myAssignments.find((assignment) => Number(assignment.assignment_id) === Number(record.assignment_id))?.project_id;
        return Number(projectId) === item.projectId;
      })
    );
    if (duplicateExisting) {
      setError(`An entry already exists for one of the selected projects on ${formatDate(days[duplicateExisting.dayIndex])}. Check the saved-timesheets table below before adding it again.`);
      return;
    }

    setSaving(true);
    let saved = 0;
    const failed = [];
    const availableAssignments = [...myAssignments];

    try {
      for (const item of workItems) {
        try {
          let assignment;
          let projectId = item.projectId;

          if (item.customActivity) {
            // timesheets.assignment_id is NOT NULL, so represent a free-text
            // activity as an employee-owned project/assignment in the schema.
            const customResult = await apiRequest("/my-projects", {
              method: "POST",
              body: JSON.stringify({
                project_name: item.customActivity,
                project_code: "",
                description: `Personal activity entered from timesheet: ${item.customActivity}`,
                start_date: item.date,
                end_date: null,
              }),
            });
            const assignmentId = Number(customResult.assignment_id || customResult.assignment?.assignment_id);
            projectId = Number(customResult.project_id || customResult.project?.project_id);
            if (!assignmentId || !projectId) {
              throw new Error("The API did not return the new activity's project and assignment IDs. Check the /api/my-projects backend route.");
            }
            assignment = { assignment_id: assignmentId, project_id: projectId, employee_id: employeeId, assignment_status: "ASSIGNED" };
            availableAssignments.push(assignment);
          } else {
            assignment = availableAssignments.find(
              (entry) => Number(entry.project_id) === projectId
            );
            if (!assignment) {
              const assignmentResult = await apiRequest("/my-project-assignments", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId }),
              });
              assignment = {
                assignment_id: assignmentResult.assignment_id,
                project_id: projectId,
                employee_id: employeeId,
                assignment_status: "ASSIGNED",
              };
              availableAssignments.push(assignment);
            }
          }

          await apiRequest("/timesheets", {
            method: "POST",
            body: JSON.stringify({
              assignment_id: Number(assignment.assignment_id),
              employee_id: employeeId,
              work_date: item.date,
              hours_worked: item.hours,
              work_description: item.description,
            }),
          });
          saved += 1;
        } catch (err) {
          failed.push(`${item.date}: ${err?.message || "save failed"}`);
        }
      }

      await loadData();
      if (failed.length) {
        setError(`${saved} day(s) saved. ${failed.length} day(s) could not be saved: ${failed.join(" | ")}`);
      } else {
        setNotice(`${saved} project entr${saved === 1 ? "y was" : "ies were"} submitted to your manager for approval. Total hours: ${workItems.reduce((sum, item) => sum + item.hours, 0).toFixed(1)} hours.`);
        setDayEntries(createWeekEntries(Array(7).fill(0)));
        setCommonDescription("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell timesheet-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Company Management home">
          <span className="brand-icon">C</span>
          <span className="brand-copy"><strong>Company</strong><strong>Management</strong></span>
        </a>

        <div className="nav-section">
          <p className="nav-heading">WORKSPACE</p>
          <nav className="sidebar-nav" aria-label="Workspace">
            <a className="nav-item" href="/"><span className="nav-icon">⌂</span><span>Overview</span></a>
            <a className="nav-item" href="/employees.html"><span className="nav-icon">♙</span><span>My Profile</span></a>
            <a className="nav-item active" href="/timesheets.html"><span className="nav-icon">◷</span><span>My Timesheets</span></a>
            <a className="nav-item" href="/approvals.html"><span className="nav-icon">✓</span><span>Pending approvals</span></a>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="connection-status"><span className="status-dot" /><span>Workspace connected</span></div>
          <span className="sidebar-footer-note">Personal timesheet workspace</span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="timesheet-breadcrumb">
            <span className="eyebrow">WORKSPACE</span>
            <span className="breadcrumb-divider">/</span>
            <strong>My timesheets</strong>
          </div>
          <div className="topbar-actions">
            <span className="api-status"><span className="status-dot" /> API ONLINE</span>
            <div className="user-menu">
              <span className="avatar">{getName(user).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div className="user-copy"><strong>{getName(user)}</strong><span>{user?.role_name || user?.role || "Employee"}</span></div>
              <button className="signout-button" type="button" onClick={onLogout}>Sign out</button>
            </div>
          </div>
        </header>

        <section className="dashboard">
          <div className="page-heading timesheet-heading">
            <div>
              <span className="eyebrow">WEEKLY TIME TRACKING</span>
              <h1>My timesheets</h1>
              <p>Split each day across multiple projects, apply a weekday template, and save the entire week in one go.</p>
            </div>
            <button className="secondary-button" type="button" onClick={loadData} disabled={loading}>↻ Refresh</button>
          </div>

          <div className="week-toolbar panel">
            <div className="week-navigation">
              <button className="week-arrow" type="button" onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label="Previous week">←</button>
              <div><strong>{weekKey}</strong><span>Week starting Monday</span></div>
              <button className="week-arrow" type="button" onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label="Next week">→</button>
              <button className="today-button" type="button" onClick={() => setWeekStart(mondayOf(new Date()))}>This week</button>
            </div>
            <div className="week-total"><span>PLANNED HOURS</span><strong>{totalHours.toFixed(1)} <small>hrs</small></strong></div>
          </div>

          {error && <div className="notice notice-error" role="alert"><div><strong>Could not complete that action</strong><p>{error}</p></div><button className="notice-dismiss" type="button" onClick={() => setError("")}>×</button></div>}
          {notice && <div className="notice notice-success" role="status"><div><strong>Week updated</strong><p>{notice}</p></div><button className="notice-dismiss" type="button" onClick={() => setNotice("")}>×</button></div>}

          <form onSubmit={handleSaveWeek}>
            <section className="panel week-entry-panel">
              <div className="panel-heading">
                <div><h2>1. Projects and work summary</h2><p>Add one or more project entries to each day. Each project can have its own hours and work note.</p></div>
                <div className="step-heading-actions">
                  <button className="secondary-button create-project-trigger" type="button" onClick={() => setShowCreateProject(true)}>＋ Create my project</button>
                  <span className="step-chip">STEP 1</span>
                </div>
              </div>
              <div className="timesheet-form-fields timesheet-summary-fields">
                <label className="field-group">
                  <span>Common work summary <b>*</b></span>
                  <input value={commonDescription} onChange={(event) => setCommonDescription(event.target.value)} placeholder="e.g. Engineering tasks, meetings, testing and documentation" />
                  <small className="field-help">Used for days without a custom note. You can override it for any day.</small>
                </label>
                <div className="assignment-help-card">
                  <span className="assignment-help-icon">◈</span>
                  <div><strong>Multiple projects per day</strong><span>Use the + Add project button on any day to split your time across projects. Choose existing projects or create your own.</span></div>
                </div>
              </div>
              {!loading && projects.length === 0 && <div className="no-assignments-warning">No active projects are available yet. Use “Create my project” to add one.</div>}
            </section>

            <section className="panel week-entry-panel day-panel">
              <div className="panel-heading">
                <div><h2>2. Enter hours for each day</h2><p>Apply a template, then change only the days that differ. Blank or zero-hour days are not saved.</p></div>
                <span className="step-chip">STEP 2</span>
              </div>
              <div className="range-fill-panel">
  <h3>Fill one project across multiple days</h3>
  <p>Choose a project and date range to populate the daily entries automatically.</p>

  <div className="range-fill-fields">
    <label>
      Project
      <select
        value={rangeFill.projectId}
        onChange={(event) =>
          setRangeFill((current) => ({
            ...current,
            projectId: event.target.value,
          }))
        }
      >
        <option value="">Choose project</option>
        {projects.map((project) => (
          <option
            key={project.project_id}
            value={String(project.project_id)}
          >
            {project.project_name}
          </option>
        ))}
      </select>
    </label>

    <label>
      From
      <input
        type="date"
        min={toISODate(days[0])}
        max={toISODate(days[6])}
        value={rangeFill.startDate}
        onChange={(event) =>
          setRangeFill((current) => ({
            ...current,
            startDate: event.target.value,
          }))
        }
      />
    </label>

    <label>
      To
      <input
        type="date"
        min={rangeFill.startDate || toISODate(days[0])}
        max={toISODate(days[6])}
        value={rangeFill.endDate}
        onChange={(event) =>
          setRangeFill((current) => ({
            ...current,
            endDate: event.target.value,
          }))
        }
      />
    </label>

    <label>
      Hours per day
      <input
        type="number"
        min="0.25"
        max="24"
        step="0.25"
        value={rangeFill.hours}
        onChange={(event) =>
          setRangeFill((current) => ({
            ...current,
            hours: event.target.value,
          }))
        }
      />
    </label>

    
  </div>

  <button
    type="button"
    className="primary-button range-fill-apply-button"
    onClick={applyProjectToDateRange}
    disabled={loading || saving || projects.length === 0}
  >
    Apply project to selected dates
  </button>
</div>
              <div className="template-toolbar">
                <span className="template-label">QUICK FILL</span>
                <button type="button" className="template-button" onClick={() => applyTemplate([8,8,8,8,8,0,0])}>Standard 8h weekdays</button>
                <button type="button" className="template-button" onClick={() => applyTemplate([7.5,7.5,7.5,7.5,7.5,0,0])}>7.5h weekdays</button>
                <button type="button" className="template-button" onClick={() => applyTemplate(Array(7).fill(0))}>Clear hours</button>
              </div>

              <div className="days-grid multi-project-days-grid">
                {days.map((day, index) => {
                  const dateKey = toISODate(day);
                  const dayHours = dayEntries[index].reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
                  return (
                    <div className={`day-card multi-project-day-card ${index > 4 ? "weekend" : ""}`} key={dateKey}>
                      <div className="day-card-header">
                        <span>{day.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                        <strong>{day.getDate()}</strong>
                        <small>{day.toLocaleDateString("en-IN", { month: "short" })}</small>
                      </div>
                      <div className="day-total-pill">{dayHours.toFixed(1)}h planned</div>
                      {dayEntries[index].map((entry, rowIndex) => (
                        <div className="project-entry-row" key={entry.rowId}>
                          <div className="project-entry-row-heading">
                            <span>Project {rowIndex + 1}</span>
                            {dayEntries[index].length > 1 && (
                              <button type="button" className="remove-project-row" onClick={() => removeDayEntry(index, entry.rowId)} aria-label={`Remove project ${rowIndex + 1} from ${formatDate(day)}`} title="Remove project">×</button>
                            )}
                          </div>
                          <label className="day-project-label" htmlFor={`project-${index}-${entry.rowId}`}>Project</label>
                          <select id={`project-${index}-${entry.rowId}`} className="day-project-select" value={entry.projectId} onChange={(event) => updateDayEntry(index, entry.rowId, "projectId", event.target.value)} aria-label={`${formatDate(day)} project ${rowIndex + 1}`} disabled={projects.length === 0}>
                            <option value="">Choose project</option>
                            {projects.map((item) => (
                              <option key={item.project_id} value={item.project_id}>
                                {item.project_name || `Project ${item.project_id || ""}`}
                                {item.project_code ? ` · ${item.project_code}` : ""}
                              </option>
                            ))}
                          </select>
                          <label className="day-description-label" htmlFor={`custom-activity-${index}-${entry.rowId}`}>Or type an activity <span>optional</span></label>
                          <input id={`custom-activity-${index}-${entry.rowId}`} className="day-description-input" value={entry.customActivity || ""} onChange={(event) => updateDayEntry(index, entry.rowId, "customActivity", event.target.value)} placeholder="e.g. Client meeting, sports" />
                          <small className="field-help">If entered, this is saved as your personal project for approval.</small>
                          <label className="hours-input-label" htmlFor={`hours-${index}-${entry.rowId}`}>Hours</label>
                          <input id={`hours-${index}-${entry.rowId}`} className="day-hours-input" type="number" min="0" max="24" step="0.25" value={entry.hours} onChange={(event) => updateDayEntry(index, entry.rowId, "hours", event.target.value)} aria-label={`${formatDate(day)} project ${rowIndex + 1} hours`} />
                          <label className="day-description-label" htmlFor={`description-${index}-${entry.rowId}`}>Work note <span>optional</span></label>
                          <input id={`description-${index}-${entry.rowId}`} className="day-description-input" value={entry.description} onChange={(event) => updateDayEntry(index, entry.rowId, "description", event.target.value)} placeholder="Use common summary" />
                        </div>
                      ))}
                      <button type="button" className="add-project-row-button" onClick={() => addDayEntry(index)}>＋ Add project</button>
                    </div>
                  );
                })}
              </div>

              <div className="week-summary-strip">
                <div><span>Hours entered</span><strong>{totalHours.toFixed(1)} hrs</strong></div>
                <div><span>Days with hours</span><strong>{daysWithHours} / 7</strong></div>
              </div>

              <div className="submit-week-row">
                <div className="save-hint"><span className="save-hint-icon">✓</span><span><strong>Submit for manager approval</strong><small>Submitting sends each project entry to your assigned manager. Approved entries are locked.</small></span></div>
                <button className="primary-button save-week-button" type="submit" disabled={saving || loading || totalHours <= 0}>
                  {saving ? "Submitting week…" : `Submit ${plannedEntries} entr${plannedEntries === 1 ? "y" : "ies"}`}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          </form>

          <section className="panel recent-week-panel">
            <div className="panel-heading">
              <div><h2>3. Saved timesheets</h2><p>Submitted and reviewed entries appear here, separately from the editable daily cards above.</p></div>
              <span className="records-count">{weekRecords.length} {weekRecords.length === 1 ? "entry" : "entries"}</span>
            </div>
            {loading ? <p className="empty-state">Loading your timesheets…</p> : weekRecords.length === 0 ? (
              <p className="empty-state">No entries for this week yet. Use the weekly form above to add your hours.</p>
            ) : (
              <div className="table-scroll"><table className="timesheet-table">
                <thead><tr><th>DATE</th><th>PROJECT</th><th>WORK SUMMARY</th><th>HOURS</th><th>STATUS</th><th>REVIEWED BY</th></tr></thead>
                <tbody>{weekRecords.map((record, index) => (
                  <tr key={record.timesheet_id || `${record.work_date}-${record.assignment_id}-${index}`}>
                    <td>{String(record.work_date || "").slice(0,10)}</td>
                    <td><strong>{record.project_name || `Assignment #${record.assignment_id}`}</strong></td>
                    <td>{record.work_description || "—"}</td>
                    <td><strong>{Number(record.hours_worked || 0).toFixed(2)}</strong></td>
                    <td><span className={`timesheet-status status-${statusOf(record).toLowerCase()}`}>{statusOf(record)}</span>{record.review_comment && <small className="review-comment">{record.review_comment}</small>}</td>
                    <td>{record.reviewer_name || record.reviewed_by_name || (statusOf(record) === "APPROVED" ? "Manager" : "—")}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </section>

          <section className="panel timesheet-calendar-panel">
            <div className="panel-heading calendar-panel-heading">
              <div><span className="eyebrow">MONTHLY OVERVIEW</span><h2>Timesheet calendar</h2><p>See which days are filled, waiting for approval, approved, or missing hours.</p></div>
              <div className="calendar-month-controls">
                <button type="button" className="calendar-nav-button" aria-label="Previous month" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button>
                <strong>{monthLabel}</strong>
                <button type="button" className="calendar-nav-button" aria-label="Next month" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button>
                <button type="button" className="calendar-today-button" onClick={() => { const now = new Date(); setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedCalendarDate(toISODate(now)); }}>Today</button>
              </div>
            </div>
            <div className="timesheet-calendar-content">
              <div className="calendar-legend">
                <span><i className="legend-dot legend-approved" /> Approved</span>
                <span><i className="legend-dot legend-submitted" /> Submitted</span>
                <span><i className="legend-dot legend-rejected" /> Rejected</span>
                <span><i className="legend-dot legend-missing" /> No hours logged</span>
              </div>
              <div className="timesheet-calendar-grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
                {calendarDays.map((date) => {
                  const iso = toISODate(date);
                  const inMonth = date.getMonth() === calendarMonth.getMonth();
                  const items = calendarEntriesByDate.get(iso) || [];
                  const status = calendarStatus(date);
                  const hours = items.reduce((sum, item) => sum + (Number(item.hours_worked) || 0), 0);
                  return (
                    <button type="button" key={iso} className={`calendar-day calendar-day-${status}${inMonth ? '' : ' calendar-day-outside'}${selectedCalendarDate === iso ? ' calendar-day-selected' : ''}`} onClick={() => setSelectedCalendarDate(iso)} aria-pressed={selectedCalendarDate === iso} title={`${iso}${items.length ? ` · ${hours.toFixed(2)} hours` : ' · no timesheet entries'}`}>
                      <span className="calendar-day-number">{date.getDate()}</span>
                      {items.length > 0 ? <><strong>{hours.toFixed(1)}h</strong><small>{items.length} {items.length === 1 ? 'entry' : 'entries'}</small></> : status === 'missing' && inMonth ? <small className="calendar-missing-label">No hours</small> : <small className="calendar-empty-label">&nbsp;</small>}
                    </button>
                  );
                })}
              </div>
              <div className="calendar-day-details">
                <div className="calendar-selected-heading"><div><span className="eyebrow">SELECTED DAY</span><h3>{new Date(`${selectedCalendarDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3></div><span className="records-count">{calendarSelectedRecords.length} {calendarSelectedRecords.length === 1 ? 'entry' : 'entries'}</span></div>
                {calendarSelectedRecords.length === 0 ? <p className="empty-state">No timesheet entries for this date. Select another day or add hours using the weekly form above.</p> : <div className="calendar-entry-list">{calendarSelectedRecords.map((record, index) => <div className="calendar-entry-row" key={record.timesheet_id || `${selectedCalendarDate}-${index}`}><div className="calendar-entry-main"><strong>{record.project_name || record.project_name_snapshot || `Assignment #${record.assignment_id}`}</strong><span>{record.work_description || 'No work summary added'}</span></div><strong className="calendar-entry-hours">{Number(record.hours_worked || 0).toFixed(2)}h</strong><span className={`timesheet-status status-${statusOf(record).toLowerCase()}`}>{statusOf(record)}</span></div>)}</div>}
              </div>
            </div>
          </section>

          {showCreateProject && (
            <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => {
              if (event.target === event.currentTarget && !creatingProject) setShowCreateProject(false);
            }}>
              <section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
                <div className="project-modal-header">
                  <div><span className="eyebrow">PERSONAL WORKSPACE</span><h2 id="create-project-title">Create your project</h2><p>It will be added to the project list and linked to your employee account.</p></div>
                  <button type="button" className="modal-close" onClick={() => setShowCreateProject(false)} disabled={creatingProject} aria-label="Close">×</button>
                </div>
                <form className="project-modal-form" onSubmit={handleCreateProject}>
                  <label className="field-group"><span>Project name <b>*</b></span><input autoFocus required maxLength={150} value={newProject.project_name} onChange={(event) => setNewProject((current) => ({ ...current, project_name: event.target.value }))} placeholder="e.g. Internal automation" /></label>
                  <label className="field-group"><span>Project code <small>optional</small></span><input maxLength={50} value={newProject.project_code} onChange={(event) => setNewProject((current) => ({ ...current, project_code: event.target.value.toUpperCase() }))} placeholder="Auto-generated if blank" /></label>
                  <label className="field-group project-description-field"><span>Description</span><textarea rows="3" maxLength={1000} value={newProject.description} onChange={(event) => setNewProject((current) => ({ ...current, description: event.target.value }))} placeholder="What are you working on?" /></label>
                  <div className="project-date-grid">
                    <label className="field-group"><span>Start date</span><input type="date" value={newProject.start_date} onChange={(event) => setNewProject((current) => ({ ...current, start_date: event.target.value }))} /></label>
                    <label className="field-group"><span>End date <small>optional</small></span><input type="date" min={newProject.start_date || undefined} value={newProject.end_date} onChange={(event) => setNewProject((current) => ({ ...current, end_date: event.target.value }))} /></label>
                  </div>
                  <div className="project-modal-footer"><button type="button" className="secondary-button" onClick={() => setShowCreateProject(false)} disabled={creatingProject}>Cancel</button><button type="submit" className="primary-button" disabled={creatingProject || !newProject.project_name.trim()}>{creatingProject ? "Creating project…" : "Create project"} <span aria-hidden="true">→</span></button></div>
                </form>
              </section>
            </div>
          )}

          <footer className="dashboard-footer"><span>Company Management</span><span>Weekly time tracking · Signed in as {getName(user)}</span></footer>
        </section>
      </main>
    </div>
  );
}
