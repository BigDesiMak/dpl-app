import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const BUDGET = 10000
const MAX_PER_DPL_TEAM = 2
const RULES = { playing: { male: 6, female: 2 }, sub: { male: 1, female: 1 } }

export default function TeamSelection() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase] = useState(null)
  const [allPlayers, setAllPlayers] = useState([])
  const [dplTeams, setDplTeams] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [captainId, setCaptainId] = useState(null)
  const [vcId, setVcId] = useState(null)
  const [playingIds, setPlayingIds] = useState([]) // which 8 are playing
  const [teamName, setTeamName] = useState('')
  const [existingTeam, setExistingTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('select') // select | lineup
  const [filterGender, setFilterGender] = useState('All')
  const [filterSkill, setFilterSkill] = useState('All')
  const [filterTeam, setFilterTeam] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [transfers, setTransfers] = useState([])

  useEffect(() => { loadData() }, [user])

  async function loadData() {
    setLoading(true)
    const { data: ph } = await supabase.from('phases').select('*').eq('is_active', true).maybeSingle()
    setPhase(ph)
    if (!ph) { setLoading(false); return }

    const [{ data: players }, { data: teams }, { data: ft }, { data: xfers }] = await Promise.all([
      supabase.from('players').select('*, dpl_team:dpl_team_id(id, name, short_name)').eq('is_active', true).order('name'),
      supabase.from('dpl_teams').select('*'),
      supabase.from('fantasy_teams').select('*, players:fantasy_team_players(player_id, is_playing)')
        .eq('user_id', user.id).eq('phase_id', ph.id).maybeSingle(),
      supabase.from('transfers').select('*').eq('phase_id', ph.id)
        .eq('fantasy_team_id', (await supabase.from('fantasy_teams').select('id').eq('user_id', user.id).eq('phase_id', ph.id).maybeSingle())?.data?.id || 0)
    ])

    setAllPlayers(players || [])
    setDplTeams(teams || [])
    setTransfers(xfers || [])

    if (ft) {
      setExistingTeam(ft)
      setTeamName(ft.team_name || '')
      const selIds = ft.players?.map(p => p.player_id) || []
      const playIds = ft.players?.filter(p => p.is_playing).map(p => p.player_id) || []
      setSelectedIds(selIds)
      setPlayingIds(playIds)
      setCaptainId(ft.captain_id)
      setVcId(ft.vice_captain_id)
    }
    setLoading(false)
  }

  const selectedPlayers = useMemo(() => allPlayers.filter(p => selectedIds.includes(p.id)), [allPlayers, selectedIds])
  const spentBudget = useMemo(() => selectedPlayers.reduce((s, p) => s + p.auction_price, 0), [selectedPlayers])
  const remainingBudget = BUDGET - spentBudget
  const selectedMales = useMemo(() => selectedPlayers.filter(p => p.gender === 'Male').length, [selectedPlayers])
  const selectedFemales = useMemo(() => selectedPlayers.filter(p => p.gender === 'Female').length, [selectedPlayers])
  const playingMales = useMemo(() => selectedPlayers.filter(p => p.gender === 'Male' && playingIds.includes(p.id)).length, [selectedPlayers, playingIds])
  const playingFemales = useMemo(() => selectedPlayers.filter(p => p.gender === 'Female' && playingIds.includes(p.id)).length, [selectedPlayers, playingIds])

  // DPL team count for selected players
  const dplTeamCounts = useMemo(() => {
    const counts = {}
    selectedPlayers.forEach(p => { if (p.dpl_team_id) counts[p.dpl_team_id] = (counts[p.dpl_team_id] || 0) + 1 })
    return counts
  }, [selectedPlayers])

  const filteredPlayers = useMemo(() => {
    const filtered = allPlayers.filter(p => {
      if (filterGender !== 'All' && p.gender !== filterGender) return false
      if (filterSkill !== 'All' && p.skill !== filterSkill) return false
      if (filterTeam !== 'All' && p.dpl_team_id?.toString() !== filterTeam) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.flat_number?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    return filtered.sort((a, b) => {
      if (sortBy === 'name_asc')   return a.name.localeCompare(b.name)
      if (sortBy === 'name_desc')  return b.name.localeCompare(a.name)
      if (sortBy === 'price_high') return (b.auction_price || 0) - (a.auction_price || 0)
      if (sortBy === 'price_low')  return (a.auction_price || 0) - (b.auction_price || 0)
      // default: selected first, then alphabetical
      const aSelected = selectedIds.includes(a.id) ? 0 : 1
      const bSelected = selectedIds.includes(b.id) ? 0 : 1
      if (aSelected !== bSelected) return aSelected - bSelected
      return a.name.localeCompare(b.name)
    })
  }, [allPlayers, filterGender, filterSkill, filterTeam, search, sortBy, selectedIds])

  function canSelect(player) {
    if (selectedIds.includes(player.id)) return true
    if (selectedIds.length >= 10) return false
    if (remainingBudget < player.auction_price) return false
    if (player.dpl_team_id && (dplTeamCounts[player.dpl_team_id] || 0) >= MAX_PER_DPL_TEAM) return false
    return true
  }

  function togglePlayer(player) {
    if (existingTeam?.is_locked) { toast.error('Team is locked for this phase'); return }
    if (selectedIds.includes(player.id)) {
      setSelectedIds(s => s.filter(id => id !== player.id))
      setPlayingIds(s => s.filter(id => id !== player.id))
      if (captainId === player.id) setCaptainId(null)
      if (vcId === player.id) setVcId(null)
    } else {
      if (!canSelect(player)) {
        if (selectedIds.length >= 10) toast.error('Maximum 10 players allowed')
        else if (remainingBudget < player.auction_price) toast.error('Not enough budget')
        else toast.error(`Max ${MAX_PER_DPL_TEAM} players from same DPL team`)
        return
      }
      setSelectedIds(s => [...s, player.id])
      // Auto-add to playing if slots available
      const male = selectedPlayers.filter(p => p.gender === 'Male' && playingIds.includes(p.id)).length
      const female = selectedPlayers.filter(p => p.gender === 'Female' && playingIds.includes(p.id)).length
      if ((player.gender === 'Male' && male < RULES.playing.male) || (player.gender === 'Female' && female < RULES.playing.female)) {
        setPlayingIds(s => [...s, player.id])
      }
    }
  }

  function togglePlaying(playerId) {
    const player = allPlayers.find(p => p.id === playerId)
    if (!player) return
    if (playingIds.includes(playerId)) {
      setPlayingIds(s => s.filter(id => id !== playerId))
    } else {
      const male = selectedPlayers.filter(p => p.gender === 'Male' && playingIds.includes(p.id)).length
      const female = selectedPlayers.filter(p => p.gender === 'Female' && playingIds.includes(p.id)).length
      const maxPlaying = player.gender === 'Male' ? RULES.playing.male : RULES.playing.female
      const cur = player.gender === 'Male' ? male : female
      if (cur >= maxPlaying) { toast.error(`Max ${maxPlaying} ${player.gender} players in playing XI`); return }
      setPlayingIds(s => [...s, playerId])
    }
  }

  function setCaptain(id) {
    if (id === vcId) { toast.error('Same player cannot be Captain and Vice-Captain'); return }
    setCaptainId(id)
  }

  function setVC(id) {
    if (id === captainId) { toast.error('Same player cannot be Captain and Vice-Captain'); return }
    setVcId(id)
  }

  function validateTeam() {
    if (!teamName.trim()) { toast.error('Please enter a team name'); return false }
    if (selectedIds.length !== 10) { toast.error(`Select exactly 10 players (currently ${selectedIds.length})`); return false }
    if (playingIds.length !== 8) { toast.error(`Set exactly 8 playing players (currently ${playingIds.length})`); return false }
    if (playingMales !== RULES.playing.male) { toast.error(`Playing XI must have exactly ${RULES.playing.male} males (currently ${playingMales})`); return false }
    if (playingFemales !== RULES.playing.female) { toast.error(`Playing XI must have exactly ${RULES.playing.female} females (currently ${playingFemales})`); return false }
    if (!captainId) { toast.error('Please select a Captain'); return false }
    if (!vcId) { toast.error('Please select a Vice-Captain'); return false }
    if (!selectedIds.includes(captainId)) { toast.error('Captain must be in your selected team'); return false }
    if (!selectedIds.includes(vcId)) { toast.error('Vice-Captain must be in your selected team'); return false }
    if (spentBudget > BUDGET) { toast.error('Team exceeds budget'); return false }
    return true
  }

  async function saveTeam() {
    if (!validateTeam()) return
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
          user_id: user.id, phase_id: phase.id, team_name: teamName,
          captain_id: captainId, vice_captain_id: vcId, total_budget: BUDGET, spent_budget: spentBudget
        }).select().single()
        teamId = data.id
      }
      const playerRows = selectedIds.map((pid, idx) => ({
        fantasy_team_id: teamId, player_id: pid, is_playing: playingIds.includes(pid), position: idx + 1
      }))
      await supabase.from('fantasy_team_players').insert(playerRows)
      toast.success(existingTeam ? 'Team updated successfully! 🏏' : 'Team created successfully! 🏏')
      navigate('/dashboard')
    } catch (err) {
      toast.error('Failed to save team: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner" /></div></Layout>

  if (!phase) return (
    <Layout>
      <div className="page-content">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="empty-state-icon">⏳</div>
          <h2 className="empty-state-title">No Active Phase</h2>
          <p className="empty-state-desc">Team selection will open when admin activates a phase.</p>
        </div>
      </div>
    </Layout>
  )

  const subPlayers = selectedPlayers.filter(p => !playingIds.includes(p.id))
  const playingPlayers = selectedPlayers.filter(p => playingIds.includes(p.id))

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">{existingTeam ? 'Edit Your Team' : 'Build Your Team'}</h1>
          <p className="page-subtitle">{phase.name} · Budget: ₹{BUDGET.toLocaleString()} credits</p>
        </div>

        {/* Budget Bar */}
        <div className="budget-bar-wrap">
          <div className="budget-top">
            <div className="budget-label">Budget</div>
            <div className="budget-values">
              <div className="budget-val">
                <div className="budget-val-num remaining">₹{remainingBudget.toLocaleString()}</div>
                <div className="budget-val-label">Remaining</div>
              </div>
              <div className="budget-val">
                <div className="budget-val-num spent">₹{spentBudget.toLocaleString()}</div>
                <div className="budget-val-label">Spent</div>
              </div>
            </div>
          </div>
          <div className="budget-progress">
            <div className="budget-fill" style={{ width: `${Math.min((spentBudget / BUDGET) * 100, 100)}%` }} />
          </div>
        </div>

        {/* Team Summary */}
        <div className="team-summary">
          <div className="team-summary-item">Players: <span>{selectedIds.length}/10</span></div>
          <div className="team-summary-item">Males: <span>{selectedMales}</span></div>
          <div className="team-summary-item">Females: <span>{selectedFemales}</span></div>
          <div className="team-summary-item">Playing: <span>{playingIds.length}/8</span></div>
          <div className="team-summary-item">Captain: <span>{captainId ? allPlayers.find(p=>p.id===captainId)?.name?.split(' ')[0] : '—'}</span></div>
          <div className="team-summary-item">VC: <span>{vcId ? allPlayers.find(p=>p.id===vcId)?.name?.split(' ')[0] : '—'}</span></div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn${activeTab==='select'?' active':''}`} onClick={() => setActiveTab('select')}>
            🔍 Select Players ({selectedIds.length}/10)
          </button>
          <button className={`tab-btn${activeTab==='lineup'?' active':''}`} onClick={() => setActiveTab('lineup')}>
            📋 Set Lineup & Save
          </button>
        </div>

        {/* SELECT PLAYERS TAB */}
        {activeTab === 'select' && (
          <div>
            <div className="filter-bar">
              <input className="form-input search-input" placeholder="Search player or flat..." value={search} onChange={e=>setSearch(e.target.value)} />
              <select className="form-select" value={filterGender} onChange={e=>setFilterGender(e.target.value)}>
                <option value="All">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <select className="form-select" value={filterSkill} onChange={e=>setFilterSkill(e.target.value)}>
                <option value="All">All Skills</option>
                {['Batter', 'Bowler', 'Batting All Rounder', 'Bowling All Rounder', 'Wicket Keeper'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="form-select" value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}>
                <option value="All">All DPL Teams</option>
                {dplTeams.map(t => <option key={t.id} value={t.id.toString()}>{t.name}</option>)}
              </select>
              <select className="form-select" value={sortBy} onChange={e=>setSortBy(e.target.value)}
                style={{ borderColor: sortBy !== 'name_asc' ? 'var(--gold-400)' : undefined }}>
                <option value="name_asc">⬆ Name (A→Z)</option>
                <option value="name_desc">⬇ Name (Z→A)</option>
                <option value="price_high">💰 Price (High→Low)</option>
                <option value="price_low">💰 Price (Low→High)</option>
              </select>
            </div>
            {/* Sort/filter summary */}
            <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>{filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''} shown</span>
              {filterGender !== 'All' && <span>· Gender: <strong style={{color:'var(--cream)'}}>{filterGender}</strong></span>}
              {filterSkill !== 'All' && <span>· Skill: <strong style={{color:'var(--cream)'}}>{filterSkill}</strong></span>}
              {filterTeam !== 'All' && <span>· Team filtered</span>}
              {search && <span>· Search: <strong style={{color:'var(--cream)'}}>{search}</strong></span>}
              {(filterGender !== 'All' || filterSkill !== 'All' || filterTeam !== 'All' || search) &&
                <button className="btn btn-ghost btn-sm" style={{padding:'0 4px', fontSize:'0.75rem'}}
                  onClick={() => { setFilterGender('All'); setFilterSkill('All'); setFilterTeam('All'); setSearch('') }}>
                  ✕ Clear filters
                </button>
              }
            </div>
            <div className="player-grid">
              {filteredPlayers.map(player => {
                const isSelected = selectedIds.includes(player.id)
                const canPick = canSelect(player)
                const isCap = captainId === player.id
                const isVC = vcId === player.id
                return (
                  <div key={player.id}
                    className={`player-card${isSelected?' selected':''}${isCap?' captain':''}${isVC&&!isCap?' vice-captain':''}${!canPick&&!isSelected?' disabled':''}`}
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
                    {isSelected && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                        <button className={`btn btn-sm ${isCap ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, fontSize: '0.7rem' }}
                          onClick={e => { e.stopPropagation(); setCaptain(player.id) }}>
                          {isCap ? '👑 C' : 'Set C'}
                        </button>
                        <button className={`btn btn-sm ${isVC ? 'btn-secondary' : 'btn-secondary'}`}
                          style={{ flex: 1, fontSize: '0.7rem', borderColor: isVC ? 'var(--green-400)' : undefined, color: isVC ? 'var(--green-300)' : undefined }}
                          onClick={e => { e.stopPropagation(); setVC(player.id) }}>
                          {isVC ? '⭐ VC' : 'Set VC'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {filteredPlayers.length === 0 && <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-title">No players found</div></div>}
          </div>
        )}

        {/* LINEUP TAB */}
        {activeTab === 'lineup' && (
          <div>
            <div className="form-group">
              <label className="form-label">Team Name *</label>
              <input className="form-input" style={{ maxWidth: 360 }} placeholder="e.g. Thunder Eagles XI" value={teamName} onChange={e => setTeamName(e.target.value)} />
            </div>

            <div className="field-section">
              <div className="field-section-title">🟢 Playing XI — {playingPlayers.length}/8 (need {RULES.playing.male}M + {RULES.playing.female}F)</div>
              {selectedPlayers.length === 0 ? (
                <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>No players selected yet. Go to "Select Players" tab.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedPlayers.map(player => {
                    const isPlaying = playingIds.includes(player.id)
                    const isCap = captainId === player.id
                    const isVC = vcId === player.id
                    return (
                      <div key={player.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        background: isPlaying ? 'var(--green-800)' : 'var(--green-900)',
                        border: `1px solid ${isPlaying ? 'var(--green-600)' : 'var(--green-800)'}`,
                        borderRadius: 8, opacity: isPlaying ? 1 : 0.6
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, marginRight: 8 }}>{player.name}</span>
                          {isCap && <span style={{ fontSize: '0.7rem', background: 'var(--gold-400)', color: 'var(--green-950)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>C</span>}
                          {isVC && !isCap && <span style={{ fontSize: '0.7rem', background: 'var(--green-500)', color: 'white', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>VC</span>}
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                            {player.skill} · {player.gender} · ₹{player.auction_price?.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className={`btn btn-sm ${isCap ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                            onClick={() => setCaptain(player.id)}>👑 C</button>
                          <button className={`btn btn-sm btn-secondary`}
                            style={{ fontSize: '0.72rem', padding: '4px 8px', borderColor: isVC ? 'var(--green-400)' : undefined }}
                            onClick={() => setVC(player.id)}>⭐ VC</button>
                          <button className={`btn btn-sm ${isPlaying ? 'btn-danger' : 'btn-primary'}`}
                            style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                            onClick={() => togglePlaying(player.id)}>
                            {isPlaying ? '→ Sub' : '← Play'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Validation checklist */}
            <div className="card card-sm mb-3">
              <div className="card-title" style={{ marginBottom: 12 }}>✅ Team Validation</div>
              {[
                { check: selectedIds.length === 10, label: `10 players selected (${selectedIds.length}/10)` },
                { check: playingIds.length === 8, label: `8 playing players (${playingIds.length}/8)` },
                { check: playingMales === 6, label: `6 males in playing XI (${playingMales}/6)` },
                { check: playingFemales === 2, label: `2 females in playing XI (${playingFemales}/2)` },
                { check: !!captainId, label: 'Captain selected' },
                { check: !!vcId, label: 'Vice-Captain selected' },
                { check: spentBudget <= BUDGET, label: `Within budget (₹${spentBudget.toLocaleString()} / ₹${BUDGET.toLocaleString()})` },
              ].map(({ check, label }) => (
                <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: '0.875rem' }}>
                  <span>{check ? '✅' : '❌'}</span>
                  <span style={{ color: check ? 'var(--green-300)' : 'var(--red-400)' }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setActiveTab('select')}>← Back to Players</button>
              <button className="btn btn-primary btn-lg" onClick={saveTeam} disabled={saving}>
                {saving ? 'Saving...' : existingTeam ? '💾 Update Team' : '🏏 Create Team'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
