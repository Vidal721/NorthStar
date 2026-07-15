import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";

export default function TasksPanel() {
  const api = useURL();
  const actor = localStorage.getItem("currentUser") || "";
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [assignee, setAssignee] = useState("");

  const load = async () => {
    try {
      const [tasksRes, peopleRes] = await Promise.all([
        fetch(`${api}/tasks?actor=${encodeURIComponent(actor)}`),
        fetch(`${api}/directory?actor=${encodeURIComponent(actor)}`),
      ]);
      const taskData = await tasksRes.json();
      if (!tasksRes.ok) throw new Error(taskData.error);
      setTasks(taskData);
      setUsers(await peopleRes.json());
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch(`${api}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor,
          title: form.get("title"),
          description: form.get("description"),
          assignee,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      event.currentTarget.reset();
      setAssigneeQuery("");
      setAssignee("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const complete = async (task) => {
    const res = await fetch(`${api}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor,
        status: task.status === "complete" ? "open" : "complete",
      }),
    });
    if (res.ok) {
      const updatedTask = await res.json();
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updatedTask : item)),
      );
      if (updatedTask.status === "complete") {
        setTimeout(() => {
          setTasks((current) =>
            current.filter(
              (item) =>
                item.id !== updatedTask.id ||
                item.status !== "complete" ||
                item.completed_at !== updatedTask.completed_at,
            ),
          );
        }, 30 * 1000);
      }
    }
  };

  const matchingUsers = users.filter((user) => {
    const query = assigneeQuery.trim().toLowerCase();
    return (
      !query ||
      user.username.toLowerCase().includes(query) ||
      user.subgroup?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    );
  });

  return (
    <section className="tasks-panel">
      <div className="tasks-header">
        <div>
          <h2>Tasks</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}>
          <FontAwesomeIcon icon={faPlus} /> Assign task
        </button>
      </div>
      {error && <p className="drive-error">{error}</p>}
      {showForm && (
        <form className="task-form" onSubmit={create}>
          <input name="title" required placeholder="Task title" />
          <textarea name="description" placeholder="Details (optional)" />
          <div className="task-assignee-picker">
            <label htmlFor="task-assignee-search">Assign to</label>
            <input
              id="task-assignee-search"
              value={assigneeQuery}
              onChange={(event) => {
                setAssigneeQuery(event.target.value);
                setAssignee("");
              }}
              placeholder="Search people by name, subgroup, or role"
              autoComplete="off"
              required={!assignee}
            />
            {assignee && (
              <p className="task-selected-assignee">
                Assigning to <strong>{assignee}</strong>
                <button
                  type="button"
                  onClick={() => {
                    setAssignee("");
                    setAssigneeQuery("");
                  }}
                >
                  Change
                </button>
              </p>
            )}
            {!assignee && assigneeQuery && (
              <div className="task-person-results" role="listbox" aria-label="People">
                {matchingUsers.length ? (
                  matchingUsers.map((user) => (
                    <button
                      type="button"
                      role="option"
                      key={user.username}
                      onClick={() => {
                        setAssignee(user.username);
                        setAssigneeQuery(user.username);
                      }}
                    >
                      <strong>{user.username}</strong>
                      <span>{user.subgroup || user.role}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-muted">No matching people.</p>
                )}
              </div>
            )}
          </div>
          <button type="submit" disabled={!assignee}>Create task</button>
        </form>
      )}
      <div className="tasks-list">
        {tasks.length ? (
          tasks.map((task) => (
            <div className={`task-row ${task.status}`} key={task.id}>
              <button
                onClick={() => complete(task)}
                aria-label="Toggle task complete"
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
              <div>
                <strong>{task.title}</strong>
                {task.description && <p>{task.description}</p>}
                <span>
                  {task.assignee || task.subgroup} · assigned by {task.assigned_by}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted">No tasks assigned to you yet.</p>
        )}
      </div>
    </section>
  );
}
