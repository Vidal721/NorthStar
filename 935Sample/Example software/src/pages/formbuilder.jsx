import React, { useState, useEffect, useRef } from 'react';

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

const FIELD_COLORS = {
  number: '#f59e0b',
  text: '#60a5fa',
  textarea: '#34d399',
  select: '#a78bfa',
  radio: '#f472b6',
  checkbox: '#fb923c',
};

const FIELD_TYPES = ['number', 'text', 'textarea', 'select', 'radio', 'checkbox'];

const S = {
  input: {
    width: '100%',
    padding: '9px 11px',
    border: '1px solid #334155',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    outline: 'none',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
  },
  label: {
    display: 'block',
    fontSize: '10px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '5px',
  },
  btn: (variant = 'default') => ({
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    ...(variant === 'primary' && { backgroundColor: '#4f46e5', color: '#fff' }),
    ...(variant === 'ghost' && { backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #334155' }),
    ...(variant === 'danger' && { backgroundColor: 'transparent', color: '#f87171', border: '1px solid #7f1d1d' }),
    ...(variant === 'dashed' && { backgroundColor: '#1e293b', color: '#818cf8', border: '1px dashed #4f46e5' }),
    ...(variant === 'default' && { backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }),
  }),
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function FieldPill({ type }) {
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: '700',
      fontFamily: 'monospace',
      padding: '2px 6px',
      borderRadius: '4px',
      backgroundColor: FIELD_COLORS[type] + '22',
      color: FIELD_COLORS[type],
      border: `1px solid ${FIELD_COLORS[type]}55`,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      flexShrink: 0,
    }}>{type}</span>
  );
}

function AddFieldMenu({ onAdd }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...S.btn('primary'),
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
        Add Field
        <span style={{ fontSize: '10px', opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          overflow: 'hidden',
          zIndex: 100,
          minWidth: '160px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {FIELD_TYPES.map(type => (
            <button
              key={type}
              onClick={() => { onAdd(type); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 14px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #0f172a',
                cursor: 'pointer',
                textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#0f172a'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: FIELD_COLORS[type], flexShrink: 0,
              }} />
              <span style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'monospace', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionDrawer({ sections, activeSectionIdx, onSelect, onAdd, open, onClose }) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 200, backdropFilter: 'blur(2px)',
          }}
        />
      )}
      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '260px',
        backgroundColor: '#0a1121',
        borderRight: '1px solid #1e293b',
        zIndex: 201,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #1e293b' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#818cf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Sections</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {sections.map((sec, idx) => {
            const active = activeSectionIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => { onSelect(idx); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 12px', fontSize: '14px',
                  fontWeight: active ? '700' : '500', borderRadius: '7px', border: 'none',
                  backgroundColor: active ? '#1e1b4b' : 'transparent',
                  color: active ? '#c7d2fe' : '#94a3b8',
                  cursor: 'pointer', textAlign: 'left', marginBottom: '3px',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sec.label || `Section ${idx + 1}`}
                </span>
                <span style={{ fontSize: '11px', color: active ? '#818cf8' : '#475569', flexShrink: 0, marginLeft: '6px' }}>
                  {sec.fields.length}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: '12px' }}>
          <button onClick={onAdd} style={{ ...S.btn('dashed'), width: '100%' }}>+ New Section</button>
        </div>
      </div>
    </>
  );
}

function MetaDrawer({ schema, onChange, open, onClose }) {
  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      )}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: '280px',
        backgroundColor: '#0a1121',
        borderLeft: '1px solid #1e293b',
        zIndex: 201,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #1e293b' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#818cf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Schema Info</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[['id', 'Schema ID'], ['title', 'Form Title'], ['event', 'Event']].map(([key, lbl]) => (
            <div key={key}>
              <label style={S.label}>{lbl}</label>
              <input type="text" value={schema[key]} onChange={e => onChange(key, e.target.value)} style={S.input} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function FieldCard({ field, secIdx, fIdx, onUpdate, onRemove }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type);

  const updateOption = (oIdx, key, val) => {
    onUpdate(fIdx, 'options', field.options.map((o, k) => k === oIdx ? { ...o, [key]: val } : o));
  };
  const addOption = () => {
    const count = field.options.length + 1;
    onUpdate(fIdx, 'options', [...field.options, { value: `option_${count}`, label: `Option ${count}` }]);
  };
  const removeOption = (oIdx) => {
    onUpdate(fIdx, 'options', field.options.filter((_, k) => k !== oIdx));
  };

  return (
    <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#0f172a' }}>
      {/* Collapsed row */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '11px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: open ? '#1e293b' : 'transparent',
          WebkitTapHighlightColor: 'transparent',
          minHeight: '46px',
        }}
      >
        <span style={{ color: '#475569', fontSize: '11px', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <FieldPill type={field.type} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {field.label || '(unnamed)'}
          </span>
          {!isMobile && (
            <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {field.id}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {field.required && <span style={{ fontSize: '10px', color: '#f87171', fontWeight: '700' }}>REQ</span>}
          {hasOptions && <span style={{ fontSize: '11px', color: '#64748b' }}>{field.options?.length}opts</span>}
          <button
            onClick={e => { e.stopPropagation(); onRemove(fIdx); }}
            style={{ background: 'none', border: 'none', color: '#475569', fontSize: '20px', cursor: 'pointer', padding: '0 2px', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
          >×</button>
        </div>
      </div>

      {/* Expanded editor */}
      {open && (
        <div style={{ padding: '14px 14px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={S.label}>Label</label>
              <input type="text" value={field.label} onChange={e => onUpdate(fIdx, 'label', e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Key ID</label>
              <input type="text" value={field.id} onChange={e => onUpdate(fIdx, 'id', e.target.value)} style={{ ...S.input, fontFamily: 'monospace' }} />
            </div>
          </div>

          {!hasOptions && (
            <div>
              <label style={S.label}>Placeholder</label>
              <input type="text" value={field.placeholder || ''} onChange={e => onUpdate(fIdx, 'placeholder', e.target.value)} style={S.input} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id={`req-${secIdx}-${fIdx}`}
              checked={field.required}
              onChange={e => onUpdate(fIdx, 'required', e.target.checked)}
              style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#4f46e5', flexShrink: 0 }}
            />
            <label htmlFor={`req-${secIdx}-${fIdx}`} style={{ ...S.label, margin: 0, cursor: 'pointer' }}>Required field</label>
          </div>

          {hasOptions && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={S.label}>Options</label>
                <button onClick={addOption} style={{ ...S.btn('dashed'), padding: '5px 10px', fontSize: '12px' }}>+ Add</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {field.options?.map((opt, oIdx) => (
                  <div key={oIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
                    <input type="text" placeholder="Label" value={opt.label} onChange={e => updateOption(oIdx, 'label', e.target.value)} style={S.input} />
                    <input type="text" placeholder="value_key" value={opt.value} onChange={e => updateOption(oIdx, 'value', e.target.value)} style={{ ...S.input, fontFamily: 'monospace' }} />
                    <button onClick={() => removeOption(oIdx)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer', padding: '4px', WebkitTapHighlightColor: 'transparent' }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FormBuilder() {
  const [schema, setSchema] = useState(initialSchema);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [saveStatus, setSaveStatus] = useState(null);
  const [tab, setTab] = useState('editor');
  const [sectionDrawer, setSectionDrawer] = useState(false);
  const [metaDrawer, setMetaDrawer] = useState(false);
  const isMobile = useIsMobile();

  const handleMetaChange = (key, value) => setSchema(prev => ({ ...prev, [key]: value }));

  const addSection = () => {
    const newIdx = schema.sections.length;
    setSchema(prev => ({ ...prev, sections: [...prev.sections, { label: "New Section", fields: [] }] }));
    setActiveSectionIdx(newIdx);
  };

  const updateSectionLabel = (idx, label) =>
    setSchema(prev => ({ ...prev, sections: prev.sections.map((s, i) => i === idx ? { ...s, label } : s) }));

  const removeSection = (idx) => {
    setSchema(prev => ({ ...prev, sections: prev.sections.filter((_, i) => i !== idx) }));
    setActiveSectionIdx(0);
  };

  const addField = (secIdx, type) => {
    const newField = {
      id: `${type}_${Date.now().toString().slice(-5)}`,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      type, required: false,
      ...(['select', 'radio', 'checkbox'].includes(type)
        ? { options: [{ value: "option_1", label: "Option 1" }, { value: "option_2", label: "Option 2" }] }
        : { placeholder: "Enter value..." })
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
        i !== secIdx ? sec : { ...sec, fields: sec.fields.map((f, j) => j !== fIdx ? f : { ...f, [key]: value }) }
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
      const res = await fetch('http://localhost:3000/pit/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schema),
      });
      if (!res.ok) throw new Error();
      setSaveStatus('saved');
    } catch { setSaveStatus('error'); }
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const activeSection = schema.sections[activeSectionIdx];
  const totalFields = schema.sections.reduce((a, s) => a + s.fields.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: '#0f172a', fontFamily: "'Inter', 'DM Sans', sans-serif", color: '#f1f5f9', overflow: 'hidden' }}>

      {/* Mobile drawers */}
      {isMobile && (
        <>
          <SectionDrawer
            sections={schema.sections}
            activeSectionIdx={activeSectionIdx}
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: '52px', borderBottom: '1px solid #1e293b',
        flexShrink: 0, backgroundColor: '#0a1121',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isMobile && (
            <button
              onClick={() => setSectionDrawer(true)}
              style={{ background: 'none', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', padding: '5px 8px', cursor: 'pointer', fontSize: '16px', WebkitTapHighlightColor: 'transparent' }}
              title="Sections"
            >☰</button>
          )}
          <span style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '700', color: '#818cf8', letterSpacing: '-0.02em' }}>
            {isMobile ? 'FRC Builder' : 'FRC Form Builder'}
          </span>
          {!isMobile && (
            <span style={{ fontSize: '11px', color: '#475569', backgroundColor: '#1e293b', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
              {schema.sections.length} sections · {totalFields} fields
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isMobile && (
            <button
              onClick={() => setMetaDrawer(true)}
              style={{ ...S.btn('ghost'), padding: '6px 10px', fontSize: '12px' }}
            >Info</button>
          )}
          {/* Tab toggle */}
          <div style={{ display: 'flex', gap: '2px', backgroundColor: '#1e293b', padding: '3px', borderRadius: '7px' }}>
            {['editor', 'json'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '4px 10px', fontSize: '12px', fontWeight: '600', borderRadius: '5px', border: 'none',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                backgroundColor: tab === t ? '#312e81' : 'transparent',
                color: tab === t ? '#c7d2fe' : '#64748b',
              }}>{t === 'editor' ? 'Editor' : 'JSON'}</button>
            ))}
          </div>
          <button
            onClick={saveSchema}
            style={{
              ...S.btn('primary'),
              backgroundColor: saveStatus === 'saved' ? '#16a34a' : saveStatus === 'error' ? '#dc2626' : '#4f46e5',
              padding: isMobile ? '6px 10px' : '8px 14px',
              fontSize: isMobile ? '12px' : '13px',
              minWidth: isMobile ? 'unset' : '80px',
            }}
          >
            {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? '✓' : saveStatus === 'error' ? '✗' : 'Save'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {tab === 'editor' ? (
          <>
            {/* Desktop sidebar */}
            {!isMobile && (
              <div style={{ width: '200px', flexShrink: 0, borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', backgroundColor: '#0a1121' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b' }}>
                  <span style={{ ...S.label, marginBottom: 0 }}>Sections</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {schema.sections.map((sec, idx) => {
                    const active = activeSectionIdx === idx;
                    return (
                      <button key={idx} onClick={() => setActiveSectionIdx(idx)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '8px 10px', fontSize: '13px',
                        fontWeight: active ? '700' : '500', borderRadius: '6px', border: 'none',
                        backgroundColor: active ? '#1e1b4b' : 'transparent',
                        color: active ? '#c7d2fe' : '#94a3b8',
                        cursor: 'pointer', textAlign: 'left', marginBottom: '2px',
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.label || `Section ${idx + 1}`}</span>
                        <span style={{ fontSize: '11px', color: active ? '#818cf8' : '#475569', flexShrink: 0, marginLeft: '4px' }}>{sec.fields.length}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ padding: '10px' }}>
                  <button onClick={addSection} style={{ ...S.btn('dashed'), width: '100%' }}>+ Section</button>
                </div>
              </div>
            )}

            {/* Main editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Desktop meta strip */}
              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', padding: '12px 20px', borderBottom: '1px solid #1e293b', flexShrink: 0, backgroundColor: '#0a1121' }}>
                  {[['id', 'Schema ID'], ['title', 'Form Title'], ['event', 'Event']].map(([key, lbl]) => (
                    <div key={key}>
                      <label style={S.label}>{lbl}</label>
                      <input type="text" value={schema[key]} onChange={e => handleMetaChange(key, e.target.value)} style={S.input} />
                    </div>
                  ))}
                </div>
              )}

              {/* Mobile: section selector pill row */}
              {isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', overflowX: 'auto', borderBottom: '1px solid #1e293b', flexShrink: 0, backgroundColor: '#0a1121' }}>
                  {schema.sections.map((sec, idx) => {
                    const active = activeSectionIdx === idx;
                    return (
                      <button key={idx} onClick={() => setActiveSectionIdx(idx)} style={{
                        flexShrink: 0, padding: '5px 12px', fontSize: '12px', fontWeight: active ? '700' : '500',
                        borderRadius: '20px', border: active ? '1px solid #818cf8' : '1px solid #334155',
                        backgroundColor: active ? '#1e1b4b' : '#1e293b',
                        color: active ? '#c7d2fe' : '#94a3b8',
                        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                        whiteSpace: 'nowrap',
                      }}>
                        {sec.label || `Section ${idx + 1}`}
                        <span style={{ marginLeft: '5px', opacity: 0.6 }}>{sec.fields.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeSection && (
                <>
                  {/* Section header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: isMobile ? '10px 12px' : '10px 20px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
                    <div style={{ flex: 1 }}>
                      <label style={S.label}>Section name</label>
                      <input
                        type="text"
                        value={activeSection.label}
                        onChange={e => updateSectionLabel(activeSectionIdx, e.target.value)}
                        style={{ ...S.input, fontSize: '14px', fontWeight: '600', maxWidth: isMobile ? '100%' : '280px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px', flexShrink: 0 }}>
                      {/* Add field dropdown */}
                      <AddFieldMenu onAdd={(type) => addField(activeSectionIdx, type)} />
                      {!isMobile && (
                        <button onClick={() => removeSection(activeSectionIdx)} style={{ ...S.btn('danger') }}>Delete</button>
                      )}
                    </div>
                  </div>

                  {/* Mobile: delete section */}
                  {isMobile && schema.sections.length > 1 && (
                    <div style={{ padding: '0 12px 8px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => removeSection(activeSectionIdx)} style={{ ...S.btn('danger'), fontSize: '12px', padding: '5px 10px' }}>
                        Delete section
                      </button>
                    </div>
                  )}

                  {/* Fields list */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 12px' : '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeSection.fields.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px 20px', color: '#334155', fontSize: '13px', lineHeight: 1.8 }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>＋</div>
                        No fields yet.<br />Tap "Add Field" above to get started.
                      </div>
                    ) : activeSection.fields.map((field, fIdx) => (
                      <FieldCard
                        key={field.id}
                        field={field}
                        secIdx={activeSectionIdx}
                        fIdx={fIdx}
                        onUpdate={(fIdx, key, val) => updateField(activeSectionIdx, fIdx, key, val)}
                        onRemove={(fIdx) => removeField(activeSectionIdx, fIdx)}
                      />
                    ))}
                    <div style={{ height: '20px' }} />
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#020617' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderBottom: '1px solid #1e293b' }}>
              <button onClick={() => navigator.clipboard.writeText(JSON.stringify(schema, null, 2))} style={S.btn('ghost')}>
                Copy JSON
              </button>
            </div>
            <pre style={{ flex: 1, overflow: 'auto', fontSize: '12px', fontFamily: 'monospace', lineHeight: '1.7', padding: '16px', margin: 0, color: '#34d399', userSelect: 'all' }}>
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}