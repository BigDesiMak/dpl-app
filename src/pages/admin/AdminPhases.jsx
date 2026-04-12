import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'

export default function AdminPhases({ readOnly = false }) {
  const [phases, setPhases] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadPhases() }, [])

  async function loadPhases() {
    const { data } = await supabase.from('phases').select('*').order('phase_number')
    setPhases(data || [])
  }

  function openEdit(p) {
    setForm({ ...p, start_date: p.start_date||'', end_date: p.end_date||'' })
    setEditId(p.id); setModal(true)
  }

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.type==='checkbox' ? e.target.checked : e.target.value })) }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('phases').update({
      name: form.name, description: form.description,
      start_date: form.start_date||null, end_date: form.end_date||null,
      max_transfers: parseInt(form.max_transfers)||0,
      max_players_per_dpl_team: parseInt(form.max_players_per_dpl_team)||2
    }).eq('id', editId)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Phase updated!'); setModal(false); loadPhases()
  }

  async function setActive(phase) {
    // Deactivate all first, then activate selected
    await supabase.from('phases').update({ is_active: false }).neq('id', 0)
    await supabase.from('phases').update({ is_active: true }).eq('id', phase.id)
    toast.success(`${phase.name} is now the active phase!`)
    loadPhases()
  }

  async function toggleLock(phase) {
    await supabase.from('phases').update({ is_locked: !phase.is_locked }).eq('id', phase.id)
    toast.success(phase.is_locked ? 'Phase unlocked — team changes allowed' : 'Phase locked — no more team changes')
    loadPhases()
  }

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header"><h1 className="page-title">Phases 📅</h1><p className="page-subtitle">{readOnly ? 'View the current phase schedule' : 'Manage DPL season phases'}</p></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {phases.map(p => (
            <div key={p.id} className={`card${p.is_active?' card-gold':''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: p.is_active ? 'var(--gold-400)' : 'var(--cream)' }}>{p.name}</h3>
                    {p.is_active && <span className="phase-indicator"><span className="phase-dot"/>Active</span>}
                    {p.is_locked && <span className="badge badge-red">🔒 Locked</span>}
                  </div>
                  <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem', marginBottom: 8 }}>{p.description}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.8rem' }}>
                    {p.start_date && <span>📅 Start: {p.start_date}</span>}
                    {p.end_date && <span>📅 End: {p.end_date}</span>}
                    <span>🔄 Max Transfers: <strong style={{ color: 'var(--gold-400)' }}>{p.max_transfers}</strong></span>
                    <span>👥 Max from same DPL team: <strong style={{ color: 'var(--gold-400)' }}>{p.max_players_per_dpl_team}</strong></span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!p.is_active && !readOnly && <button className="btn btn-primary btn-sm" onClick={() => setActive(p)}>▶ Set Active</button>}
                  {!readOnly && <button className={`btn btn-sm ${p.is_locked ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggleLock(p)}>
                    {p.is_locked ? '🔓 Unlock' : '🔒 Lock'}
                  </button>}
                  {!readOnly && <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {modal && (
          <div className="modal-overlay" onClick={() => setModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Edit {form.name}</div>
                <button className="modal-close" onClick={() => setModal(false)}>✕</button>
              </div>
              <div className="form-group"><label className="form-label">Phase Name</label>
                <input className="form-input" value={form.name||''} onChange={set('name')} /></div>
              <div className="form-group"><label className="form-label">Description</label>
                <textarea className="form-textarea" value={form.description||''} onChange={set('description')} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Start Date</label>
                  <input className="form-input" type="date" value={form.start_date||''} onChange={set('start_date')} /></div>
                <div className="form-group"><label className="form-label">End Date</label>
                  <input className="form-input" type="date" value={form.end_date||''} onChange={set('end_date')} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Max Transfers</label>
                  <input className="form-input" type="number" min="0" max="10" value={form.max_transfers||0} onChange={set('max_transfers')} /></div>
                <div className="form-group"><label className="form-label">Max Players per DPL Team</label>
                  <input className="form-input" type="number" min="1" max="5" value={form.max_players_per_dpl_team||2} onChange={set('max_players_per_dpl_team')} /></div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save Phase'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
