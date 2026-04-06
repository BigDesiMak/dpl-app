import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'

export default function PlayerStats() {
  const [players, setPlayers] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGender, setFilterGender] = useState('All')
  const [filterSkill, setFilterSkill] = useState('All')
  const [sortBy, setSortBy] = useState('total_points')
  const [selected, setSelected] = useState(null)
  const [playerMatches, setPlayerMatches] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: ps } = await supabase.from('players').select('*, dpl_team:dpl_team_id(name, color)').order('name')
    const { data: pms } = await supabase.from('player_match_stats')
      .select('player_id, runs, wickets, catches, stumpings, run_outs, fours, sixes, total_points, batting_points, bowling_points, fielding_points')

    // Aggregate stats
    const agg = {}
    pms?.forEach(s => {
      if (!agg[s.player_id]) agg[s.player_id] = { runs: 0, wickets: 0, catches: 0, stumpings: 0, run_outs: 0, fours: 0, sixes: 0, total_points: 0, matches: 0, batting_points: 0, bowling_points: 0, fielding_points: 0 }
      const a = agg[s.player_id]
      a.runs += s.runs || 0; a.wickets += s.wickets || 0; a.catches += s.catches || 0
      a.stumpings += s.stumpings || 0; a.run_outs += s.run_outs || 0
      a.fours += s.fours || 0; a.sixes += s.sixes || 0
      a.total_points += s.total_points || 0; a.matches++
      a.batting_points += s.batting_points || 0; a.bowling_points += s.bowling_points || 0
      a.fielding_points += s.fielding_points || 0
    })
    setStats(agg)
    setPlayers(ps || [])
    setLoading(false)
  }

  async function openPlayer(player) {
    setSelected(player)
    const { data } = await supabase.from('player_match_stats')
      .select('*, match:match_id(match_number, match_date, team1:team1_id(name), team2:team2_id(name))')
      .eq('player_id', player.id).order('created_at', { ascending: false })
    setPlayerMatches(data || [])
  }

  const filtered = players.filter(p => {
    if (filterGender !== 'All' && p.gender !== filterGender) return false
    if (filterSkill !== 'All' && p.skill !== filterSkill) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    const sa = stats[a.id] || {}, sb = stats[b.id] || {}
    if (sortBy === 'runs') return (sb.runs || 0) - (sa.runs || 0)
    if (sortBy === 'wickets') return (sb.wickets || 0) - (sa.wickets || 0)
    if (sortBy === 'total_points') return (sb.total_points || 0) - (sa.total_points || 0)
    return 0
  })

  const fmt = n => Math.round(n || 0)

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header"><h1 className="page-title">Player Statistics 📊</h1></div>

        <div className="filter-bar">
          <input className="form-input search-input" placeholder="Search player..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
            <option>All</option><option>Male</option><option>Female</option>
          </select>
          <select className="form-select" value={filterSkill} onChange={e => setFilterSkill(e.target.value)}>
            <option value="All">All Skills</option>
            {['Batter','Bowler','Batting All Rounder','Bowling All Rounder','Wicket Keeper'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="total_points">Sort: Points</option>
            <option value="runs">Sort: Runs</option>
            <option value="wickets">Sort: Wickets</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Player</th><th>Team</th><th>Skill</th><th>M</th>
              <th>Runs</th><th>4s</th><th>6s</th><th>Wkts</th><th>Catches</th><th>Points</th>
            </tr></thead>
            <tbody>
              {filtered.map(p => {
                const s = stats[p.id] || {}
                return (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openPlayer(p)}>
                    <td><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{p.flat_number}</div></td>
                    <td className="td-muted">{p.dpl_team?.name || '—'}</td>
                    <td><span className="badge badge-gray">{p.skill}</span></td>
                    <td className="td-muted">{s.matches || 0}</td>
                    <td style={{ fontWeight: 600 }}>{s.runs || 0}</td>
                    <td className="td-muted">{s.fours || 0}</td>
                    <td className="td-muted">{s.sixes || 0}</td>
                    <td style={{ fontWeight: 600 }}>{s.wickets || 0}</td>
                    <td className="td-muted">{s.catches || 0}</td>
                    <td><span style={{ fontWeight: 700, color: 'var(--gold-400)' }}>{fmt(s.total_points)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="empty-state mt-3"><div className="empty-state-icon">🔍</div><div className="empty-state-title">No players found</div></div>}

        {/* Player Detail Modal */}
        {selected && (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div className="modal-title">{selected.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>{selected.skill} · {selected.gender} · {selected.flat_number}</div>
                </div>
                <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
              </div>
              {/* Aggregate */}
              {stats[selected.id] && (
                <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
                  {[['Runs', stats[selected.id].runs], ['Wickets', stats[selected.id].wickets], ['Points', fmt(stats[selected.id].total_points)],
                    ['Fours', stats[selected.id].fours], ['Sixes', stats[selected.id].sixes], ['Catches', stats[selected.id].catches]].map(([l, v]) => (
                    <div key={l} className="stat-card" style={{ padding: '12px' }}><div className="stat-value" style={{ fontSize: '1.4rem' }}>{v || 0}</div><div className="stat-label">{l}</div></div>
                  ))}
                </div>
              )}
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.875rem' }}>Match History</div>
              {playerMatches.length === 0 ? (
                <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem', textAlign: 'center', padding: 20 }}>No match stats recorded yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {playerMatches.map(m => (
                    <div key={m.id} style={{ background: 'var(--green-800)', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>M{m.match?.match_number}: {m.match?.team1?.name} vs {m.match?.team2?.name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: 'var(--gray-400)' }}>
                        {m.did_bat && <span>🏏 {m.runs}({m.balls_faced}) {m.fours}×4 {m.sixes}×6</span>}
                        {m.did_bowl && <span>🎯 {m.wickets}wkt/{m.overs_bowled}ov</span>}
                        {(m.catches > 0 || m.stumpings > 0 || m.run_outs > 0) && <span>🧤 {m.catches}c {m.stumpings}st {m.run_outs}ro</span>}
                        <span style={{ color: 'var(--gold-400)', fontWeight: 700 }}>{fmt(m.total_points)}pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
