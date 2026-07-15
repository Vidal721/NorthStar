import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faDownload,
  faFile,
  faFolder,
  faHardDrive,
  faPlus,
  faTrash,
  faX,
} from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";
import ModelViewer from "./ModelViewer";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov", "m4v"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];
const PDF_EXTENSIONS = ["pdf"];
const MODEL_EXTENSIONS = ["stl", "obj", "ply", "gltf", "glb", "step", "stp", "iges", "igs", "brep"];
const TEXT_EXTENSIONS = [
  "txt", "md", "csv", "json", "xml", "html", "css", "js", "jsx", "ts", "tsx", "log",
];

const getExtension = (name) => name.split(".").pop()?.toLowerCase() || "";

const isImageFile = (name) => {
  return IMAGE_EXTENSIONS.includes(getExtension(name));
};

const getPreviewType = (name) => {
  const ext = getExtension(name);
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (PDF_EXTENSIONS.includes(ext)) return "pdf";
  if (MODEL_EXTENSIONS.includes(ext)) return "model";
  if (TEXT_EXTENSIONS.includes(ext)) return "text";
  return "document";
};

export default function DriveView() {
  const apiUrl = useURL();
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [imagePreviews, setImagePreviews] = useState({});
  const [previewFile, setPreviewFile] = useState(null);
  const userHeaders = {
    "x-drive-user": localStorage.getItem("currentUser") || "",
  };

  const loadDrive = async (directory = "") => {
    try {
      const res = await fetch(
        `${apiUrl}/drive?path=${encodeURIComponent(directory)}`,
        { headers: userHeaders },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load Drive.");
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setCanWrite(Boolean(data.permissions?.canWrite));
      setError("");
      loadImagePreviews(directory, data.files || []);
    } catch (err) {
      setError(err.message);
    }
  };

  // Fetch thumbnail data for any image files in the current folder and
  // replace whatever preview URLs were being held for the previous folder.
  const loadImagePreviews = async (directory, fileList) => {
    setImagePreviews((previous) => {
      Object.values(previous).forEach((url) => URL.revokeObjectURL(url));
      return {};
    });

    const imageFiles = fileList.filter(isImageFile);
    await Promise.all(
      imageFiles.map(async (file) => {
        const itemPath = directory ? `${directory}/${file}` : file;
        try {
          const res = await fetch(
            `${apiUrl}/drive/file?path=${encodeURIComponent(itemPath)}`,
            { headers: userHeaders },
          );
          if (!res.ok) return;
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          setImagePreviews((previous) => ({
            ...previous,
            [file]: objectUrl,
          }));
        } catch {
          // Skip files that fail to load a preview; the file icon is shown instead.
        }
      }),
    );
  };

  useEffect(() => {
    loadDrive("");
    // Revoke any outstanding object URLs when the component unmounts.
    return () => {
      setImagePreviews((previous) => {
        Object.values(previous).forEach((url) => URL.revokeObjectURL(url));
        return previous;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(
        `${apiUrl}/upload?path=${encodeURIComponent(currentPath)}`,
        {
          method: "POST",
          body: formData,
          headers: userHeaders,
        },
      );
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
      const res = await fetch(
        `${apiUrl}/drive/file?path=${encodeURIComponent(itemPath)}`,
        {
          method: "DELETE",
          headers: userHeaders,
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete file.");
      if (previewFile?.name === file) closePreview();
      await loadDrive(currentPath);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteFolder = async (folder) => {
    if (
      !window.confirm(
        `Delete ${folder} and everything inside it? This cannot be undone.`,
      )
    )
      return;
    const itemPath = currentPath ? `${currentPath}/${folder}` : folder;
    try {
      const res = await fetch(
        `${apiUrl}/drive/folder?path=${encodeURIComponent(itemPath)}`,
        {
          method: "DELETE",
          headers: userHeaders,
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete folder.");
      await loadDrive(currentPath);
    } catch (err) {
      setError(err.message);
    }
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

  const fileUrl = (file, download = false) => {
    const itemPath = currentPath ? `${currentPath}/${file}` : file;
    return `${apiUrl}/drive/file?path=${encodeURIComponent(itemPath)}${download ? "&download=1" : ""}`;
  };

  const openPreview = async (file) => {
    const type = getPreviewType(file);
    const url = fileUrl(file);
    try {
      const res = await fetch(url, { headers: userHeaders });
      if (!res.ok) throw new Error("Could not load file preview.");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPreviewFile((previous) => {
        if (previous?.url) URL.revokeObjectURL(previous.url);
        return { name: file, type, url: objectUrl };
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const closePreview = () => {
    if (previewFile?.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const downloadFile = async (file) => {
    try {
      const res = await fetch(fileUrl(file, true), { headers: userHeaders });
      if (!res.ok) throw new Error("Could not download file.");
      const objectUrl = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="drive-view">
      <div className="drive-appbar">
        <div className="drive-brand">
          <FontAwesomeIcon icon={faHardDrive} />
          <span>Team Drive</span>
        </div>
        <div className="drive-appbar-actions">
          {canWrite && (
            <button
              className="drive-new-button"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <FontAwesomeIcon icon={isMenuOpen ? faX : faPlus} /> New
            </button>
          )}
        </div>
      </div>
      <div className="drive-main">
        <div className="drive-breadcrumbs">
          <button
            onClick={() => {
              setCurrentPath("");
              loadDrive("");
            }}
          >
            Home
          </button>
          {currentPath
            .split("/")
            .filter(Boolean)
            .map((segment, index, pieces) => (
              <span key={`${segment}-${index}`}>
                <span className="drive-crumb-divider">/</span>
                <button
                  onClick={() => {
                    const next = pieces.slice(0, index + 1).join("/");
                    setCurrentPath(next);
                    loadDrive(next);
                  }}
                >
                  {segment}
                </button>
              </span>
            ))}
        </div>
        {error && (
          <p className="drive-error" role="alert">
            {error}
          </p>
        )}
        <div id="drive-content-all">
          {currentPath && (
            <button
              onClick={goBack}
              id="drive-back-btn"
              aria-label="Back to parent folder"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
          )}
          {canWrite && (
            <button
              onClick={() => setIsMenuOpen((open) => !open)}
              id="drive-upload-btn"
              aria-label="Drive actions"
            >
              <FontAwesomeIcon icon={isMenuOpen ? faX : faPlus} />
            </button>
          )}
          {canWrite && isMenuOpen && (
            <div id="drive-upload-div">
              <label htmlFor="drive-file-upload" className="custom-file-upload">
                Upload
              </label>
              <input
                id="drive-file-upload"
                type="file"
                onChange={(event) => upload(event.target.files[0])}
              />
              <button onClick={createFolder} className="custom-file-upload">
                New Folder
              </button>
            </div>
          )}
          {folders.map((folder) => (
            <div
              key={folder}
              className="drive-content folder drive-folder-card"
            >
              <button
                onClick={() => openFolder(folder)}
                className="drive-folder-open drive-item-button"
              >
                <span className="drive-content-logo">
                  <FontAwesomeIcon icon={faFolder} />
                </span>
                <span className="drive-content-text">{folder}</span>
              </button>
              {canWrite && (
                <button
                  className="drive-delete-btn"
                  onClick={() => deleteFolder(folder)}
                  aria-label={`Delete ${folder}`}
                  title="Delete folder"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              )}
            </div>
          ))}
          {files.map((file) => {
            const isImage = isImageFile(file);
            const previewUrl = imagePreviews[file];
            return (
              <div key={file} className="drive-content file drive-file-card">
                {isImage ? (
                  <button
                    className="drive-item-button drive-image-thumb-button"
                    onClick={() => openPreview(file)}
                    aria-label={`View ${file}`}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={file}
                        className="drive-content-logo drive-image-thumb"
                      />
                    ) : (
                      <span className="drive-content-logo">
                        <FontAwesomeIcon icon={faFile} />
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    className="drive-item-button drive-file-preview-button"
                    onClick={() => openPreview(file)}
                    aria-label={`Preview ${file}`}
                  >
                    <span className="drive-content-logo">
                      <FontAwesomeIcon icon={faFile} />
                    </span>
                  </button>
                )}
                <div className="drive-content-text">{file}</div>
                <button
                  type="button"
                  className="drive-download-btn"
                  onClick={() => downloadFile(file)}
                  aria-label={`Download ${file}`}
                  title="Download file"
                >
                  <FontAwesomeIcon icon={faDownload} />
                </button>
                {canWrite && (
                  <button
                    className="drive-delete-btn"
                    onClick={() => deleteFile(file)}
                    aria-label={`Delete ${file}`}
                    title="Delete file"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {previewFile && (
        <div
          className="drive-image-lightbox-overlay"
          onClick={closePreview}
        >
          <div
            className="drive-image-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="drive-image-lightbox-close"
              onClick={closePreview}
              aria-label="Close preview"
            >
              <FontAwesomeIcon icon={faX} />
            </button>
            <div className="drive-preview-body">
              {previewFile.type === "image" && <img src={previewFile.url} alt={previewFile.name} />}
              {previewFile.type === "video" && <video src={previewFile.url} controls autoPlay />}
              {previewFile.type === "audio" && <audio src={previewFile.url} controls autoPlay />}
              {previewFile.type === "pdf" && <iframe src={previewFile.url} title={previewFile.name} />}
              {previewFile.type === "text" && <iframe src={previewFile.url} title={previewFile.name} />}
              {previewFile.type === "model" && <ModelViewer sourceUrl={previewFile.url} fileName={previewFile.name} />}
              {previewFile.type === "document" && (
                <iframe src={previewFile.url} title={previewFile.name} />
              )}
            </div>
            {previewFile.type === "document" && (
              <p className="drive-preview-note">
                If this format is not previewed by your browser, download it to open it in the appropriate app.
              </p>
            )}
            <div className="drive-image-lightbox-caption">
              {previewFile.name}
              <button
                type="button"
                onClick={() => downloadFile(previewFile.name)}
                className="drive-preview-download"
              >
                <FontAwesomeIcon icon={faDownload} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
