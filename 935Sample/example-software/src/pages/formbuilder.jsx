import React, { useState, useEffect } from 'react';
import { getApiBaseUrl, getDefaultHeaders } from "../apiConfig";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHandFist,
  faPenToSquare,
  faCircleCheck,
  faHashtag,
  faTrash,
  faTriangleExclamation,
  faCircle,
  faShield,
  faRocket,
  faBomb,
  faHandPointRight,
  faCircleInfo,
  faFloppyDisk,
  faFileLines,
  faSquareCaretDown,
  faCircleDot,
  faSquareCheck,
  faDatabase,
} from "@fortawesome/free-solid-svg-icons";

const initialSchema = {
  id: "frc_2026_pit_scouting",
  title: "Rapid React Engine",
  event: "Silicon Valley Regional",
  sections: [
    {
      label: "Team Info",
      fields: [
        { id: "team_number", label: "Team Number", type: "number", placeholder: "e.g. 254", required: true }
      ]
    }
  ]
};

// ── Main Component ───────────────────────────────────────
export default function FormBuilder() {
  const [schema, setSchema] = useState(initialSchema);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [tab, setTab] = useState('editor');
  const [sectionDrawer, setSectionDrawer] = useState(false);
  const [metaDrawer, setMetaDrawer] = useState(false);
  const isMobile = useIsMobile();

  // Keep activeSectionIdx in bounds if sections are deleted
  const safeIdx = Math.min(activeSectionIdx, Math.max(0, schema.sections.length - 1));
  const activeSection = schema.sections[safeIdx];

  const handleMetaChange = (key, value) =>
    setSchema(prev => ({ ...prev, [key]: value }));

  const addSection = () => {
    const newIdx = schema.sections.length;
    setSchema(prev => ({ ...prev, sections: [...prev.sections, { label: 'New Section', fields: [] }] }));
    setActiveSectionIdx(newIdx);
  };

  const updateSectionLabel = (idx, label) =>
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) => i === idx ? { ...s, label } : s)
    }));

  const removeSection = (idx) => {
    if (schema.sections.length <= 1) return; // always keep at least one
    setSchema(prev => ({ ...prev, sections: prev.sections.filter((_, i) => i !== idx) }));
    setActiveSectionIdx(prev => Math.max(0, prev >= idx ? prev - 1 : prev));
  };

  const addField = (secIdx, type) => {
    const newField = {
      id: `${type}_${Date.now().toString().slice(-5)}`,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      type,
      required: false,
      ...(['select', 'radio', 'checkbox'].includes(type)
        ? { options: [{ value: 'option_1', label: 'Option 1' }, { value: 'option_2', label: 'Option 2' }] }
        : { placeholder: 'Enter value...' })
    };
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map((sec, i) =>
        i !== secIdx ? sec : { ...sec, fields: [...sec.fields, newField] }
      )
    }));
  };

  const updateField = (secIdx, fIdx, key, value) =>
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map((sec, i) =>
        i !== secIdx ? sec : {
          ...sec,
          fields: sec.fields.map((f, j) => j !== fIdx ? f : { ...f, [key]: value })
        }
      )
    }));

  const removeField = (secIdx, fIdx) =>
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map((sec, i) =>
        i !== secIdx ? sec : { ...sec, fields: sec.fields.filter((_, j) => j !== fIdx) }
      )
    }));

  const saveSchema = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`${getApiBaseUrl()}/pit/save`, {
        method: 'POST',
        headers: getDefaultHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(schema),
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 3000);
        return;
      }
    } catch {
      // status handled below
    }
    setSaveStatus('error');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const totalFields = schema.sections.reduce((a, s) => a + s.fields.length, 0);

  const saveBtnClass = `fb-btn ${
    saveStatus === 'saved' ? 'saved' : saveStatus === 'error' ? 'save-error' : 'primary'
  }`;

  return (
    <div className="fb-root">
      {/* Mobile drawers */}
      {isMobile && (
        <>
          <SectionDrawer
            sections={schema.sections}
            activeSectionIdx={safeIdx}
            onSelect={setActiveSectionIdx}
            onAdd={() => { addSection(); setSectionDrawer(false); }}
            open={sectionDrawer}
            onClose={() => setSectionDrawer(false)}
          />
          <MetaDrawer
            schema={schema}
            onChange={handleMetaChange}
            open={metaDrawer}
            onClose={() => setMetaDrawer(false)}
          />
        </>
      )}

      {/* Top bar */}
      <div className="fb-topbar">
        <div className="fb-topbar-left">
          {isMobile && (
            <button className="fb-btn icon" onClick={() => setSectionDrawer(true)} title="Sections">☰</button>
          )}
          <span className="fb-topbar-title">
            {isMobile ? 'Form Builder' : 'FRC Form Builder'}
          </span>
          {!isMobile && (
            <span className="fb-topbar-badge">
              <FontAwesomeIcon icon={faShield} style={{ marginRight: '6px' }} />
              {schema.sections.length} sections · {totalFields} fields
            </span>
          )}
        </div>

        <div className="fb-topbar-right">
          {isMobile && (
            <button className="fb-btn ghost fb-mobile-info-btn" onClick={() => setMetaDrawer(true)}>
              <FontAwesomeIcon icon={faCircleInfo} style={{ marginRight: '4px' }} /> Info
            </button>
          )}
          <div className="fb-tab-row">
            <button className={`fb-tab ${tab === 'editor' ? 'active' : ''}`} onClick={() => setTab('editor')}>
              <FontAwesomeIcon icon={faPenToSquare} style={{ marginRight: '6px' }} /> Editor
            </button>
            <button className={`fb-tab ${tab === 'json' ? 'active' : ''}`} onClick={() => setTab('json')}>
              <FontAwesomeIcon icon={faDatabase} style={{ marginRight: '6px' }} /> JSON
            </button>
          </div>
          <button
            className={`${saveBtnClass} ${isMobile ? 'fb-save-btn-mobile' : 'fb-save-btn-desktop'}`}
            onClick={saveSchema}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' && <FontAwesomeIcon icon={faBomb} spin style={{ marginRight: '6px' }} />}
            {saveStatus === 'saved' && <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: '6px' }} />}
            {saveStatus === 'error' && <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: '6px' }} />}
            {saveStatus === null && <FontAwesomeIcon icon={faFloppyDisk} style={{ marginRight: '6px' }} />}
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Save'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="fb-body">
        {tab === 'editor' ? (
          <>
            {/* Desktop sidebar */}
            {!isMobile && (
              <div className="fb-sidebar">
                <div className="fb-sidebar-header">Sections</div>
                <div className="fb-sidebar-list">
                  {schema.sections.map((sec, idx) => (
                    <button key={idx} className={`fb-sidebar-item${safeIdx === idx ? ' active' : ''}`} onClick={() => setActiveSectionIdx(idx)} >
                      <span className="fb-sidebar-item-label">
                        {sec.label || `Section ${idx + 1}`}
                      </span>
                      <span className="fb-sidebar-item-count">{sec.fields.length}</span>
                    </button>
                  ))}
                </div>
                <div className="fb-sidebar-footer">
                  <button className="fb-btn dashed fb-w-full" onClick={addSection}>
                    <FontAwesomeIcon icon={faCircleInfo} style={{ marginRight: '6px', transform: 'rotate(90deg)' }} /> + Section
                  </button>
                </div>
              </div>
            )}

            {/* Main editor */}
            <div className="fb-editor">
              {/* Desktop meta strip */}
              {!isMobile && (
                <div className="fb-meta-strip">
                  {[['id', 'Schema ID'], ['title', 'Form Title'], ['event', 'Event']].map(([key, lbl]) => (
                    <div key={key}>
                      <label className="fb-label">{lbl}</label>
                      <input type="text" className={`fb-input${key === 'id' ? ' mono' : ''}`} value={schema[key] || ''} onChange={e => handleMetaChange(key, e.target.value)} />
                    </div>
                  ))}
                </div>
              )}

              {/* Mobile section pills */}
              {isMobile && (
                <div className="fb-section-pills">
                  {schema.sections.map((sec, idx) => (
                    <button key={idx} className={`fb-section-pill${safeIdx === idx ? ' active' : ''}`} onClick={() => setActiveSectionIdx(idx)} >
                      {sec.label || `Section ${idx + 1}`}
                      <span className="fb-section-pill-count">{sec.fields.length}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeSection && (
                <>
                  {/* Section header */}
                  <div className={`fb-section-header${isMobile ? ' mobile' : ''}`}>
                    <div className="fb-flex-1">
                      <label className="fb-label">Section name</label>
                      <input type="text" className="fb-input section-title" value={activeSection.label} onChange={e => updateSectionLabel(safeIdx, e.target.value)} placeholder="e.g. Autonomous" />
                    </div>
                    <button className="fb-btn danger align-end" onClick={() => removeSection(safeIdx)} disabled={schema.sections.length <= 1}>
                      <FontAwesomeIcon icon={faTrash} style={{ marginRight: '6px' }} /> Delete Section
                    </button>
                  </div>

                  {/* Fields workspace */}
                  <div className="fb-fields-list">
                    {activeSection.fields.length === 0 ? (
                      <div className="fb-empty-state">
                        <div className="fb-empty-icon">
                          <FontAwesomeIcon icon={faShield} style={{ opacity: 0.5, fontSize: '2.5rem' }} />
                        </div>
                        <p>No fields in this section yet.</p>
                        <p className="fb-text-sm">Click any button below to add your first question.</p>
                      </div>
                    ) : (
                      activeSection.fields.map((field, fIdx) => (
                        <FieldEditor
                          key={field.id}
                          field={field}
                          fIdx={fIdx}
                          onUpdate={(k, v) => updateField(safeIdx, fIdx, k, v)}
                          onRemove={() => removeField(safeIdx, fIdx)}
                        />
                      ))
                    )}
                  </div>

                  {/* Add Field Toolbox */}
                  <div className="fb-toolbox">
                    <div className="fb-toolbox-title">Add Question Field</div>
                    <div className="fb-toolbox-grid">
                      {[
                        { type: 'text', icon: faFileLines, label: 'Short Text' },
                        { type: 'number', icon: faHashtag, label: 'Number Input' },
                        { type: 'select', icon: faSquareCaretDown, label: 'Dropdown Select' },
                        { type: 'radio', icon: faCircleDot, label: 'Radio Choice' },
                        { type: 'checkbox', icon: faSquareCheck, label: 'Checkbox Multiselect' }
                      ].map(b => (
                        <button key={b.type} className="fb-toolbox-btn" onClick={() => addField(safeIdx, b.type)}>
                          <span className="fb-toolbox-icon">
                            <FontAwesomeIcon icon={b.icon} />
                          </span>
                          <span>{b.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="fb-json-view">
            <div className="fb-json-toolbar">
              <button className="fb-btn dashed" onClick={() => navigator.clipboard.writeText(JSON.stringify(schema, null, 2))}>
                <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: '6px' }} /> Copy JSON Config
              </button>
            </div>
            <textarea className="fb-json-textarea" value={JSON.stringify(schema, null, 2)} readOnly />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Secondary Components ────────────────────────
function FieldEditor({ field, fIdx, onUpdate, onRemove }) {
  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type);

  const updateOption = (oIdx, key, val) => {
    const next = [...(field.options || [])];
    next[oIdx] = { ...next[oIdx], [key]: val };
    onUpdate('options', next);
  };

  const addOption = () => {
    const next = [...(field.options || [])];
    const nextNum = next.length + 1;
    next.push({ value: `option_${nextNum}`, label: `Option ${nextNum}` });
    onUpdate('options', next);
  };

  const removeOption = (oIdx) => {
    onUpdate('options', (field.options || []).filter((_, i) => i !== oIdx));
  };

  const getBadgeIcon = (type) => {
    switch (type) {
      case 'text': return faHandFist;
      case 'number': return faHashtag;
      case 'select': return faHandPointRight;
      case 'radio': return faCircle;
      case 'checkbox': return faCircleCheck;
      default: return faShield;
    }
  };

  return (
    <div className="fb-field-card">
      <div className="fb-field-card-row">
        <div className="fb-field-flex-info">
          <span className="fb-field-badge">
            <FontAwesomeIcon icon={getBadgeIcon(field.type)} style={{ marginRight: '5px' }} />
            {field.type.toUpperCase()}
          </span>
          <code className="fb-field-code-id">{field.id}</code>
        </div>
        <button className="fb-field-delete-icon" onClick={onRemove} title="Remove Field">
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>

      <div className="fb-field-inputs-grid">
        <div>
          <label className="fb-label">Question Label</label>
          <input type="text" className="fb-input" value={field.label} onChange={e => onUpdate('label', e.target.value)} />
        </div>
        {!hasOptions && (
          <div>
            <label className="fb-label">Placeholder Hint</label>
            <input type="text" className="fb-input" value={field.placeholder || ''} onChange={e => onUpdate('placeholder', e.target.value)} />
          </div>
        )}
      </div>

      <div className="fb-field-checkbox-row">
        <input type="checkbox" id={`req-${fIdx}`} checked={!!field.required} onChange={e => onUpdate('required', e.target.checked)} className="fb-cursor-pointer" />
        <label htmlFor={`req-${fIdx}`} className="fb-field-checkbox-label">Required field</label>
      </div>

      {hasOptions && (
        <div className="fb-options-container">
          <div className="fb-options-header">
            <label className="fb-label">Options</label>
            <button onClick={addOption} className="fb-btn dashed fb-options-add-btn">+ Add</button>
          </div>
          <div className="fb-options-list">
            {field.options?.map((opt, oIdx) => (
              <div key={oIdx} className="fb-options-item-grid">
                <input type="text" placeholder="Label" value={opt.label} onChange={e => updateOption(oIdx, 'label', e.target.value)} className="fb-input" />
                <input type="text" placeholder="value_key" value={opt.value} onChange={e => updateOption(oIdx, 'value', e.target.value)} className="fb-input mono" />
                <button onClick={() => removeOption(oIdx)} className="fb-options-remove-btn">
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionDrawer({ sections, activeSectionIdx, onSelect, onAdd, open, onClose }) {
  if (!open) return null;
  return (
    <div className="fb-drawer-overlay" onClick={onClose}>
      <div className="fb-drawer-content" onClick={e => e.stopPropagation()}>
        <div className="fb-drawer-header">
          <h3>Form Sections</h3>
          <button className="fb-drawer-close" onClick={onClose}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
        <div className="fb-drawer-body">
          {sections.map((sec, idx) => (
            <button key={idx} className={`fb-drawer-item${activeSectionIdx === idx ? ' active' : ''}`} onClick={() => { onSelect(idx); onClose(); }} >
              {sec.label || `Section ${idx + 1}`}
            </button>
          ))}
          <button className="fb-btn dashed fb-w-full fb-mt-4" onClick={onAdd}>+ Add New Section</button>
        </div>
      </div>
    </div>
  );
}

function MetaDrawer({ schema, onChange, open, onClose }) {
  if (!open) return null;
  return (
    <div className="fb-drawer-overlay" onClick={onClose}>
      <div className="fb-drawer-content bottom" onClick={e => e.stopPropagation()}>
        <div className="fb-drawer-header">
          <h3>Form Metadata</h3>
          <button className="fb-drawer-close" onClick={onClose}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
        <div className="fb-drawer-body fb-flex-col fb-gap-4">
          {[['id', 'Schema ID'], ['title', 'Form Title'], ['event', 'Event']].map(([key, lbl]) => (
            <div key={key}>
              <label className="fb-label">{lbl}</label>
              <input type="text" className={`fb-input${key === 'id' ? ' mono' : ''}`} value={schema[key] || ''} onChange={e => onChange(key, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}
