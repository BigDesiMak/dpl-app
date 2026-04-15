import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function UserDashboard() {
  const { user, profile } = useAuth()
  const [activePhase, setActivePhase]   = useState(null)
  const [allPhases, setAllPhases]       = useState([])
  const [activeTeam, setActiveTeam]     = useState(null)
  const [allTeams, setAllTeams]         = useState([])   // CHANGE 3: all phase teams
  const [phasePointsMap, setPhasePointsMap] = useState({}) // phaseId -> points array
  const [playerPointsMap, setPlayerPointsMap] = useState({}) // activeTeamId -> [{player_id, name, total_points}, ...]
  const [recentMatches, setRecentMatches]   = useState([])
  const [rank, setRank]                 = useState(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => { if (user) loadDashboard() }, [user])

  async function loadDashboard() {
    setLoading(true)

    const [{ data: phases }, { data: matches }] = await Promise.all([
      supabase.from('phases').select('*').order('phase_number'),
      supabase.from('matches')
        .select('*, team1:team1_id(name,short_name,color), team2:team2_id(name,short_name,color), winner:winner_id(name)')
        .eq('is_completed', true).order('match_date', { ascending: false }).limit(5)
    ])

    setAllPhases(phases || [])
    setRecentMatches(matches || [])

    const active = phases?.find(p => p.is_active)
    setActivePhase(active)

    // CHANGE 3: Load ALL user teams across ALL phases
    const { data: userTeams } = await supabase.from('fantasy_teams')
      .select('*, captain:captain_id(name), vc:vice_captain_id(name), phase:phase_id(name,phase_number,is_active,is_locked)')
      .eq('user_id', user.id)
      .order('phase_id')

    setAllTeams(userTeams || [])

    // Active phase team for rank
    const actTeam = userTeams?.find(t => t.phase_id === active?.id)
    setActiveTeam(actTeam)

    if (actTeam) {
      const { data: phaseTeams } = await supabase.from('fantasy_teams')
        .select('id, total_points').eq('phase_id', active.id).order('total_points', { ascending: false })
      const myRank = phaseTeams?.findIndex(t => t.id === actTeam.id) + 1
      setRank(myRank)
    }

    // CHANGE 3: Load match-level points for each team
    if (userTeams?.length) {
      const teamIds = userTeams.map(t => t.id)
      const { data: pts } = await supabase.from('fantasy_match_points')
        .select('fantasy_team_id, total_points, match:match_id(match_number, match_date, team1:team1_id(name), team2:team2_id(name))')
        .in('fantasy_team_id', teamIds)
        .order('created_at', { ascending: false })

      // Group by fantasy_team_id
      const pMap = {}
      pts?.forEach(p => {
        if (!pMap[p.fantasy_team_id]) pMap[p.fantasy_team_id] = []
        pMap[p.fantasy_team_id].push(p)
      })
      setPhasePointsMap(pMap)
    }

    // Load per-player points for active team
    if (actTeam) {
      const { data: teamPlayers } = await supabase.from('fantasy_team_players')
        .select('player_id, player:player_id(id,name)')
        .eq('fantasy_team_id', actTeam.id)
      
      if (teamPlayers?.length) {
        const playerIds = teamPlayers.map(tp => tp.player_id)
        const { data: stats } = await supabase.from('player_match_stats')
          .select('player_id, total_points')
          .in('player_id', playerIds)
        
        // Aggregate points by player
        const playerMap = {}
        stats?.forEach(stat => {
          if (!playerMap[stat.player_id]) {
            playerMap[stat.player_id] = { total_points: 0 }
          }
          playerMap[stat.player_id].total_points += stat.total_points || 0
        })
        
        // Merge with player names and sort by points
        const playersList = teamPlayers.map(tp => ({
          player_id: tp.player_id,
          name: tp.player?.name || 'Unknown',
          total_points: playerMap[tp.player_id]?.total_points || 0
        })).sort((a, b) => b.total_points - a.total_points)
        
        setPlayerPointsMap({ [actTeam.id]: playersList })
      }
    }

    setLoading(false)
  }

  // Cumulative points across all phases
  const cumulativePoints = allTeams.reduce((sum, t) => sum + (t.total_points || 0), 0)

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner" /></div></Layout>

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Welcome, {profile?.full_name?.split(' ')[0] || profile?.username}! 👋</h1>
          <p className="page-subtitle">
            {activePhase
              ? <span className="phase-indicator"><span className="phase-dot" />{activePhase.name} — Active{activePhase.is_locked ? ' 🔒' : ''}</span>
              : 'No active phase currently'}
          </p>
        </div>

        {/* Top stat cards */}
        <div className="stat-grid mb-3">
          <div className="stat-card">
            <div className="stat-value">{Math.round(cumulativePoints)}</div>
            <div className="stat-label">Total Points (All Phases)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{activeTeam ? Math.round(activeTeam.total_points) : '—'}</div>
            <div className="stat-label">Active Phase Points</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{rank ? `#${rank}` : '—'}</div>
            <div className="stat-label">Current Rank</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{allTeams.length}</div>
            <div className="stat-label">Teams Created</div>
          </div>
        </div>

        <div className="grid-2">
          {/* Active team card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                {activePhase?.name || 'Active Phase'} Team
                {activePhase?.is_locked && <span className="badge badge-red" style={{ marginLeft: 8 }}>🔒 Locked</span>}
              </h3>
              <Link to="/team" className="btn btn-primary btn-sm">
                {activeTeam ? (activePhase?.is_locked ? 'View Team' : 'Edit Team') : 'Build Team'}
              </Link>
            </div>
            {activeTeam ? (
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold-400)', marginBottom: 12 }}>
                  {activeTeam.team_name || 'My DPL Team'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gray-400)' }}>Captain</span>
                    <span style={{ color: 'var(--gold-400)', fontWeight: 600 }}>👑 {activeTeam.captain?.name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gray-400)' }}>Vice Captain</span>
                    <span style={{ color: 'var(--green-300)', fontWeight: 600 }}>⭐ {activeTeam.vc?.name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gray-400)' }}>Budget Spent</span>
                    <span>₹{(activeTeam.spent_budget || 0).toLocaleString()} / ₹{(activeTeam.total_budget || 10000).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--green-700)' }}>
                    <span style={{ color: 'var(--gray-400)' }}>Phase Points</span>
                    <span style={{ fontWeight: 700, color: 'var(--gold-400)', fontSize: '1.1rem' }}>{Math.round(activeTeam.total_points)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div className="empty-state-icon">🏏</div>
                <div className="empty-state-title">No team for {activePhase?.name || 'this phase'}</div>
                <div className="empty-state-desc">Build your team to start scoring points</div>
              </div>
            )}
          </div>

          {/* Recent matches */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Matches</h3>
              <Link to="/leaderboard" className="btn btn-ghost btn-sm">Full Board →</Link>
            </div>
            {recentMatches.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentMatches.slice(0, 4).map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--green-800)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {m.winner?.name === m.team1?.name ? '🏆 ' : ''}{m.team1?.name} vs {m.winner?.name === m.team2?.name ? '🏆 ' : ''}{m.team2?.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Match {m.match_number} · {m.match_date}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div className="empty-state-icon">🏟️</div>
                <div className="empty-state-title">No matches yet</div>
              </div>
            )}
          </div>
        </div>

        {/* Player Points Breakdown */}
        {activeTeam && playerPointsMap[activeTeam.id] && playerPointsMap[activeTeam.id].length > 0 && (
          <div className="card mt-3">
            <div className="card-header">
              <h3 className="card-title">🎯 Player Points</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                {activePhase?.name || 'Current Phase'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {playerPointsMap[activeTeam.id].map(player => (
                <div key={player.player_id} style={{
                  background: 'var(--green-800)', border: '1px solid var(--green-700)',
                  borderRadius: 8, padding: 12, textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {player.name}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: player.total_points > 0 ? 'var(--gold-400)' : 'var(--gray-500)' }}>
                    {Math.round(player.total_points)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: 4 }}>points</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHANGE 3: All phase teams */}
        <div className="card mt-3">
          <div className="card-header">
            <h3 className="card-title">📊 My Teams — All Phases</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
              Cumulative: <strong style={{ color: 'var(--gold-400)' }}>{Math.round(cumulativePoints)} pts</strong>
            </span>
          </div>

          {allTeams.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-state-icon">🏏</div>
              <div className="empty-state-title">No teams created yet</div>
              <div className="empty-state-desc">Build your first team for the active phase</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {allPhases.map(phase => {
                const team = allTeams.find(t => t.phase_id === phase.id)
                const matchPts = team ? (phasePointsMap[team.id] || []) : []
                return (
                  <div key={phase.id} style={{
                    background: 'var(--green-800)', borderRadius: 10,
                    border: `1px solid ${phase.is_active ? 'var(--gold-400)' : 'var(--green-700)'}`,
                    overflow: 'hidden'
                  }}>
                    {/* Phase header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px',
                      background: phase.is_active ? 'rgba(212,175,55,0.08)' : 'transparent',
                      borderBottom: '1px solid var(--green-700)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, color: phase.is_active ? 'var(--gold-400)' : 'var(--cream)' }}>
                          {phase.name}
                        </span>
                        {phase.is_active && <span className="phase-indicator" style={{ fontSize: '0.7rem' }}><span className="phase-dot" />Active</span>}
                        {phase.is_locked && <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>🔒</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {team && (
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--gold-400)' }}>
                            {Math.round(team.total_points)} pts
                          </span>
                        )}
                        {phase.is_active && (
                          <Link to="/team" className="btn btn-primary btn-sm">
                            {team ? (phase.is_locked ? 'View' : 'Edit') : 'Build Team'}
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Team details */}
                    <div style={{ padding: '12px 16px' }}>
                      {team ? (
                        <div>
                          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.85rem', marginBottom: matchPts.length ? 12 : 0 }}>
                            <span style={{ color: 'var(--gray-400)' }}>Team: <strong style={{ color: 'var(--cream)' }}>{team.team_name || 'Unnamed'}</strong></span>
                            <span style={{ color: 'var(--gray-400)' }}>C: <strong style={{ color: 'var(--gold-400)' }}>👑 {team.captain?.name || '—'}</strong></span>
                            <span style={{ color: 'var(--gray-400)' }}>VC: <strong style={{ color: 'var(--green-300)' }}>⭐ {team.vc?.name || '—'}</strong></span>
                            <span style={{ color: 'var(--gray-400)' }}>Budget: <strong style={{ color: 'var(--cream)' }}>₹{(team.spent_budget || 0).toLocaleString()}</strong></span>
                          </div>
                          {/* Match points breakdown */}
                          {matchPts.length > 0 && (
                            <div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Points per match</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {matchPts.map(p => (
                                  <div key={p.fantasy_team_id + '-' + p.match?.match_number} style={{
                                    background: 'var(--green-900)', borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem',
                                    border: '1px solid var(--green-700)', textAlign: 'center'
                                  }}>
                                    <div style={{ color: 'var(--gray-400)', fontSize: '0.68rem' }}>M{p.match?.match_number}</div>
                                    <div style={{ fontWeight: 700, color: 'var(--gold-400)' }}>+{Math.round(p.total_points)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>
                          {phase.is_active
                            ? <Link to="/team" style={{ color: 'var(--gold-400)' }}>Build your team for this phase →</Link>
                            : phase.is_locked ? '🔒 Phase locked — no team was created'
                            : 'No team created for this phase'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
