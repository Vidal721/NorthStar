import { useEffect, useState } from "react";
import { useURL } from "../urlConfig";

export default function LeadershipManager() {
  const apiUrl = useURL();
  const actor = localStorage.getItem("currentUser") || "";
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [subgroups, setSubgroups] = useState([]);
  const [newSubgroup, setNewSubgroup] = useState("");
  const roleOptions = [
    ["students", "Student"],
    ["scouter", "Scouter"],
    ["programmer", "Programmer"],
    ["family", "Family"],
    ["helper", "Helper"],
    ["Mentor", "Mentor"],
    ["coach", "Coach"],
    ["admin", "Admin"],
  ];
  const isAdmin =
    String(localStorage.getItem("userRole") || "").toLowerCase() === "admin";

  const loadUsers = async () => {
    try {
      const res = await fetch(
        `${apiUrl}/leadership/users?actor=${encodeURIComponent(actor)}`,
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Could not load team members.");
      setUsers(data);
      const groups = await fetch(`${apiUrl}/subgroups`);
      setSubgroups(await groups.json());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => {
    loadUsers();
  }, []);

  const addSubgroup = async (event) => {
    event.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/subgroups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, name: newSubgroup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubgroups((items) => [...items, data.name].sort());
      setNewSubgroup("");
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteSubgroup = async (subgroup) => {
    if (
      !window.confirm(
        `Delete ${subgroup}, its Drive folder, and all of its contents?`,
      )
    )
      return;
    try {
      const res = await fetch(
        `${apiUrl}/subgroups/${encodeURIComponent(subgroup)}?actor=${encodeURIComponent(actor)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubgroups((items) => items.filter((item) => item !== subgroup));
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveLeader = async (user, subgroup) => {
    const current = user.leadershipSubgroups || [];
    const next = current.includes(subgroup)
      ? current.filter((item) => item !== subgroup)
      : [...current, subgroup];
    setSaving(`${user.username}-${subgroup}`);
    try {
      const res = await fetch(
        `${apiUrl}/leadership/users/${encodeURIComponent(user.username)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor, leadershipSubgroups: next }),
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Could not update leader access.");
      setUsers((items) =>
        items.map((item) => (item.username === data.username ? data : item)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  };

  const assignMemberSubgroup = async (user, subgroup) => {
    try {
      const res = await fetch(
        `${apiUrl}/leadership/users/${encodeURIComponent(user.username)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor,
            subgroup,
            leadershipSubgroups: user.leadershipSubgroups || [],
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers((items) =>
        items.map((item) => (item.username === data.username ? data : item)),
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const changeRole = async (user, role) => {
    setSaving(`${user.username}-role`);
    try {
      const res = await fetch(
        `${apiUrl}/leadership/users/${encodeURIComponent(user.username)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor,
            role,
            leadershipSubgroups: user.leadershipSubgroups || [],
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update role.");
      setUsers((items) =>
        items.map((item) => (item.username === data.username ? data : item)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  };

  return (
    <section className="leadership-manager">
      {isAdmin && (
        <div className="subgroup-delete-list">
          {subgroups.map((group) => (
            <button key={group} onClick={() => deleteSubgroup(group)}>
              Delete {group}
            </button>
          ))}
        </div>
      )}
      <form className="subgroup-create-form" onSubmit={addSubgroup}>
        <input
          value={newSubgroup}
          onChange={(event) => setNewSubgroup(event.target.value)}
          placeholder="New subgroup name"
          required
        />
        <button>Add subgroup</button>
      </form>
      <div className="forms-toolbar">
        <h1>Subgroup leaders</h1>

        <p className="leadership-intro">
          Leaders can upload, create folders, and delete files only within their
          assigned subgroup. Coaches and admins have team-wide Drive access.
        </p>
      </div>
      {error && <p className="drive-error">{error}</p>}
      <div className="leadership-list">
        {users.map((user) => (
          <div className="leadership-row" key={user.username}>
            <div>
              <strong>{user.username}</strong>
              <span>{user.role}</span>
              <select
                className="member-subgroup-select"
                value={user.subgroup || ""}
                onChange={(event) =>
                  assignMemberSubgroup(user, event.target.value)
                }
              >
                <option value="">No subgroup</option>
                {subgroups.map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </select>
              {isAdmin && (
                <select
                  className="member-role-select"
                  value={user.role || "students"}
                  disabled={Boolean(saving)}
                  onChange={(event) => changeRole(user, event.target.value)}
                  aria-label={`Change ${user.username}'s role`}
                >
                  {roleOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="leadership-toggles">
              <details className="leadership-access-menu">
                <summary>
                  Drive folder access ({(user.leadershipSubgroups || []).length})
                </summary>
                <div className="leadership-access-options">
              {subgroups.map((group) => (
                <label key={group}>
                  <input
                    type="checkbox"
                    checked={(user.leadershipSubgroups || []).includes(group)}
                    disabled={Boolean(saving)}
                    onChange={() => saveLeader(user, group)}
                  />
                  {group}
                  {saving === `${user.username}-${group}` ? "…" : ""}
                </label>
              ))}
                </div>
              </details>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
