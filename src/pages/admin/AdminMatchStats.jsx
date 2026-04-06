import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const BLANK_STAT = {
  did_bat: false, runs: 0, balls_faced: 0, fours: 0, sixes: 0, is_out: false,
  did_bowl: false, overs_bowled: 0, wickets: 0, runs_conceded: 0, maidens: 0, wides: 0, no_balls: 0, dot_balls: 0,
  catches: 0, stumpings: 0, run_outs: 0
}

export default function AdminMatchStats() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [match, setMatch] = useState(null)
  const [players, setPlayers] = useState([])
  const [stats, setStats] = useState({}) // { playerId: stat_obj }
  const [existingStats, setExistingStats] = useState({})
  const [saving, setSaving] = useState(false)
  const [filterTeam, setFilterTeam] = useState('All')
  const [filterPlayed, setFilterPlayed] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activePlayer, setActivePlayer] = useState(null) // expanded player

  useEffect(() => { loadData() }, [matchId])

  async function loadData() {
    setLoading(true)
    const { data: m } = await supabase.from('matches')
      .select('*, team1:team1_id(id,name,color), team2:team2_id(id,name,color), phase:phase_id(name)')
      .eq('id', matchId).single()
    setMatch(m)

    const { data: ps } = await supabase.from('players').select('*, dpl_team:dpl_team_id(id,name)').eq('is_active', true).order('name')
    setPlayers(ps || [])

    const { data: existing } = await supabase.from('player_match_stats').select('*').eq('match_id', matchId)
    const existMap = {}
    const statMap = {}
    existing?.forEach(s => {
      existMap[s.player_id] = s.id
      statMap[s.player_id] = {
        did_bat: s.did_bat, runs: s.runs, balls_faced: s.balls_faced, fours: s.fours, sixes: s.sixes, is_out: s.is_out,
        did_bowl: s.did_bowl, overs_bowled: s.overs_bowled, wickets: s.wickets, runs_conceded: s.runs_conceded,
        maidens: s.maidens, wides: s.wides, no_balls: s.no_balls, dot_balls: s.dot_balls,
        catches: s.catches, stumpings: s.stumpings, run_outs: s.run_outs
      }
    })
    setExistingStats(existMap)
    setStats(statMap)
    if (ps?.[0]) setActivePlayer(ps[0].id)
    setLoading(false)
  }

  function getStat(pid, key) { return (stats[pid] || BLANK_STAT)[key] }
  function setStat(pid, key, value) {
    setStats(s => ({
      ...s,
      [pid]: { ...(s[pid] || { ...BLANK_STAT }), [key]: value }
    }))
  }
  function setStatNum(pid, key) { return e => setStat(pid, key, parseFloat(e.target.value) || 0) }
  function setStatBool(pid, key) { return e => setStat(pid, key, e.target.checked) }

  async function saveAll() {
    const toSave = Object.entries(stats).filter(([pid, s]) => s.did_bat || s.did_bowl || s.catches > 0 || s.stumpings > 0 || s.run_outs > 0)
    if (toSave.length === 0) { toast.error('No player stats to save. At least one player must have batted, bowled, or fielded.'); return }
    setSaving(true)
    try {
      for (const [pid, s] of toSave) {
        const payload = { player_id: parseInt(pid), match_id: parseInt(matchId), entered_by: user.id, ...s }
        if (existingStats[pid]) {
          await supabase.from('player_match_stats').update(payload).eq('id', existingStats[pid])
        } else {
          await supabase.from('player_match_stats').insert(payload)
        }
      }
      // Mark match stats_entered
      await supabase.from('matches').update({ stats_entered: true, is_completed: true }).eq('id', matchId)
      toast.success(`Stats saved for ${toSave.length} players! Fantasy points auto-calculated. 🏆`)
      navigate('/admin/matches')
    } catch (err) {
      toast.error('Error saving stats: ' + err.message)
    } finally {
      setSaving(false)
    }
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

  const NumInput = ({ pid, field, label, min = 0, step = 1 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 70 }}>
      <label style={{ fontSize: '0.68rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <input type="number" min={min} step={step} className="form-input" style={{ padding: '6px 8px', fontSize: '0.875rem' }}
        value={getStat(pid, field)} onChange={setStatNum(pid, field)} />
    </div>
  )

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner"/></div></Layout>
  if (!match) return <Layout><div className="page-content"><div className="empty-state"><div className="empty-state-title">Match not found</div></div></div></Layout>

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Enter Match Stats 📊</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="phase-indicator"><span className="phase-dot"/>{match.phase?.name}</div>
            <span style={{ color: 'var(--gold-400)', fontWeight: 700, fontSize: '1.1rem' }}>
              Match {match.match_number}: {match.team1?.name} vs {match.team2?.name}
            </span>
            {match.match_date && <span style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>{match.match_date}</span>}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>
            Stats entered for <strong style={{ color: 'var(--gold-400)' }}>{playersWithStats}</strong> players
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/matches')}>Cancel</button>
            <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
              {saving ? 'Saving & Calculating Points...' : `💾 Save All Stats (${playersWithStats} players)`}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <input className="form-input search-input" placeholder="Search player..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
            <option value="All">All DPL Teams</option>
            {[...new Map(players.filter(p=>p.dpl_team).map(p=>[p.dpl_team_id, p.dpl_team])).values()].map(t => <option key={t.id} value={t.id.toString()}>{t.name}</option>)}
          </select>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={filterPlayed} onChange={e => setFilterPlayed(e.target.checked)} />
            Show only entered
          </label>
        </div>

        {/* Players list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredPlayers.map(player => {
            const s = stats[player.id] || BLANK_STAT
            const hasStats = s.did_bat || s.did_bowl || s.catches > 0 || s.stumpings > 0 || s.run_outs > 0
            const isOpen = activePlayer === player.id

            return (
              <div key={player.id} style={{
                background: hasStats ? 'var(--green-800)' : 'var(--green-900)',
                border: `1px solid ${hasStats ? 'var(--green-500)' : 'var(--green-700)'}`,
                borderRadius: 12, overflow: 'hidden'
              }}>
                {/* Player header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                  onClick={() => setActivePlayer(isOpen ? null : player.id)}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{player.name}</span>
                    <span style={{ marginLeft: 10, fontSize: '0.75rem', color: 'var(--gray-400)' }}>{player.skill} · {player.gender}</span>
                    {player.dpl_team && <span style={{ marginLeft: 8, fontSize: '0.72rem', background: 'var(--green-700)', padding: '1px 6px', borderRadius: 4 }}>{player.dpl_team.name}</span>}
                  </div>
                  {hasStats && (
                    <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem' }}>
                      {s.did_bat && <span>🏏 {s.runs}({s.balls_faced})</span>}
                      {s.did_bowl && <span>🎯 {s.wickets}w/{s.overs_bowled}ov</span>}
                      {(s.catches > 0 || s.stumpings > 0 || s.run_outs > 0) && <span>🧤 {s.catches}c</span>}
                    </div>
                  )}
                  {hasStats && <span className="badge badge-green">✓</span>}
                  <span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Expanded stat entry */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--green-700)', padding: '16px', background: 'rgba(0,0,0,0.15)' }}>
                    {/* Batting */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={s.did_bat} onChange={setStatBool(player.id, 'did_bat')} />
                        <span style={{ fontWeight: 600, color: 'var(--gold-400)' }}>🏏 Batting</span>
                      </label>
                      {s.did_bat && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          <NumInput pid={player.id} field="runs" label="Runs" />
                          <NumInput pid={player.id} field="balls_faced" label="Balls" />
                          <NumInput pid={player.id} field="fours" label="4s" />
                          <NumInput pid={player.id} field="sixes" label="6s" />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'flex-end', paddingBottom: 4 }}>
                            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={s.is_out} onChange={setStatBool(player.id, 'is_out')} />
                              Got out
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bowling */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={s.did_bowl} onChange={setStatBool(player.id, 'did_bowl')} />
                        <span style={{ fontWeight: 600, color: 'var(--green-300)' }}>🎯 Bowling</span>
                      </label>
                      {s.did_bowl && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          <NumInput pid={player.id} field="overs_bowled" label="Overs" step={0.1} />
                          <NumInput pid={player.id} field="wickets" label="Wickets" />
                          <NumInput pid={player.id} field="runs_conceded" label="Runs Given" />
                          <NumInput pid={player.id} field="maidens" label="Maidens" />
                          <NumInput pid={player.id} field="dot_balls" label="Dots" />
                          <NumInput pid={player.id} field="wides" label="Wides" />
                          <NumInput pid={player.id} field="no_balls" label="No Balls" />
                        </div>
                      )}
                    </div>

                    {/* Fielding */}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--blue-400)', marginBottom: 12 }}>🧤 Fielding</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        <NumInput pid={player.id} field="catches" label="Catches" />
                        <NumInput pid={player.id} field="stumpings" label="Stumpings" />
                        <NumInput pid={player.id} field="run_outs" label="Run Outs" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filteredPlayers.length === 0 && <div className="empty-state mt-3"><div className="empty-state-icon">🔍</div><div className="empty-state-title">No players found</div></div>}

        {/* Bottom save bar */}
        <div style={{ position: 'sticky', bottom: 16, marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-lg" onClick={saveAll} disabled={saving} style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            {saving ? '⏳ Calculating Points...' : `💾 Save All & Calculate Points`}
          </button>
        </div>
      </div>
    </Layout>
  )
}
