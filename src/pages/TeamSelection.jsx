import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const BUDGET      = 10000
const MAX_TOTAL   = 8
const MAX_MALE    = 6
const MAX_FEMALE  = 2
const MAX_PER_DPL = 2

export default function TeamSelection() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const [phase, setPhase]               = useState(null)
  const [allPlayers, setAllPlayers]     = useState([])
  const [dplTeams, setDplTeams]         = useState([])
  const [selectedIds, setSelectedIds]   = useState([])
  const [captainId, setCaptainId]       = useState(null)
  const [vcId, setVcId]                 = useState(null)
  const [teamName, setTeamName]         = useState('')
  const [existingTeam, setExistingTeam] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [activeTab, setActiveTab]       = useState('select')
  const [filterGender, setFilterGender] = useState('All')
  const [filterSkill, setFilterSkill]   = useState('All')
  const [filterTeam, setFilterTeam]     = useState('All')
  const [search, setSearch]             = useState('')
  const [sortBy, setSortBy]             = useState('name_asc')
  // CHANGE 2: multi-phase support
  const [allPhasesForSelect, setAllPhasesForSelect] = useState([])
  const [nextPhase, setNextPhase]         = useState(null)
  const [workingPhase, setWorkingPhase]   = useState(null)
  const [selectedPhaseId, setSelectedPhaseId] = useState(null)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    setLoading(true)
    const { data: allPhasesData } = await supabase.from('phases').select('*').order('phase_number')
    const active = allPhasesData?.find(p => p.is_active)

    // CHANGE 2: if active phase is locked, also allow picking next phase
    const nextPhase = active?.is_locked
      ? allPhasesData?.find(p => p.phase_number === (active.phase_number + 1)) || null
      : null

    // Default to active; if locked show next; user can switch via phaseId state
    const targetPhase = active || null
    setPhase(targetPhase)
    setAllPhasesForSelect(allPhasesData || [])
    setNextPhase(nextPhase)

    if (!targetPhase && !nextPhase) { setLoading(false); return }

    const workingPhaseId = selectedPhaseId || (active?.is_locked && nextPhase ? nextPhase.id : targetPhase?.id)
    const workingPhase   = allPhasesData?.find(p => p.id === workingPhaseId) || targetPhase
    setWorkingPhase(workingPhase)

    const [{ data: players }, { data: teams }, { data: ft }] = await Promise.all([
      supabase.from('players').select('*, dpl_team:dpl_team_id(id,name,short_name)').eq('is_active', true).order('name'),
      supabase.from('dpl_teams').select('*'),
      workingPhase
        ? supabase.from('fantasy_teams')
            .select('*, players:fantasy_team_players(player_id, is_playing)')
            .eq('user_id', user.id).eq('phase_id', workingPhase.id).maybeSingle()
        : { data: null }
    ])

    setAllPlayers(players || [])
    setDplTeams(teams || [])

    if (ft) {
      setExistingTeam(ft)
      setTeamName(ft.team_name || '')
      setSelectedIds(ft.players?.map(p => p.player_id) || [])
      setCaptainId(ft.captain_id)
      setVcId(ft.vice_captain_id)
    } else {
      setExistingTeam(null)
      setTeamName(''); setSelectedIds([]); setCaptainId(null); setVcId(null)
    }
    setLoading(false)
  }

  // CHANGE 1: phase lock check
  const phaseLocked = workingPhase?.is_locked === true

  const selectedPlayers = useMemo(() => allPlayers.filter(p => selectedIds.includes(p.id)), [allPlayers, selectedIds])
  const spentBudget     = useMemo(() => selectedPlayers.reduce((s, p) => s + (p.auction_price || 0), 0), [selectedPlayers])
  const remaining       = BUDGET - spentBudget
  const selectedMales   = useMemo(() => selectedPlayers.filter(p => p.gender === 'Male').length, [selectedPlayers])
  const selectedFemales = useMemo(() => selectedPlayers.filter(p => p.gender === 'Female').length, [selectedPlayers])

  const dplTeamCounts = useMemo(() => {
    const c = {}
    selectedPlayers.forEach(p => { if (p.dpl_team_id) c[p.dpl_team_id] = (c[p.dpl_team_id] || 0) + 1 })
    return c
  }, [selectedPlayers])

  const filteredPlayers = useMemo(() => {
    const list = allPlayers.filter(p => {
      if (filterGender !== 'All' && p.gender !== filterGender) return false
      if (filterSkill  !== 'All' && p.skill  !== filterSkill)  return false
      if (filterTeam   !== 'All' && p.dpl_team_id?.toString() !== filterTeam) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
          !p.flat_number?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    return list.sort((a, b) => {
      if (sortBy === 'name_asc')   return a.name.localeCompare(b.name)
      if (sortBy === 'name_desc')  return b.name.localeCompare(a.name)
      if (sortBy === 'price_high') return (b.auction_price || 0) - (a.auction_price || 0)
      if (sortBy === 'price_low')  return (a.auction_price || 0) - (b.auction_price || 0)
      const aS = selectedIds.includes(a.id) ? 0 : 1
      const bS = selectedIds.includes(b.id) ? 0 : 1
      if (aS !== bS) return aS - bS
      return a.name.localeCompare(b.name)
    })
  }, [allPlayers, filterGender, filterSkill, filterTeam, search, sortBy, selectedIds])

  function canSelect(player) {
    if (selectedIds.includes(player.id)) return true
    if (selectedIds.length >= MAX_TOTAL) return false
    if (remaining < player.auction_price) return false
    if (player.dpl_team_id && (dplTeamCounts[player.dpl_team_id] || 0) >= MAX_PER_DPL) return false
    if (player.gender === 'Male'   && selectedMales   >= MAX_MALE)   return false
    if (player.gender === 'Female' && selectedFemales >= MAX_FEMALE)  return false
    return true
  }

  function togglePlayer(player) {
    if (phaseLocked) { toast.error('🔒 This phase is locked — team changes are not allowed'); return }
    if (selectedIds.includes(player.id)) {
      setSelectedIds(s => s.filter(id => id !== player.id))
      if (captainId === player.id) setCaptainId(null)
      if (vcId === player.id) setVcId(null)
    } else {
      if (!canSelect(player)) {
        if (selectedIds.length >= MAX_TOTAL)                            toast.error(`Max ${MAX_TOTAL} players`)
        else if (remaining < player.auction_price)                      toast.error('Not enough budget')
        else if (player.gender === 'Male'   && selectedMales   >= MAX_MALE)  toast.error(`Max ${MAX_MALE} male players`)
        else if (player.gender === 'Female' && selectedFemales >= MAX_FEMALE) toast.error(`Max ${MAX_FEMALE} female players`)
        else toast.error(`Max ${MAX_PER_DPL} players from same DPL team`)
        return
      }
      setSelectedIds(s => [...s, player.id])
    }
  }

  function setCaptain(id) {
    if (phaseLocked) { toast.error('🔒 Phase is locked'); return }
    if (id === vcId) { toast.error('Same player cannot be C and VC'); return }
    setCaptainId(id)
  }
  function setVC(id) {
    if (phaseLocked) { toast.error('🔒 Phase is locked'); return }
    if (id === captainId) { toast.error('Same player cannot be C and VC'); return }
    setVcId(id)
  }

  function validate() {
    if (phaseLocked)                         { toast.error('🔒 Phase is locked — cannot save changes'); return false }
    if (!teamName.trim())                    { toast.error('Enter a team name'); return false }
    if (selectedIds.length !== MAX_TOTAL)    { toast.error(`Select exactly ${MAX_TOTAL} players (${selectedIds.length} selected)`); return false }
    if (selectedMales   !== MAX_MALE)        { toast.error(`Need exactly ${MAX_MALE} male players (${selectedMales} selected)`); return false }
    if (selectedFemales !== MAX_FEMALE)      { toast.error(`Need exactly ${MAX_FEMALE} female players (${selectedFemales} selected)`); return false }
    if (!captainId)                          { toast.error('Select a Captain'); return false }
    if (!vcId)                               { toast.error('Select a Vice-Captain'); return false }
    if (!selectedIds.includes(captainId))    { toast.error('Captain must be in your team'); return false }
    if (!selectedIds.includes(vcId))         { toast.error('Vice-Captain must be in your team'); return false }
    if (spentBudget > BUDGET)               { toast.error('Team exceeds budget'); return false }
    return true
  }

  async function saveTeam() {
    if (!validate()) return
    setSaving(true)
    try {
      let teamId
      if (existingTeam) {
        const { data } = await supabase.from('fantasy_teams').update({
          team_name: teamName, captain_id: captainId, vice_captain_id: vcId,
          spent_budget: spentBudget, updated_at: new Date().toISOString()
        }).eq('id', existingTeam.id).select().single()
        teamId = data.id
        await supabase.from('fantasy_team_players').delete().eq('fantasy_team_id', teamId)
      } else {
        const { data } = await supabase.from('fantasy_teams').insert({
          user_id: user.id, phase_id: workingPhase?.id || phase?.id, team_name: teamName,
          captain_id: captainId, vice_captain_id: vcId,
          total_budget: BUDGET, spent_budget: spentBudget
        }).select().single()
        teamId = data.id
      }
      const rows = selectedIds.map((pid, idx) => ({
        fantasy_team_id: teamId, player_id: pid, is_playing: true, position: idx + 1
      }))
      await supabase.from('fantasy_team_players').insert(rows)
      toast.success(existingTeam ? 'Team updated! 🏏' : 'Team created! 🏏')
      navigate('/dashboard')
    } catch (err) {
      toast.error('Failed to save: ' + err.message)
    } finally { setSaving(false) }
  }

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner" /></div></Layout>

  if (!phase && !nextPhase && !workingPhase) return (
    <Layout>
      <div className="page-content">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="empty-state-icon">⏳</div>
          <h2 className="empty-state-title">No Active Phase</h2>
          <p className="empty-state-desc">Team selection opens when the admin activates a phase.</p>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">{existingTeam ? 'Edit Your Team' : 'Build Your Team'}</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <p className="page-subtitle" style={{ margin: 0 }}>{workingPhase?.name || phase?.name} · Budget: ₹{BUDGET.toLocaleString()} · 8 players (6M + 2F)</p>
            {phaseLocked
              ? <span className="badge badge-red">🔒 Phase Locked — View Only</span>
              : <span className="badge badge-green">🔓 Open for Editing</span>}
          </div>
          {/* CHANGE 2: Phase switcher when active is locked */}
          {phase?.is_locked && nextPhase && (
            <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.82rem', color:'var(--gray-400)' }}>Build team for:</span>
              {[phase, nextPhase].map(ph => (
                <button key={ph.id}
                  className={`btn btn-sm ${(workingPhase?.id || nextPhase?.id) === ph.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setSelectedPhaseId(ph.id)
                    setExistingTeam(null); setSelectedIds([]); setCaptainId(null); setVcId(null); setTeamName('')
                    setTimeout(() => loadData(), 0)
                  }}>
                  {ph.name}{ph.is_locked ? ' 🔒' : ' ✏️'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CHANGE 1: Locked banner */}
        {phaseLocked && (
          <div style={{
            padding: '14px 18px', marginBottom: 20, borderRadius: 10, fontSize: '0.9rem',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--red-400)', fontWeight: 600, display: 'flex', gap: 10, alignItems: 'center'
          }}>
            🔒 <span>This phase is locked by the admin. Your team is saved and cannot be edited until the phase is unlocked.</span>
          </div>
        )}

        {!phaseLocked && (
          <div style={{
            padding: '10px 16px', marginBottom: 16, borderRadius: 8, fontSize: '0.85rem',
            background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', color: 'var(--gray-400)'
          }}>
            📅 Each phase has its own independent team — create freely for <strong style={{ color: 'var(--gold-400)' }}>{workingPhase?.name || phase?.name}</strong>.
          </div>
        )}

        {/* Budget bar */}
        <div className="budget-bar-wrap">
          <div className="budget-top">
            <div className="budget-label">Budget</div>
            <div className="budget-values">
              <div className="budget-val"><div className="budget-val-num remaining">₹{remaining.toLocaleString()}</div><div className="budget-val-label">Remaining</div></div>
              <div className="budget-val"><div className="budget-val-num spent">₹{spentBudget.toLocaleString()}</div><div className="budget-val-label">Spent</div></div>
            </div>
          </div>
          <div className="budget-progress"><div className="budget-fill" style={{ width: `${Math.min((spentBudget / BUDGET) * 100, 100)}%` }} /></div>
        </div>

        {/* Team summary */}
        <div className="team-summary">
          <div className="team-summary-item">Total: <span>{selectedIds.length}/{MAX_TOTAL}</span></div>
          <div className="team-summary-item">Males: <span style={{ color: selectedMales > MAX_MALE ? 'var(--red-400)' : undefined }}>{selectedMales}/{MAX_MALE}</span></div>
          <div className="team-summary-item">Females: <span style={{ color: selectedFemales > MAX_FEMALE ? 'var(--red-400)' : undefined }}>{selectedFemales}/{MAX_FEMALE}</span></div>
          <div className="team-summary-item">Captain: <span>{captainId ? allPlayers.find(p => p.id === captainId)?.name?.split(' ')[0] : '—'}</span></div>
          <div className="team-summary-item">VC: <span>{vcId ? allPlayers.find(p => p.id === vcId)?.name?.split(' ')[0] : '—'}</span></div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn${activeTab === 'select' ? ' active' : ''}`} onClick={() => setActiveTab('select')}>
            🔍 Select Players ({selectedIds.length}/{MAX_TOTAL})
          </button>
          <button className={`tab-btn${activeTab === 'lineup' ? ' active' : ''}`} onClick={() => setActiveTab('lineup')}>
            📋 Set C/VC & Save
          </button>
        </div>

        {/* ── SELECT TAB ── */}
        {activeTab === 'select' && (
          <div>
            <div className="filter-bar">
              <input className="form-input search-input" placeholder="Search player or flat..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-select" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                <option value="All">All Genders</option><option value="Male">Male</option><option value="Female">Female</option>
              </select>
              <select className="form-select" value={filterSkill} onChange={e => setFilterSkill(e.target.value)}>
                <option value="All">All Skills</option>
                {['Batter','Bowler','Batting All Rounder','Bowling All Rounder','Wicket Keeper'].map(s => <option key={s}>{s}</option>)}
              </select>
              <select className="form-select" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
                <option value="All">All DPL Teams</option>
                {dplTeams.map(t => <option key={t.id} value={t.id.toString()}>{t.name}</option>)}
              </select>
              <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ borderColor: sortBy !== 'name_asc' ? 'var(--gold-400)' : undefined }}>
                <option value="name_asc">⬆ Name (A→Z)</option>
                <option value="name_desc">⬇ Name (Z→A)</option>
                <option value="price_high">💰 Price (High→Low)</option>
                <option value="price_low">💰 Price (Low→High)</option>
              </select>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>{filteredPlayers.length} players shown</span>
              {(filterGender !== 'All' || filterSkill !== 'All' || filterTeam !== 'All' || search) && (
                <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', fontSize: '0.75rem' }}
                  onClick={() => { setFilterGender('All'); setFilterSkill('All'); setFilterTeam('All'); setSearch('') }}>✕ Clear</button>
              )}
            </div>
            <div className="player-grid">
              {filteredPlayers.map(player => {
                const isSelected = selectedIds.includes(player.id)
                const canPick    = canSelect(player)
                const isCap      = captainId === player.id
                const isVC       = vcId === player.id
                return (
                  <div key={player.id}
                    className={`player-card${isSelected ? ' selected' : ''}${isCap ? ' captain' : ''}${isVC && !isCap ? ' vice-captain' : ''}${(!canPick && !isSelected) || phaseLocked ? ' disabled' : ''}`}
                    onClick={() => togglePlayer(player)}>
                    <div className="player-name">{player.name}</div>
                    <div className="player-role">{player.skill}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: 6 }}>
                      {player.dpl_team?.name} · {player.flat_number}
                    </div>
                    <div className="player-meta">
                      <span className="player-price">₹{player.auction_price?.toLocaleString()}</span>
                      <span className={`player-gender-badge ${player.gender === 'Male' ? 'gender-m' : 'gender-f'}`}>{player.gender[0]}</span>
                    </div>
                    {isSelected && !phaseLocked && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                        <button className={`btn btn-sm ${isCap ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, fontSize: '0.7rem' }}
                          onClick={e => { e.stopPropagation(); setCaptain(player.id) }}>{isCap ? '👑 C' : 'Set C'}</button>
                        <button className="btn btn-sm btn-secondary"
                          style={{ flex: 1, fontSize: '0.7rem', borderColor: isVC ? 'var(--green-400)' : undefined, color: isVC ? 'var(--green-300)' : undefined }}
                          onClick={e => { e.stopPropagation(); setVC(player.id) }}>{isVC ? '⭐ VC' : 'Set VC'}</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {filteredPlayers.length === 0 && <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-title">No players found</div></div>}
          </div>
        )}

        {/* ── LINEUP TAB ── */}
        {activeTab === 'lineup' && (
          <div>
            <div className="form-group">
              <label className="form-label">Team Name *</label>
              <input className="form-input" style={{ maxWidth: 360 }} placeholder="e.g. Thunder Eagles"
                value={teamName} onChange={e => setTeamName(e.target.value)} disabled={phaseLocked} />
            </div>
            <div className="field-section">
              <div className="field-section-title">🟢 Your Squad — {selectedIds.length}/{MAX_TOTAL} (6M + 2F, all playing)</div>
              {selectedPlayers.length === 0
                ? <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>No players selected. Go to "Select Players" tab.</div>
                : selectedPlayers.map(player => {
                    const isCap = captainId === player.id
                    const isVC  = vcId === player.id
                    return (
                      <div key={player.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 6,
                        background: 'var(--green-800)', border: '1px solid var(--green-600)', borderRadius: 8
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, marginRight: 8 }}>{player.name}</span>
                          {isCap && <span style={{ fontSize: '0.7rem', background: 'var(--gold-400)', color: 'var(--green-950)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>C</span>}
                          {isVC && !isCap && <span style={{ fontSize: '0.7rem', background: 'var(--green-500)', color: 'white', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>VC</span>}
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                            {player.skill} · {player.gender} · ₹{player.auction_price?.toLocaleString()}
                          </div>
                        </div>
                        {!phaseLocked && <>
                          <button className={`btn btn-sm ${isCap ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.72rem', padding: '4px 8px' }} onClick={() => setCaptain(player.id)}>👑 C</button>
                          <button className="btn btn-sm btn-secondary" style={{ fontSize: '0.72rem', padding: '4px 8px', borderColor: isVC ? 'var(--green-400)' : undefined }} onClick={() => setVC(player.id)}>⭐ VC</button>
                          <button className="btn btn-danger btn-sm" style={{ fontSize: '0.72rem', padding: '4px 8px' }} onClick={() => togglePlayer(player)}>✕</button>
                        </>}
                      </div>
                    )
                  })
              }
            </div>

            {/* Validation checklist */}
            <div className="card card-sm mb-3">
              <div className="card-title" style={{ marginBottom: 12 }}>✅ Team Validation</div>
              {[
                { check: selectedIds.length === MAX_TOTAL, label: `${MAX_TOTAL} players selected (${selectedIds.length}/${MAX_TOTAL})` },
                { check: selectedMales === MAX_MALE,       label: `${MAX_MALE} male players (${selectedMales}/${MAX_MALE})` },
                { check: selectedFemales === MAX_FEMALE,   label: `${MAX_FEMALE} female players (${selectedFemales}/${MAX_FEMALE})` },
                { check: !!captainId,                      label: 'Captain selected' },
                { check: !!vcId,                           label: 'Vice-Captain selected' },
                { check: spentBudget <= BUDGET,            label: `Within budget (₹${spentBudget.toLocaleString()} / ₹${BUDGET.toLocaleString()})` },
              ].map(({ check, label }) => (
                <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: '0.875rem' }}>
                  <span>{check ? '✅' : '❌'}</span>
                  <span style={{ color: check ? 'var(--green-300)' : 'var(--red-400)' }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setActiveTab('select')}>← Back to Players</button>
              {!phaseLocked && (
                <button className="btn btn-primary btn-lg" onClick={saveTeam} disabled={saving}>
                  {saving ? 'Saving...' : existingTeam ? '💾 Update Team' : '🏏 Create Team'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
