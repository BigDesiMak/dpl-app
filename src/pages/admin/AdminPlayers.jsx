import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'

const BLANK = { name: '', gender: 'Male', flat_number: '', skill: 'Batting All Rounder', dpl_team_id: '', auction_price: 1000, is_active: true }
const SKILLS = ['Batter', 'Bowler', 'Batting All Rounder', 'Bowling All Rounder', 'Wicket Keeper']

export default function AdminPlayers() {
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterGender, setFilterGender] = useState('All')
  const [filterTeam, setFilterTeam] = useState('All')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: ps }, { data: ts }] = await Promise.all([
      supabase.from('players').select('*, dpl_team:dpl_team_id(name)').order('name'),
      supabase.from('dpl_teams').select('*').order('name')
    ])
    setPlayers(ps || []); setTeams(ts || [])
  }

  function openAdd() { setForm(BLANK); setEditId(null); setModal('add') }
  function openEdit(p) {
    setForm({ name: p.name, gender: p.gender, flat_number: p.flat_number||'', skill: p.skill, dpl_team_id: p.dpl_team_id||'', auction_price: p.auction_price||1000, is_active: p.is_active })
    setEditId(p.id); setModal('edit')
  }
  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })) }

  async function save() {
    if (!form.name.trim()) { toast.error('Player name required'); return }
    setSaving(true)
    const payload = { ...form, dpl_team_id: form.dpl_team_id || null, auction_price: parseInt(form.auction_price) || 1000 }
    const { error } = modal === 'add'
      ? await supabase.from('players').insert(payload)
      : await supabase.from('players').update(payload).eq('id', editId)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(modal === 'add' ? 'Player added!' : 'Player updated!')
    setModal(null); loadData()
  }

  async function toggleActive(p) {
    await supabase.from('players').update({ is_active: !p.is_active }).eq('id', p.id)
    setPlayers(ps => ps.map(x => x.id === p.id ? {...x, is_active: !x.is_active} : x))
    toast.success(p.is_active ? 'Player deactivated' : 'Player activated')
  }

  const filtered = players.filter(p => {
    if (filterGender !== 'All' && p.gender !== filterGender) return false
    if (filterTeam !== 'All' && p.dpl_team_id?.toString() !== filterTeam) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.flat_number?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div><h1 className="page-title">Players 👤</h1><p className="page-subtitle">{players.length} total players</p></div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Player</button>
        </div>

        <div className="filter-bar">
          <input className="form-input search-input" placeholder="Search name or flat..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
            <option>All</option><option>Male</option><option>Female</option>
          </select>
          <select className="form-select" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
            <option value="All">All DPL Teams</option>
            {teams.map(t => <option key={t.id} value={t.id.toString()}>{t.name}</option>)}
          </select>
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Name</th><th>Gender</th><th>Flat No.</th><th>Skill</th><th>DPL Team</th><th>Price</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td><span className={`player-gender-badge ${p.gender==='Male'?'gender-m':'gender-f'}`}>{p.gender}</span></td>
                  <td className="td-muted">{p.flat_number || '—'}</td>
                  <td><span className="badge badge-gray">{p.skill}</span></td>
                  <td className="td-muted">{p.dpl_team?.name || '—'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--gold-400)' }}>₹{p.auction_price?.toLocaleString()}</td>
                  <td><span className={`badge ${p.is_active?'badge-green':'badge-red'}`}>{p.is_active?'Active':'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                      <button className={`btn btn-sm ${p.is_active?'btn-danger':'btn-secondary'}`} onClick={() => toggleActive(p)}>
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="empty-state mt-3"><div className="empty-state-icon">👤</div><div className="empty-state-title">No players found</div></div>}

        {/* Add/Edit Modal */}
        {modal && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{modal === 'add' ? 'Add New Player' : 'Edit Player'}</div>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="form-group"><label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={set('name')} placeholder="Player full name" /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Gender *</label>
                  <select className="form-select" value={form.gender} onChange={set('gender')}>
                    <option>Male</option><option>Female</option>
                  </select></div>
                <div className="form-group"><label className="form-label">Flat / RH No.</label>
                  <input className="form-input" value={form.flat_number} onChange={set('flat_number')} placeholder="A2-703" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Skill *</label>
                  <select className="form-select" value={form.skill} onChange={set('skill')}>
                    {SKILLS.map(s => <option key={s}>{s}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">DPL Team</label>
                  <select className="form-select" value={form.dpl_team_id} onChange={set('dpl_team_id')}>
                    <option value="">— None —</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select></div>
              </div>
              <div className="form-group"><label className="form-label">Auction Price (₹)</label>
                <input className="form-input" type="number" min="100" step="50" value={form.auction_price} onChange={set('auction_price')} /></div>
              {modal === 'edit' && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="is_active" checked={form.is_active} onChange={set('is_active')} />
                  <label htmlFor="is_active" className="form-label" style={{ margin: 0 }}>Player is active</label>
                </div>
              )}
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Player'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
