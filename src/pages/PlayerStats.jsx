import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'

// ── Defined OUTSIDE component so React doesn't recreate it every render ──
function PointChip({ label, value, color }) {
  const pts = Math.round(value || 0)
  if (pts === 0) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 700,
      background: `${color}18`, border: `1px solid ${color}35`, color
    }}>
      {label} {pts > 0 ? '+' : ''}{pts}
    </span>
  )
}

function MatchCard({ m }) {
  const fmt = n => Math.round(n || 0)
  const sr   = m.did_bat && m.balls_faced > 0 ? ((m.runs / m.balls_faced) * 100).toFixed(1) : null
  const econ = m.did_bowl && m.overs_bowled > 0 ? (m.runs_conceded / m.overs_bowled).toFixed(2) : null

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden',
      border: '1px solid var(--green-700)', background: 'var(--green-800)'
    }}>
      {/* Match header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 14px', background: 'var(--green-900)',
        borderBottom: '1px solid var(--green-700)'
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
            Match {m.match?.match_number}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginLeft: 8 }}>
            {m.match?.team1?.name} vs {m.match?.team2?.name}
          </span>
          {m.match?.match_date && (
            <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginLeft: 8 }}>
              · {m.match.match_date}
            </span>
          )}
        </div>
        {/* Total points for this match — prominent */}
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '1.4rem',
          fontWeight: 900, color: 'var(--gold-400)', minWidth: 60, textAlign: 'right'
        }}>
          {fmt(m.total_points)}
          <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--gray-400)', marginLeft: 3 }}>pts</span>
        </div>
      </div>

      {/* Detail body */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Raw stats line */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.82rem', color: 'var(--gray-400)' }}>
          {m.is_playing_bonus && <span style={{ color: 'var(--green-400)' }}>🟢 Playing</span>}
          {m.did_bat && (
            <span>
              🏏 <strong style={{ color: 'var(--cream)' }}>{m.runs}</strong>
              ({m.balls_faced} balls)
              {m.fours > 0 && ` · ${m.fours}×4`}
              {m.sixes > 0 && ` · ${m.sixes}×6`}
              <span style={{ marginLeft: 6, color: m.is_out ? 'var(--red-400)' : 'var(--green-300)' }}>
                {m.is_out ? 'Out' : 'Not Out'}
              </span>
              {sr && <span style={{ marginLeft: 6 }}>SR: {sr}</span>}
            </span>
          )}
          {m.did_bowl && (
            <span>
              🎯 <strong style={{ color: 'var(--cream)' }}>{m.wickets}wkt</strong>
              / {m.overs_bowled}ov
              / {m.runs_conceded}runs
              {econ && <span style={{ marginLeft: 6 }}>Econ: {econ}</span>}
              {m.maidens > 0 && <span style={{ marginLeft: 6, color: 'var(--green-300)' }}>{m.maidens} maiden</span>}
              {m.dot_balls > 0 && <span style={{ marginLeft: 6 }}>{m.dot_balls} dots</span>}
            </span>
          )}
          {(m.catches > 0 || m.stumpings > 0 || m.run_outs > 0) && (
            <span>
              🧤
              {m.catches > 0 && ` ${m.catches}c`}
              {m.stumpings > 0 && ` ${m.stumpings}st`}
              {m.run_outs > 0 && ` ${m.run_outs}ro`}
            </span>
          )}
          {m.is_motm && <span style={{ color: 'var(--gold-400)', fontWeight: 700 }}>⭐ MOTM</span>}
        </div>

        {/* Points breakdown chips — one per category */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <PointChip label="Playing"  value={m.playing_bonus}   color="#4ade80" />
          <PointChip label="Batting"  value={m.batting_points}  color="#fbbf24" />
          <PointChip label="Bowling"  value={m.bowling_points}  color="#86efac" />
          <PointChip label="Fielding" value={m.fielding_points} color="#60a5fa" />
          <PointChip label="MOTM"     value={m.motm_points}     color="#D4AF37" />
        </div>

        {/* Bonus / penalty notes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.7rem', color: 'var(--gray-400)' }}>
          {m.did_bat && m.runs === 0 && m.is_out && <span style={{ color: '#f87171' }}>• Duck penalty (-4 pts)</span>}
          {m.runs >= 50  && <span style={{ color: '#fbbf24' }}>• 50+ milestone bonus</span>}
          {m.runs >= 30  && m.runs < 50 && <span style={{ color: '#d1d5db' }}>• 30+ milestone bonus</span>}
          {m.runs >= 15  && m.runs < 30 && <span style={{ color: '#d1d5db' }}>• 15+ milestone bonus</span>}
          {m.wickets >= 5 && <span style={{ color: '#fbbf24' }}>• 5-wicket haul bonus</span>}
          {m.wickets === 4 && <span style={{ color: '#86efac' }}>• 4-wicket bonus</span>}
          {m.wickets === 3 && <span style={{ color: '#86efac' }}>• 3-wicket bonus</span>}
        </div>
      </div>
    </div>
  )
}
// ── End of helper components ──

export default function PlayerStats() {
  const [players, setPlayers]             = useState([])
  const [stats, setStats]                 = useState({})       // aggregated per player
  const [matchData, setMatchData]         = useState({})       // per-player per-match rows
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filterGender, setFilterGender]   = useState('All')
  const [filterSkill, setFilterSkill]     = useState('All')
  const [sortBy, setSortBy]               = useState('total_points')
  const [expandedId, setExpandedId]       = useState(null)     // inline expanded player

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    // Load players
    const { data: ps } = await supabase
      .from('players')
      .select('*, dpl_team:dpl_team_id(name)')
      .order('name')

    // Load ALL match stats in one query — includes every point column
    const { data: allStats, error } = await supabase
      .from('player_match_stats')
      .select(`
        id, player_id,
        runs, balls_faced, fours, sixes, is_out, did_bat,
        overs_bowled, wickets, runs_conceded, maidens, wides, no_balls, dot_balls, did_bowl,
        catches, stumpings, run_outs,
        is_motm, is_playing_bonus,
        batting_points, bowling_points, fielding_points, motm_points, playing_bonus, total_points,
        match:match_id(match_number, match_date, team1:team1_id(name), team2:team2_id(name))
      `)
      .order('match_id', { ascending: false })

    if (error) console.error('Stats fetch error:', error)

    // Build aggregated totals per player
    const agg  = {}
    const mMap = {}   // player_id -> [match rows]

    allStats?.forEach(row => {
      const pid = row.player_id

      // Aggregates
      if (!agg[pid]) agg[pid] = {
        runs: 0, wickets: 0, catches: 0, stumpings: 0, run_outs: 0,
        fours: 0, sixes: 0, matches: 0,
        total_points: 0, batting_points: 0, bowling_points: 0,
        fielding_points: 0, motm_points: 0, playing_bonus: 0
      }
      const a = agg[pid]
      a.runs            += row.runs            || 0
      a.wickets         += row.wickets         || 0
      a.catches         += row.catches         || 0
      a.stumpings       += row.stumpings       || 0
      a.run_outs        += row.run_outs        || 0
      a.fours           += row.fours           || 0
      a.sixes           += row.sixes           || 0
      a.total_points    += row.total_points    || 0
      a.batting_points  += row.batting_points  || 0
      a.bowling_points  += row.bowling_points  || 0
      a.fielding_points += row.fielding_points || 0
      a.motm_points     += row.motm_points     || 0
      a.playing_bonus   += row.playing_bonus   || 0
      a.matches++

      // Per-match rows
      if (!mMap[pid]) mMap[pid] = []
      mMap[pid].push(row)
    })

    setStats(agg)
    setMatchData(mMap)
    setPlayers(ps || [])
    setLoading(false)
  }

  const fmt = n => Math.round(n || 0)

  const filtered = players
    .filter(p => {
      if (filterGender !== 'All' && p.gender !== filterGender) return false
      if (filterSkill  !== 'All' && p.skill  !== filterSkill)  return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const sa = stats[a.id] || {}, sb = stats[b.id] || {}
      if (sortBy === 'runs')         return (sb.runs         || 0) - (sa.runs         || 0)
      if (sortBy === 'wickets')      return (sb.wickets      || 0) - (sa.wickets      || 0)
      if (sortBy === 'total_points') return (sb.total_points || 0) - (sa.total_points || 0)
      return a.name.localeCompare(b.name)
    })

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  if (loading) return (
    <Layout><div className="loading-center"><div className="loading-spinner" /></div></Layout>
  )

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Player Statistics 📊</h1>
          <p className="page-subtitle">
            Click any row to expand per-match fantasy points breakdown
          </p>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <input className="form-input search-input" placeholder="Search player..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
            <option value="All">All Genders</option>
            <option>Male</option><option>Female</option>
          </select>
          <select className="form-select" value={filterSkill} onChange={e => setFilterSkill(e.target.value)}>
            <option value="All">All Skills</option>
            {['Batter','Bowler','Batting All Rounder','Bowling All Rounder','Wicket Keeper'].map(s =>
              <option key={s}>{s}</option>
            )}
          </select>
          <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="total_points">Sort: Total Points</option>
            <option value="runs">Sort: Runs</option>
            <option value="wickets">Sort: Wickets</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>

        {/* Player list — inline expandable */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(player => {
            const s        = stats[player.id] || {}
            const matches  = matchData[player.id] || []
            const isOpen   = expandedId === player.id
            const hasStats = s.matches > 0

            return (
              <div key={player.id} style={{
                borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${isOpen ? 'var(--gold-400)' : 'var(--green-700)'}`,
                background: 'var(--green-900)', transition: 'border-color 0.15s'
              }}>
                {/* ── Collapsed summary row ── */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                  onClick={() => toggleExpand(player.id)}
                >
                  {/* Gender dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: player.gender === 'Female' ? '#fb7185' : '#60a5fa'
                  }} />

                  {/* Name + skill */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{player.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                      {player.skill} · {player.dpl_team?.name || '—'} · {player.flat_number}
                    </div>
                  </div>

                  {/* Aggregated stat chips */}
                  {hasStats ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--gray-400)' }}>
                        {s.matches}M
                      </span>
                      {s.runs > 0 && (
                        <span>🏏 <strong style={{ color: 'var(--cream)' }}>{s.runs}</strong> runs</span>
                      )}
                      {s.wickets > 0 && (
                        <span>🎯 <strong style={{ color: 'var(--cream)' }}>{s.wickets}</strong> wkts</span>
                      )}
                      {s.catches > 0 && (
                        <span>🧤 <strong style={{ color: 'var(--cream)' }}>{s.catches}</strong>c</span>
                      )}
                      {/* Point breakdown summary */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {s.batting_points > 0  && <PointChip label="Bat"   value={s.batting_points}  color="#fbbf24" />}
                        {s.bowling_points > 0  && <PointChip label="Bowl"  value={s.bowling_points}  color="#86efac" />}
                        {s.fielding_points > 0 && <PointChip label="Field" value={s.fielding_points} color="#60a5fa" />}
                        {s.motm_points > 0     && <PointChip label="MOTM"  value={s.motm_points}     color="#D4AF37" />}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>No stats yet</span>
                  )}

                  {/* Total points — right-most, always visible */}
                  <div style={{ textAlign: 'right', minWidth: 54 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '1.3rem',
                      fontWeight: 900, color: 'var(--gold-400)'
                    }}>
                      {fmt(s.total_points)}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--gray-400)', textTransform: 'uppercase' }}>pts</div>
                  </div>

                  <span style={{ color: 'var(--gray-400)', fontSize: '0.8rem', flexShrink: 0 }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </div>

                {/* ── Expanded: per-match breakdown ── */}
                {isOpen && (
                  <div style={{
                    borderTop: '1px solid var(--green-700)',
                    padding: '14px 16px',
                    background: 'rgba(0,0,0,0.15)',
                    display: 'flex', flexDirection: 'column', gap: 10
                  }}>
                    {/* Header with career totals */}
                    <div style={{
                      display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 14px',
                      background: 'var(--green-900)', borderRadius: 8,
                      fontSize: '0.82rem', marginBottom: 4
                    }}>
                      <span style={{ fontWeight: 700, color: 'var(--cream)' }}>Career totals:</span>
                      {[
                        ['Total', fmt(s.total_points) + ' pts', 'var(--gold-400)'],
                        ['Batting', fmt(s.batting_points) + ' pts', '#fbbf24'],
                        ['Bowling', fmt(s.bowling_points) + ' pts', '#86efac'],
                        ['Fielding', fmt(s.fielding_points) + ' pts', '#60a5fa'],
                        s.motm_points > 0 ? ['MOTM', fmt(s.motm_points) + ' pts', '#D4AF37'] : null,
                        s.playing_bonus > 0 ? ['Playing bonus', fmt(s.playing_bonus) + ' pts', '#4ade80'] : null,
                      ].filter(Boolean).map(([l, v, c]) => (
                        <span key={l} style={{ color: 'var(--gray-400)' }}>
                          {l}: <strong style={{ color: c }}>{v}</strong>
                        </span>
                      ))}
                    </div>

                    {/* Per-match cards */}
                    <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Points per Match ({matches.length})
                    </div>

                    {matches.length === 0 ? (
                      <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem', padding: '12px 0' }}>
                        No match stats recorded yet
                      </div>
                    ) : (
                      matches.map(m => <MatchCard key={m.id} m={m} />)
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No players found</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
