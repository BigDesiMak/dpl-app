import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const BLANK_STAT = {
  did_bat: false, runs: 0, balls_faced: 0, fours: 0, sixes: 0, is_out: false,
  did_bowl: false, overs_bowled: 0, wickets: 0, runs_conceded: 0,
  maidens: 0, wides: 0, no_balls: 0, dot_balls: 0,
  catches: 0, stumpings: 0, run_outs: 0
}

function NumInput({ pid, field, label, min = 0, step = 1, stats, onChange }) {
  const val = (stats[pid] || BLANK_STAT)[field]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 72 }}>
      <label style={{ fontSize: '0.68rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <input
        type="number" min={min} step={step}
        className="form-input"
        style={{ padding: '6px 8px', fontSize: '0.875rem' }}
        value={val}
        onChange={e => onChange(pid, field, parseFloat(e.target.value) || 0)}
      />
    </div>
  )
}

export default function AdminMatchStats() {
  const { matchId } = useParams()
  const navigate    = useNavigate()
  const { user }    = useAuth()

  const [match, setMatch]               = useState(null)
  const [players, setPlayers]           = useState([])
  const [stats, setStats]               = useState({})        // { playerId: stat_obj }
  const [existingIds, setExistingIds]   = useState({})        // { playerId: db_row_id }
  const [activePlayer, setActivePlayer] = useState(null)
  const [saving, setSaving]             = useState(false)
  const [savingPlayer, setSavingPlayer] = useState(null)      // id of player being individually saved
  const [loading, setLoading]           = useState(true)
  const [filterTeam, setFilterTeam]     = useState('All')
  const [filterPlayed, setFilterPlayed] = useState(false)
  const [search, setSearch]             = useState('')
  const [unsaved, setUnsaved]           = useState(new Set()) // player ids with unsaved changes
  const [lastSaved, setLastSaved]       = useState(null)

  const isEditMode = match?.stats_entered === true

  useEffect(() => { loadData() }, [matchId])

  async function loadData() {
    setLoading(true)

    const { data: m } = await supabase
      .from('matches')
      .select('*, team1:team1_id(id,name,color), team2:team2_id(id,name,color), phase:phase_id(name)')
      .eq('id', matchId).single()
    setMatch(m)

    const { data: ps } = await supabase
      .from('players')
      .select('*, dpl_team:dpl_team_id(id,name)')
      .eq('is_active', true)
      .order('gender').order('name')      // females grouped after males
    setPlayers(ps || [])

    // Load ALL existing stats for this match
    const { data: existing } = await supabase
      .from('player_match_stats')
      .select('*')
      .eq('match_id', matchId)

    const idMap  = {}
    const statMap = {}
    existing?.forEach(row => {
      idMap[row.player_id] = row.id
      statMap[row.player_id] = {
        did_bat:       row.did_bat,
        runs:          row.runs,
        balls_faced:   row.balls_faced,
        fours:         row.fours,
        sixes:         row.sixes,
        is_out:        row.is_out,
        did_bowl:      row.did_bowl,
        overs_bowled:  row.overs_bowled,
        wickets:       row.wickets,
        runs_conceded: row.runs_conceded,
        maidens:       row.maidens,
        wides:         row.wides,
        no_balls:      row.no_balls,
        dot_balls:     row.dot_balls,
        catches:       row.catches,
        stumpings:     row.stumpings,
        run_outs:      row.run_outs,
      }
    })

    setExistingIds(idMap)
    setStats(statMap)
    setUnsaved(new Set())
    setLastSaved(existing?.length ? new Date() : null)
    if (ps?.[0]) setActivePlayer(ps[0].id)
    setLoading(false)
  }

  // Mark a player's stat as changed
  function handleStatChange(pid, field, value) {
    setStats(s => ({ ...s, [pid]: { ...(s[pid] || { ...BLANK_STAT }), [field]: value } }))
    setUnsaved(u => new Set(u).add(pid))
  }

  function handleBoolChange(pid, field, checked) {
    setStats(s => ({ ...s, [pid]: { ...(s[pid] || { ...BLANK_STAT }), [field]: checked } }))
    setUnsaved(u => new Set(u).add(pid))
  }

  // Save a single player's stats immediately
  async function savePlayer(pid) {
    const s = stats[pid] || BLANK_STAT
    setSavingPlayer(pid)
    try {
      const payload = {
        player_id:     parseInt(pid),
        match_id:      parseInt(matchId),
        entered_by:    user.id,
        ...s
      }
      if (existingIds[pid]) {
        await supabase.from('player_match_stats').update(payload).eq('id', existingIds[pid])
      } else {
        const { data } = await supabase.from('player_match_stats').insert(payload).select().single()
        if (data) setExistingIds(ids => ({ ...ids, [pid]: data.id }))
      }
      // Ensure match is marked complete + stats_entered
      await supabase.from('matches')
        .update({ stats_entered: true, is_completed: true })
        .eq('id', matchId)

      setMatch(m => ({ ...m, stats_entered: true, is_completed: true }))
      setUnsaved(u => { const next = new Set(u); next.delete(parseInt(pid)); return next })
      setLastSaved(new Date())
      toast.success(`Stats saved for ${players.find(p => p.id === parseInt(pid))?.name}`)
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    } finally {
      setSavingPlayer(null)
    }
  }

  // Save ALL players at once
  async function saveAll() {
    const toSave = players.filter(p => {
      const s = stats[p.id]
      return s && (s.did_bat || s.did_bowl || s.catches > 0 || s.stumpings > 0 || s.run_outs > 0)
    })

    if (toSave.length === 0) {
      toast.error('No player stats to save — mark at least one player as batted, bowled, or fielded.')
      return
    }

    setSaving(true)
    let savedCount = 0
    try {
      for (const player of toSave) {
        const s = stats[player.id]
        const payload = { player_id: player.id, match_id: parseInt(matchId), entered_by: user.id, ...s }
        if (existingIds[player.id]) {
          await supabase.from('player_match_stats').update(payload).eq('id', existingIds[player.id])
        } else {
          const { data } = await supabase.from('player_match_stats').insert(payload).select().single()
          if (data) setExistingIds(ids => ({ ...ids, [player.id]: data.id }))
        }
        savedCount++
      }

      await supabase.from('matches')
        .update({ stats_entered: true, is_completed: true })
        .eq('id', matchId)

      setMatch(m => ({ ...m, stats_entered: true, is_completed: true }))
      setUnsaved(new Set())
      setLastSaved(new Date())
      toast.success(`✅ Stats saved for ${savedCount} players! Fantasy points recalculated.`)
    } catch (err) {
      toast.error('Error saving: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Delete a single player's stats (reset to zero)
  async function clearPlayer(pid) {
    if (!existingIds[pid]) {
      // Not saved yet — just clear local state
      setStats(s => { const n = { ...s }; delete n[pid]; return n })
      setUnsaved(u => { const next = new Set(u); next.delete(pid); return next })
      return
    }
    if (!window.confirm(`Clear all stats for ${players.find(p => p.id === pid)?.name}?`)) return
    await supabase.from('player_match_stats').delete().eq('id', existingIds[pid])
    setStats(s => { const n = { ...s }; delete n[pid]; return n })
    setExistingIds(ids => { const n = { ...ids }; delete n[pid]; return n })
    setUnsaved(u => { const next = new Set(u); next.delete(pid); return next })
    toast.success('Stats cleared')
  }

  const filteredPlayers = players.filter(p => {
    if (filterTeam !== 'All' && p.dpl_team_id?.toString() !== filterTeam) return false
    if (filterPlayed) {
      const s = stats[p.id]
      if (!s || (!s.did_bat && !s.did_bowl && !s.catches && !s.stumpings && !s.run_outs)) return false
    }
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const playersWithStats = players.filter(p => {
    const s = stats[p.id]
    return s && (s.did_bat || s.did_bowl || s.catches > 0 || s.stumpings > 0 || s.run_outs > 0)
  }).length

  const dplTeams = [...new Map(
    players.filter(p => p.dpl_team).map(p => [p.dpl_team_id, p.dpl_team])
  ).values()]

  const hasUnsaved = unsaved.size > 0

  if (loading) return (
    <Layout>
      <div className="loading-center"><div className="loading-spinner" /></div>
    </Layout>
  )

  if (!match) return (
    <Layout>
      <div className="page-content">
        <div className="empty-state"><div className="empty-state-title">Match not found</div></div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="page-content">

        {/* ── Page Header ── */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/matches')}>
              ← Back
            </button>
            <h1 className="page-title" style={{ margin: 0 }}>
              {isEditMode ? '✏️ Edit Match Stats' : '📊 Enter Match Stats'}
            </h1>
            {isEditMode
              ? <span className="badge badge-green">Stats Saved — Editing</span>
              : <span className="badge badge-gold">First Entry</span>
            }
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--gold-400)' }}>
              Match {match.match_number}: {match.team1?.name} vs {match.team2?.name}
            </span>
            {match.phase && <span className="phase-indicator"><span className="phase-dot" />{match.phase.name}</span>}
            {match.match_date && <span style={{ color: 'var(--gray-400)' }}>{match.match_date}</span>}
          </div>
        </div>

        {/* ── Status Bar ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12, padding: '14px 18px', marginBottom: 20,
          background: isEditMode ? 'rgba(34,135,92,0.08)' : 'rgba(212,175,55,0.08)',
          border: `1px solid ${isEditMode ? 'rgba(34,135,92,0.3)' : 'rgba(212,175,55,0.25)'}`,
          borderRadius: 12
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--gray-400)' }}>
              Stats entered: <strong style={{ color: 'var(--gold-400)' }}>{playersWithStats} players</strong>
            </span>
            {hasUnsaved && (
              <span style={{ color: 'var(--yellow-400)', fontWeight: 600 }}>
                ⚠ {unsaved.size} player{unsaved.size > 1 ? 's' : ''} with unsaved changes
              </span>
            )}
            {lastSaved && !hasUnsaved && (
              <span style={{ color: 'var(--green-300)' }}>
                ✓ All saved · {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/matches')}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={saveAll}
              disabled={saving}
              style={{ minWidth: 180 }}
            >
              {saving
                ? '⏳ Saving & Recalculating...'
                : isEditMode
                  ? `💾 Save All & Recalculate`
                  : `💾 Save All Stats`
              }
            </button>
          </div>
        </div>

        {/* ── Edit mode info banner ── */}
        {isEditMode && (
          <div style={{
            padding: '10px 16px', marginBottom: 16, borderRadius: 8, fontSize: '0.85rem',
            background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
            color: 'var(--gray-400)'
          }}>
            💡 <strong style={{ color: 'var(--blue-400)' }}>Edit mode:</strong> Changes are highlighted in gold.
            Use <strong>Save Player</strong> to update one player instantly, or <strong>Save All</strong> to recalculate all fantasy points at once.
          </div>
        )}

        {/* ── Filters ── */}
        <div className="filter-bar">
          <input
            className="form-input search-input"
            placeholder="Search player..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
            <option value="All">All DPL Teams</option>
            {dplTeams.map(t => <option key={t.id} value={t.id.toString()}>{t.name}</option>)}
          </select>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={filterPlayed} onChange={e => setFilterPlayed(e.target.checked)} />
            Stats entered only
          </label>
        </div>

        {/* ── Players List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredPlayers.map(player => {
            const s          = stats[player.id] || BLANK_STAT
            const hasStats   = s.did_bat || s.did_bowl || s.catches > 0 || s.stumpings > 0 || s.run_outs > 0
            const isOpen     = activePlayer === player.id
            const isDirty    = unsaved.has(player.id)
            const isSavingThis = savingPlayer === player.id

            return (
              <div key={player.id} style={{
                background: hasStats ? 'var(--green-800)' : 'var(--green-900)',
                border: `1px solid ${isDirty ? 'var(--gold-400)' : hasStats ? 'var(--green-500)' : 'var(--green-700)'}`,
                borderRadius: 12, overflow: 'hidden',
                boxShadow: isDirty ? '0 0 0 1px rgba(212,175,55,0.2)' : 'none',
                transition: 'border-color 0.15s'
              }}>

                {/* ── Collapsed Row ── */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                  onClick={() => setActivePlayer(isOpen ? null : player.id)}
                >
                  {/* Gender dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: player.gender === 'Female' ? '#fb7185' : '#60a5fa'
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, marginRight: 8 }}>{player.name}</span>
                    {isDirty && (
                      <span style={{ fontSize: '0.68rem', background: 'rgba(212,175,55,0.2)', color: 'var(--gold-400)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                        UNSAVED
                      </span>
                    )}
                    {existingIds[player.id] && !isDirty && (
                      <span style={{ fontSize: '0.68rem', background: 'rgba(34,135,92,0.2)', color: 'var(--green-300)', padding: '1px 6px', borderRadius: 4 }}>
                        SAVED
                      </span>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                      {player.skill} · {player.gender} ·
                      <span style={{ marginLeft: 4, background: 'var(--green-700)', padding: '0 5px', borderRadius: 3 }}>
                        {player.dpl_team?.name || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Stats summary chips */}
                  {hasStats && (
                    <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {s.did_bat && (
                        <span style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6, padding: '2px 8px', color: 'var(--gold-300)' }}>
                          🏏 {s.runs}({s.balls_faced}) {s.fours}×4 {s.sixes}×6
                        </span>
                      )}
                      {s.did_bowl && (
                        <span style={{ background: 'rgba(34,135,92,0.1)', border: '1px solid rgba(34,135,92,0.2)', borderRadius: 6, padding: '2px 8px', color: 'var(--green-300)' }}>
                          🎯 {s.wickets}wkt / {s.overs_bowled}ov
                        </span>
                      )}
                      {(s.catches > 0 || s.stumpings > 0 || s.run_outs > 0) && (
                        <span style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 6, padding: '2px 8px', color: 'var(--blue-400)' }}>
                          🧤 {s.catches}c {s.stumpings}st {s.run_outs}ro
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action buttons (visible on hover or always on mobile) */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {isDirty && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => savePlayer(player.id)}
                        disabled={isSavingThis}
                      >
                        {isSavingThis ? '⏳' : '💾 Save'}
                      </button>
                    )}
                    {hasStats && (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                        onClick={() => clearPlayer(player.id)}
                        title="Clear all stats for this player"
                      >
                        ✕
                      </button>
                    )}
                    <span style={{ color: 'var(--gray-400)', fontSize: '0.8rem', padding: '0 2px' }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* ── Expanded Stat Entry ── */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--green-700)', padding: '16px 18px', background: 'rgba(0,0,0,0.12)' }}>

                    {/* BATTING */}
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer', fontWeight: 700, color: 'var(--gold-400)' }}>
                        <input
                          type="checkbox"
                          checked={s.did_bat}
                          onChange={e => handleBoolChange(player.id, 'did_bat', e.target.checked)}
                        />
                        🏏 Batting
                      </label>
                      {s.did_bat && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          <NumInput pid={player.id} field="runs"        label="Runs"      stats={stats} onChange={handleStatChange} />
                          <NumInput pid={player.id} field="balls_faced" label="Balls"     stats={stats} onChange={handleStatChange} />
                          <NumInput pid={player.id} field="fours"       label="4s"        stats={stats} onChange={handleStatChange} />
                          <NumInput pid={player.id} field="sixes"       label="6s"        stats={stats} onChange={handleStatChange} />
                          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={s.is_out}
                                onChange={e => handleBoolChange(player.id, 'is_out', e.target.checked)}
                              />
                              Got Out
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BOWLING */}
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer', fontWeight: 700, color: 'var(--green-300)' }}>
                        <input
                          type="checkbox"
                          checked={s.did_bowl}
                          onChange={e => handleBoolChange(player.id, 'did_bowl', e.target.checked)}
                        />
                        🎯 Bowling
                      </label>
                      {s.did_bowl && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          <NumInput pid={player.id} field="overs_bowled"  label="Overs"      stats={stats} onChange={handleStatChange} step={0.1} />
                          <NumInput pid={player.id} field="wickets"        label="Wickets"    stats={stats} onChange={handleStatChange} />
                          <NumInput pid={player.id} field="runs_conceded"  label="Runs Given" stats={stats} onChange={handleStatChange} />
                          <NumInput pid={player.id} field="maidens"        label="Maidens"    stats={stats} onChange={handleStatChange} />
                          <NumInput pid={player.id} field="dot_balls"      label="Dots"       stats={stats} onChange={handleStatChange} />
                          <NumInput pid={player.id} field="wides"          label="Wides"      stats={stats} onChange={handleStatChange} />
                          <NumInput pid={player.id} field="no_balls"       label="No Balls"   stats={stats} onChange={handleStatChange} />
                        </div>
                      )}
                    </div>

                    {/* FIELDING */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, color: 'var(--blue-400)', marginBottom: 14 }}>🧤 Fielding</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        <NumInput pid={player.id} field="catches"   label="Catches"   stats={stats} onChange={handleStatChange} />
                        <NumInput pid={player.id} field="stumpings" label="Stumpings" stats={stats} onChange={handleStatChange} />
                        <NumInput pid={player.id} field="run_outs"  label="Run Outs"  stats={stats} onChange={handleStatChange} />
                      </div>
                    </div>

                    {/* Per-player save / clear row */}
                    <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--green-700)' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => savePlayer(player.id)}
                        disabled={isSavingThis || !hasStats}
                      >
                        {isSavingThis ? '⏳ Saving...' : existingIds[player.id] ? '💾 Update Player' : '💾 Save Player'}
                      </button>
                      {hasStats && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => clearPlayer(player.id)}
                        >
                          ✕ Clear Stats
                        </button>
                      )}
                      {isDirty && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            // Reload original from DB
                            loadData()
                            toast('Changes discarded — reloaded from database')
                          }}
                        >
                          ↩ Discard Changes
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {filteredPlayers.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No players found</div>
            </div>
          )}
        </div>

        {/* ── Sticky Bottom Save Bar ── */}
        <div style={{
          position: 'sticky', bottom: 16, marginTop: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--green-900)', border: '1px solid var(--green-700)',
          borderRadius: 12, padding: '12px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          flexWrap: 'wrap', gap: 12
        }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--gray-400)' }}>
            {hasUnsaved
              ? <span style={{ color: 'var(--yellow-400)' }}>⚠ {unsaved.size} unsaved change{unsaved.size > 1 ? 's' : ''}</span>
              : lastSaved
                ? <span style={{ color: 'var(--green-300)' }}>✓ All saved · {lastSaved.toLocaleTimeString()}</span>
                : <span>{playersWithStats} players with stats</span>
            }
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={saveAll}
            disabled={saving}
          >
            {saving
              ? '⏳ Saving & Recalculating...'
              : isEditMode
                ? `💾 Save All & Recalculate Points`
                : `💾 Save All Stats (${playersWithStats} players)`
            }
          </button>
        </div>

      </div>
    </Layout>
  )
}
