import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'

const BLANK = { match_number: '', team1_id: '', team2_id: '', match_date: '', match_time: '', venue: '', phase_id: '', team1_score: '', team2_score: '', winner_id: '', result_summary: '', is_completed: false, stats_entered: false }

export default function AdminMatches() {
  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [phases, setPhases] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterPhase, setFilterPhase] = useState('All')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: ms }, { data: ts }, { data: ps }] = await Promise.all([
      supabase.from('matches').select('*, team1:team1_id(name,color), team2:team2_id(name,color), winner:winner_id(name), phase:phase_id(name)').order('match_number', { ascending: false }),
      supabase.from('dpl_teams').select('*').order('name'),
      supabase.from('phases').select('*').order('phase_number')
    ])
    setMatches(ms || []); setTeams(ts || []); setPhases(ps || [])
  }

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })) }
  function openAdd() { setForm({ ...BLANK, match_number: (matches.length + 1).toString() }); setEditId(null); setModal('form') }
  function openEdit(m) {
    setForm({ match_number: m.match_number, team1_id: m.team1_id||'', team2_id: m.team2_id||'', match_date: m.match_date||'', match_time: m.match_time||'', venue: m.venue||'', phase_id: m.phase_id||'', team1_score: m.team1_score||'', team2_score: m.team2_score||'', winner_id: m.winner_id||'', result_summary: m.result_summary||'', is_completed: m.is_completed||false, stats_entered: m.stats_entered||false })
    setEditId(m.id); setModal('form')
  }

  async function save() {
    if (!form.team1_id || !form.team2_id) { toast.error('Both teams required'); return }
    if (form.team1_id === form.team2_id) { toast.error('Teams must be different'); return }
    if (!form.match_number) { toast.error('Match number required'); return }
    setSaving(true)
    const payload = { ...form, team1_id: form.team1_id||null, team2_id: form.team2_id||null, phase_id: form.phase_id||null, winner_id: form.winner_id||null, match_number: parseInt(form.match_number) }
    const { error } = editId
      ? await supabase.from('matches').update(payload).eq('id', editId)
      : await supabase.from('matches').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Match updated!' : 'Match added!')
    setModal(null); loadData()
  }

  async function markComplete(m) {
    await supabase.from('matches').update({ is_completed: true }).eq('id', m.id)
    setMatches(ms => ms.map(x => x.id === m.id ? {...x, is_completed: true} : x))
    toast.success('Match marked as completed')
  }

  const filtered = filterPhase === 'All' ? matches : matches.filter(m => m.phase_id?.toString() === filterPhase)

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div><h1 className="page-title">Matches 🏏</h1><p className="page-subtitle">{matches.length} total matches</p></div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Match</button>
        </div>

        <div className="filter-bar">
          <select className="form-select" value={filterPhase} onChange={e => setFilterPhase(e.target.value)}>
            <option value="All">All Phases</option>
            {phases.map(p => <option key={p.id} value={p.id.toString()}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(m => (
            <div key={m.id} className="match-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 6 }}>
                    Match {m.match_number} · {m.phase?.name || 'No Phase'} · {m.match_date || 'TBD'} {m.match_time || ''} {m.venue ? `· ${m.venue}` : ''}
                  </div>
                  <div className="match-teams" style={{ marginBottom: 0 }}>
                    <div className="match-team">
                      <div className="match-team-name" style={{ color: m.winner_id === m.team1_id ? 'var(--gold-400)' : undefined }}>
                        {m.winner_id === m.team1_id ? '🏆 ' : ''}{m.team1?.name}
                      </div>
                      {m.team1_score && <div className="match-score">{m.team1_score}</div>}
                    </div>
                    <div style={{ color: 'var(--gray-400)', fontSize: '0.8rem', padding: '0 8px' }}>VS</div>
                    <div className="match-team">
                      <div className="match-team-name" style={{ color: m.winner_id === m.team2_id ? 'var(--gold-400)' : undefined }}>
                        {m.winner_id === m.team2_id ? '🏆 ' : ''}{m.team2?.name}
                      </div>
                      {m.team2_score && <div className="match-score">{m.team2_score}</div>}
                    </div>
                  </div>
                  {m.result_summary && <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 6 }}>{m.result_summary}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {!m.is_completed && <button className="btn btn-secondary btn-sm" onClick={() => markComplete(m)}>✓ Mark Complete</button>}
                  {m.is_completed && !m.stats_entered && <span className="badge badge-gold">Awaiting Stats</span>}
                  {m.stats_entered && <span className="badge badge-green">✓ Stats Done</span>}
                  {!m.is_completed && <span className="badge badge-gray">Upcoming</span>}
                  {m.is_completed && (
                    <Link
                      to={`/admin/match-stats/${m.id}`}
                      className={`btn btn-sm ${m.stats_entered ? 'btn-secondary' : 'btn-primary'}`}
                    >
                      {m.stats_entered ? '✏️ Edit Stats' : '📊 Enter Stats'}
                    </Link>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>Edit Match</button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-state mt-3"><div className="empty-state-icon">🏟️</div><div className="empty-state-title">No matches yet</div></div>}
        </div>

        {/* Add/Edit Modal */}
        {modal && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
              <div className="modal-header">
                <div className="modal-title">{editId ? 'Edit Match' : 'Add Match'}</div>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Match Number *</label>
                  <input className="form-input" type="number" value={form.match_number} onChange={set('match_number')} /></div>
                <div className="form-group"><label className="form-label">Phase</label>
                  <select className="form-select" value={form.phase_id} onChange={set('phase_id')}>
                    <option value="">— None —</option>
                    {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Team 1 *</label>
                  <select className="form-select" value={form.team1_id} onChange={set('team1_id')}>
                    <option value="">— Select —</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Team 2 *</label>
                  <select className="form-select" value={form.team2_id} onChange={set('team2_id')}>
                    <option value="">— Select —</option>
                    {teams.filter(t => t.id.toString() !== form.team1_id.toString()).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.match_date} onChange={set('match_date')} /></div>
                <div className="form-group"><label className="form-label">Time</label>
                  <input className="form-input" type="time" value={form.match_time} onChange={set('match_time')} /></div>
              </div>
              <div className="form-group"><label className="form-label">Venue</label>
                <input className="form-input" value={form.venue} onChange={set('venue')} placeholder="e.g. Daffodils Ground" /></div>
              <div style={{ borderTop: '1px solid var(--green-700)', paddingTop: 16, marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12, color: 'var(--gray-400)' }}>RESULT (fill after match)</div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Team 1 Score</label>
                    <input className="form-input" value={form.team1_score} onChange={set('team1_score')} placeholder="e.g. 145/6 (20)" /></div>
                  <div className="form-group"><label className="form-label">Team 2 Score</label>
                    <input className="form-input" value={form.team2_score} onChange={set('team2_score')} placeholder="e.g. 132/8 (20)" /></div>
                </div>
                <div className="form-group"><label className="form-label">Winner</label>
                  <select className="form-select" value={form.winner_id} onChange={set('winner_id')}>
                    <option value="">— TBD —</option>
                    {teams.filter(t => [form.team1_id, form.team2_id].includes(t.id.toString())).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Result Summary</label>
                  <input className="form-input" value={form.result_summary} onChange={set('result_summary')} placeholder="e.g. Team A won by 13 runs" /></div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={form.is_completed} onChange={set('is_completed')} /> Match Completed
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Match'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
