import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function Leaderboard() {
  const { user } = useAuth()
  const [phases, setPhases]           = useState([])
  const [selectedPhase, setSelectedPhase] = useState(null)
  const [phaseRankings, setPhaseRankings] = useState({})   // phaseId -> [teams]
  const [cumulativeRank, setCumulativeRank] = useState([]) // CHANGE 5
  const [matchBreakdown, setMatchBreakdown] = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState('cumulative') // CHANGE 5
  const [myTeamIds, setMyTeamIds]     = useState({}) // phaseId -> teamId

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)

    const { data: ph } = await supabase.from('phases').select('*').order('phase_number')
    setPhases(ph || [])

    // Load ALL fantasy teams for ALL phases at once
    const { data: allTeams } = await supabase.from('fantasy_teams')
      .select('id, team_name, total_points, user_id, phase_id, profile:user_id(username, full_name, flat_number)')

    // CHANGE 5: Build cumulative scores per user
    const userMap = {}
    allTeams?.forEach(t => {
      const uid = t.user_id
      if (!userMap[uid]) userMap[uid] = { user_id: uid, profile: t.profile, total_points: 0, teams: [] }
      userMap[uid].total_points += (t.total_points || 0)
      userMap[uid].teams.push(t)
    })
    const cumulative = Object.values(userMap).sort((a, b) => b.total_points - a.total_points)
    setCumulativeRank(cumulative)

    // Build phase-wise rankings
    const pMap = {}
    ph?.forEach(p => {
      pMap[p.id] = (allTeams || [])
        .filter(t => t.phase_id === p.id)
        .sort((a, b) => b.total_points - a.total_points)
    })
    setPhaseRankings(pMap)

    // Track my team IDs per phase
    const myIds = {}
    allTeams?.filter(t => t.user_id === user?.id).forEach(t => { myIds[t.phase_id] = t.id })
    setMyTeamIds(myIds)

    // Match breakdown for my team in active phase
    const activePhase = ph?.find(p => p.is_active)
    if (activePhase && myIds[activePhase.id]) {
      const { data: matches } = await supabase.from('matches')
        .select('id, match_number').eq('phase_id', activePhase.id)
        .eq('is_completed', true).eq('stats_entered', true).order('match_number')
      const { data: pts } = await supabase.from('fantasy_match_points')
        .select('match_id, total_points').eq('fantasy_team_id', myIds[activePhase.id])
      const ptMap = {}
      pts?.forEach(p => { ptMap[p.match_id] = p.total_points })
      setMatchBreakdown((matches || []).map(m => ({ name: `M${m.match_number}`, points: Math.round(ptMap[m.id] || 0) })))
      setSelectedPhase(activePhase.id)
    } else if (ph?.[0]) {
      setSelectedPhase(ph[0].id)
    }
    setLoading(false)
  }

  const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`

  const RankRow = ({ rank, teamName, userName, flatNo, points, isMe, phasePoints }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px',
      borderBottom: '1px solid var(--green-800)',
      background: isMe ? 'rgba(212,175,55,0.05)' : undefined,
      borderLeft: isMe ? '3px solid var(--gold-400)' : '3px solid transparent'
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 900, width: 36, textAlign: 'center',
        color: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'var(--gray-400)'
      }}>{medal(rank)}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>
          {teamName || 'Unnamed Team'}
          {isMe && <span className="badge badge-gold" style={{ marginLeft: 8 }}>You</span>}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>
          {userName}{flatNo ? ` · ${flatNo}` : ''}
        </div>
        {phasePoints && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {phasePoints.map(([label, pts]) => pts > 0 && (
              <span key={label} style={{ fontSize: '0.68rem', background: 'var(--green-800)', border: '1px solid var(--green-700)', borderRadius: 4, padding: '1px 6px', color: 'var(--gray-400)' }}>
                {label}: <strong style={{ color: 'var(--cream)' }}>{Math.round(pts)}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--gold-400)' }}>
        {Math.round(points)}
      </div>
    </div>
  )

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Leaderboard 🏆</h1>
          <p className="page-subtitle">Fantasy cricket rankings — cumulative and per phase</p>
        </div>

        {/* CHANGE 5: Main tab — cumulative vs phase */}
        <div className="tabs">
          <button className={`tab-btn${activeTab === 'cumulative' ? ' active' : ''}`} onClick={() => setActiveTab('cumulative')}>
            🌟 Cumulative Rankings
          </button>
          <button className={`tab-btn${activeTab === 'phase' ? ' active' : ''}`} onClick={() => setActiveTab('phase')}>
            📅 Phase Rankings
          </button>
          <button className={`tab-btn${activeTab === 'chart' ? ' active' : ''}`} onClick={() => setActiveTab('chart')}>
            📈 My Points Chart
          </button>
        </div>

        {loading ? <div className="loading-center" style={{ minHeight: 300 }}><div className="loading-spinner" /></div> : (
          <>
            {/* ── CUMULATIVE TAB ── */}
            {activeTab === 'cumulative' && (
              <div>
                <div style={{ fontSize: '0.82rem', color: 'var(--gray-400)', marginBottom: 16, padding: '10px 14px', background: 'var(--green-900)', borderRadius: 8, border: '1px solid var(--green-700)' }}>
                  💡 Cumulative points = sum of all points earned across <strong style={{ color: 'var(--cream)' }}>all phases</strong>. Only users who have created at least one team are shown.
                </div>
                <div className="card" style={{ padding: 0 }}>
                  {cumulativeRank.length === 0 ? (
                    <div className="empty-state"><div className="empty-state-icon">🏆</div><div className="empty-state-title">No teams yet</div></div>
                  ) : cumulativeRank.map((entry, idx) => {
                    const isMe = entry.user_id === user?.id
                    // Build per-phase breakdown for this user
                    const phaseBreakdown = phases.map(ph => {
                      const t = entry.teams.find(t => t.phase_id === ph.id)
                      return [ph.name, t?.total_points || 0]
                    })
                    return (
                      <RankRow key={entry.user_id}
                        rank={idx + 1}
                        teamName={entry.teams.map(t => t.team_name).filter(Boolean).join(' · ') || 'No team name'}
                        userName={entry.profile?.full_name || entry.profile?.username}
                        flatNo={entry.profile?.flat_number}
                        points={entry.total_points}
                        isMe={isMe}
                        phasePoints={phaseBreakdown}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── PHASE TAB ── */}
            {activeTab === 'phase' && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                  {phases.map(p => (
                    <button key={p.id}
                      className={`btn ${selectedPhase === p.id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSelectedPhase(p.id)}>
                      {p.name}{p.is_active ? ' 🔴' : ''}
                    </button>
                  ))}
                </div>

                {selectedPhase && (
                  <div className="card" style={{ padding: 0 }}>
                    {!(phaseRankings[selectedPhase]?.length) ? (
                      <div className="empty-state"><div className="empty-state-icon">🏆</div><div className="empty-state-title">No teams for this phase</div></div>
                    ) : phaseRankings[selectedPhase].map((team, idx) => {
                      const isMe = team.user_id === user?.id
                      return (
                        <RankRow key={team.id}
                          rank={idx + 1}
                          teamName={team.team_name}
                          userName={team.profile?.full_name || team.profile?.username}
                          flatNo={team.profile?.flat_number}
                          points={team.total_points}
                          isMe={isMe}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── CHART TAB ── */}
            {activeTab === 'chart' && (
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 20 }}>My Points Per Match (Active Phase)</h3>
                {matchBreakdown.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-icon">📈</div><div className="empty-state-title">No match data yet</div></div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={matchBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="var(--gray-400)" tick={{ fill: 'var(--gray-400)', fontSize: 12 }} />
                      <YAxis stroke="var(--gray-400)" tick={{ fill: 'var(--gray-400)', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: 'var(--green-800)', border: '1px solid var(--green-600)', borderRadius: 8, color: 'var(--cream)' }} />
                      <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                        {matchBreakdown.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? 'var(--gold-400)' : 'var(--green-400)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
