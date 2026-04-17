import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function MVP() {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadMVP()
  }, [user])

  async function loadMVP() {
    setLoading(true)
    try {
      // Get total matches in league for consistency factor
      const { data: totalMatches } = await supabase.from('matches')
        .select('id', { count: 'exact' })
        .eq('is_completed', true)

      const totalGames = totalMatches?.length || 1

      // Get all players with their price
      const { data: allPlayers } = await supabase.from('players')
        .select('id, name, dpl_team_id, auction_price, skill, gender, dpl_team:dpl_team_id(name, color)')
        .eq('is_active', true)

      // Get all player stats with match count
      const { data: stats } = await supabase.from('player_match_stats')
        .select('player_id, total_points, match_id')

      // Aggregate points and games played by player_id
      const playerStats = {}
      stats?.forEach(stat => {
        if (!playerStats[stat.player_id]) {
          playerStats[stat.player_id] = { totalPoints: 0, gamesPlayed: 0 }
        }
        playerStats[stat.player_id].totalPoints += stat.total_points || 0
        playerStats[stat.player_id].gamesPlayed += 1
      })

      // Calculate MVP score for each player
      const mvpList = (allPlayers || []).map(p => {
        const stats = playerStats[p.id] || { totalPoints: 0, gamesPlayed: 0 }
        const efficiency = stats.totalPoints / p.auction_price
        const consistency = stats.gamesPlayed / totalGames
        
        return {
          ...p,
          totalPoints: stats.totalPoints,
          gamesPlayed: stats.gamesPlayed,
          efficiency: efficiency,
          consistency: consistency,
          mvpScore: efficiency * consistency * 1000 // Scale for readability
        }
      })
      
      // Sort by MVP score (descending)
      mvpList.sort((a, b) => b.mvpScore - a.mvpScore)

      setPlayers(mvpList)
    } catch (err) {
      console.error('Error loading MVP data:', err)
    }
    setLoading(false)
  }

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner" /></div></Layout>

  const top10 = players.slice(0, 10)
  const colors = ['var(--gold-400)', '#FFD700', '#FF6B6B', 'var(--green-300)', 'var(--gray-400)']

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">🏆 MVP of Fantasy League</h1>
          <p className="page-subtitle">
            Best performers by efficiency & consistency — (Points ÷ Price) × (Games Played ÷ Total Games)
          </p>
        </div>

        {/* Top 3 Podium */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {top10.slice(0, 3).map((p, idx) => {
            const medals = ['🥇', '🥈', '🥉']
            return (
              <div key={p.id} style={{
                background: `linear-gradient(135deg, ${p.dpl_team?.color || 'var(--green-800)'} 0%, var(--green-900) 100%)`,
                border: `2px solid ${colors[idx]}`,
                borderRadius: 12,
                padding: 16,
                textAlign: 'center',
                boxShadow: `0 4px 12px rgba(0,0,0,0.3)`
              }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{medals[idx]}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--cream)', marginBottom: 4 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-300)', marginBottom: 8 }}>
                  {p.dpl_team?.name || 'N/A'} • {p.skill}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: colors[idx], marginBottom: 6 }}>
                  {p.mvpScore.toFixed(1)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                  {Math.round(p.totalPoints)} pts ÷ ₹{p.auction_price} × {p.consistency.toFixed(2)} consistency
                </div>
              </div>
            )
          })}
        </div>

        {/* Full Rankings Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📊 Full MVP Rankings</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
              {players.length} players
            </span>
          </div>

          {players.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">📈</div>
              <div className="empty-state-title">No match data yet</div>
              <div className="empty-state-desc">MVP scores will appear once matches are completed</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--green-700)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: 'var(--gold-400)', fontWeight: 700 }}>Rank</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: 'var(--gold-400)', fontWeight: 700 }}>Player</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: 'var(--gold-400)', fontWeight: 700 }}>Team</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: 'var(--gold-400)', fontWeight: 700 }}>Skill</th>
                    <th style={{ padding: '12px', textAlign: 'right', color: 'var(--gold-400)', fontWeight: 700 }}>Points</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: 'var(--gold-400)', fontWeight: 700 }}>Games</th>
                    <th style={{ padding: '12px', textAlign: 'right', color: 'var(--gold-400)', fontWeight: 700 }}>MVP Score</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, idx) => (
                    <tr key={p.id} style={{
                      borderBottom: '1px solid var(--green-800)',
                      background: idx < 3 ? `rgba(212,175,55,${0.1 - idx * 0.02})` : 'transparent',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34,135,92,0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx < 3 ? `rgba(212,175,55,${0.1 - idx * 0.02})` : 'transparent'}
                    >
                      <td style={{ padding: '12px', fontWeight: 700, color: idx < 3 ? 'var(--gold-400)' : 'var(--gray-400)' }}>
                        {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--cream)', fontWeight: 600 }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
                        {p.dpl_team?.name || '—'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
                        {p.skill}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: p.totalPoints > 0 ? 'var(--gold-400)' : 'var(--gray-500)' }}>
                        {Math.round(p.totalPoints)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
                        {p.gamesPlayed}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--green-300)', fontSize: '1rem' }}>
                        {p.mvpScore.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="card mt-3">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ fontSize: '1.5rem' }}>ℹ️</div>
            <div>
              <h4 style={{ color: 'var(--gold-400)', fontWeight: 700, marginBottom: 8 }}>How MVP Score is Calculated</h4>
              <p style={{ color: 'var(--gray-300)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                <strong>MVP Score = (Points ÷ Price) × (Games Played ÷ Total League Games) × 1000</strong>
              </p>
              <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginTop: 8 }}>
                This advanced formula balances <strong>efficiency</strong> (points per rupee) with <strong>consistency</strong> (games played). Players who deliver high points relative to their cost while playing regularly rank highest — rewarding true value and reliability over one-hit wonders.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
