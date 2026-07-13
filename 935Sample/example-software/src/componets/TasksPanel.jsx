import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";

export default function TasksPanel() {
  const api = useURL();
  const actor = localStorage.getItem("currentUser") || "";
  const [tasks, setTasks] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      const [tasksRes, groupsRes, peopleRes] = await Promise.all([
        fetch(`${api}/tasks?actor=${encodeURIComponent(actor)}`),
        fetch(`${api}/subgroups`),
        fetch(`${api}/directory?actor=${encodeURIComponent(actor)}`),
      ]);
      const taskData = await tasksRes.json();
      if (!tasksRes.ok) throw new Error(taskData.error);
      setTasks(taskData);
      setSubgroups(await groupsRes.json());
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
          subgroup: form.get("subgroup"),
          assignee: form.get("assignee"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      event.currentTarget.reset();
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
    if (res.ok) load();
  };
  return (
    <section className="tasks-panel">
      <div className="tasks-header">
        <div>
          <span className="scout-overline">Team work</span>
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
          <select name="subgroup" required defaultValue="">
            <option value="" disabled>
              Assign to subgroup
            </option>
            {subgroups.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </select>
          <select name="assignee" defaultValue="">
            <option value="">Whole subgroup</option>
            {users.map((user) => (
              <option key={user.username} value={user.username}>
                {user.username} · {user.subgroup || user.role}
              </option>
            ))}
          </select>
          <button type="submit">Create task</button>
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
                  {task.assignee || task.subgroup} · assigned by{" "}
                  {task.assigned_by}
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
