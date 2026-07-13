import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faFile,
  faFolder,
  faHardDrive,
  faPlus,
  faTrash,
  faX,
} from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";

export default function DriveView() {
  const apiUrl = useURL();
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const userHeaders = { "x-drive-user": localStorage.getItem("currentUser") || "" };

  const loadDrive = async (directory = "") => {
    try {
      const res = await fetch(`${apiUrl}/drive?path=${encodeURIComponent(directory)}`, { headers: userHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load Drive.");
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setCanWrite(Boolean(data.permissions?.canWrite));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadDrive("");
  }, []);

  const upload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${apiUrl}/upload?path=${encodeURIComponent(currentPath)}`, {
        method: "POST",
        body: formData,
        headers: userHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed.");
      await loadDrive(currentPath);
    } catch (err) {
      setError(err.message);
    }
  };

  const createFolder = async () => {
    const name = window.prompt("Folder name");
    if (!name) return;
    try {
      const res = await fetch(`${apiUrl}/folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...userHeaders },
        body: JSON.stringify({ name, path: currentPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not create folder.");
      await loadDrive(currentPath);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteFile = async (file) => {
    if (!window.confirm(`Delete ${file}? This cannot be undone.`)) return;
    const itemPath = currentPath ? `${currentPath}/${file}` : file;
    try {
      const res = await fetch(`${apiUrl}/drive/file?path=${encodeURIComponent(itemPath)}`, {
        method: "DELETE",
        headers: userHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete file.");
      await loadDrive(currentPath);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteFolder = async (folder) => {
    if (!window.confirm(`Delete ${folder} and everything inside it? This cannot be undone.`)) return;
    const itemPath = currentPath ? `${currentPath}/${folder}` : folder;
    try {
      const res = await fetch(`${apiUrl}/drive/folder?path=${encodeURIComponent(itemPath)}`, {
        method: "DELETE", headers: userHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete folder.");
      await loadDrive(currentPath);
    } catch (err) { setError(err.message); }
  };

  const openFolder = (folder) => {
    const nextPath = currentPath ? `${currentPath}/${folder}` : folder;
    setCurrentPath(nextPath);
    loadDrive(nextPath);
  };

  const goBack = () => {
    const previousPath = currentPath.split("/").slice(0, -1).join("/");
    setCurrentPath(previousPath);
    loadDrive(previousPath);
  };

  return (
    <section className="drive-view">
      <div className="drive-appbar">
        <div className="drive-brand"><FontAwesomeIcon icon={faHardDrive} /><span>Team Drive</span></div>
        <div className="drive-appbar-actions">
          {canWrite && (
          <button className="drive-new-button" onClick={() => setIsMenuOpen((open) => !open)}>
            <FontAwesomeIcon icon={isMenuOpen ? faX : faPlus} /> New
          </button>
          )}
        </div>
      </div>
      <div className="drive-main">
        <div className="drive-breadcrumbs">
          <button onClick={() => { setCurrentPath(""); loadDrive(""); }}>My Drive</button>
          {currentPath.split("/").filter(Boolean).map((segment, index, pieces) => (
            <span key={`${segment}-${index}`}><span className="drive-crumb-divider">/</span><button onClick={() => { const next = pieces.slice(0, index + 1).join("/"); setCurrentPath(next); loadDrive(next); }}>{segment}</button></span>
          ))}
        </div>
        <div className="drive-section-title">{currentPath ? currentPath.split("/").at(-1) : "Files"}</div>
      {error && <p className="drive-error" role="alert">{error}</p>}
      <div id="drive-content-all">
        {currentPath && (
          <button onClick={goBack} id="drive-back-btn" aria-label="Back to parent folder">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
        )}
        {canWrite && <button onClick={() => setIsMenuOpen((open) => !open)} id="drive-upload-btn" aria-label="Drive actions">
          <FontAwesomeIcon icon={isMenuOpen ? faX : faPlus} />
        </button>}
        {canWrite && isMenuOpen && (
          <div id="drive-upload-div">
            <label htmlFor="drive-file-upload" className="custom-file-upload">Upload</label>
            <input id="drive-file-upload" type="file" onChange={(event) => upload(event.target.files[0])} />
            <button onClick={createFolder} className="custom-file-upload">New Folder</button>
          </div>
        )}
        {folders.map((folder) => (
          <div key={folder} className="drive-content folder drive-folder-card">
            <button onClick={() => openFolder(folder)} className="drive-folder-open drive-item-button">
            <span className="drive-content-logo"><FontAwesomeIcon icon={faFolder} /></span>
            <span className="drive-content-text">{folder}</span>
            </button>
            {canWrite && <button className="drive-delete-btn" onClick={() => deleteFolder(folder)} aria-label={`Delete ${folder}`} title="Delete folder"><FontAwesomeIcon icon={faTrash} /></button>}
          </div>
        ))}
        {files.map((file) => (
          <div key={file} className="drive-content file drive-file-card">
            <div className="drive-content-logo"><FontAwesomeIcon icon={faFile} /></div>
            <div className="drive-content-text">{file}</div>
            {canWrite && <button className="drive-delete-btn" onClick={() => deleteFile(file)} aria-label={`Delete ${file}`} title="Delete file">
              <FontAwesomeIcon icon={faTrash} />
            </button>}
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}
