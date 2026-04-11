import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const BLANK = {
  did_bat:false, runs:0, balls_faced:0, fours:0, sixes:0, is_out:false,
  did_bowl:false, overs_bowled:0, wickets:0, runs_conceded:0,
  maidens:0, wides:0, no_balls:0, dot_balls:0,
  catches:0, stumpings:0, run_outs:0,
  is_motm:false
}

function Num({ pid, field, label, step=1, stats, onChange }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:3,minWidth:72}}>
      <label style={{fontSize:'0.68rem',color:'var(--gray-400)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>
      <input type="number" min={0} step={step} className="form-input"
        style={{padding:'6px 8px',fontSize:'0.875rem'}}
        value={(stats[pid]||BLANK)[field]}
        onChange={e=>onChange(pid,field,parseFloat(e.target.value)||0)} />
    </div>
  )
}

export default function AdminMatchStats() {
  const { matchId } = useParams()
  const navigate    = useNavigate()
  const { user }    = useAuth()

  const [match, setMatch]             = useState(null)
  const [players, setPlayers]         = useState([])   // only team1+team2 players
  const [allPlayers, setAllPlayers]   = useState([])   // full list for reference
  const [stats, setStats]             = useState({})
  const [existingIds, setExistingIds] = useState({})
  const [activePlayer, setActivePlayer] = useState(null)
  const [saving, setSaving]           = useState(false)
  const [savingPlayer, setSavingPlayer] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [filterTeam, setFilterTeam]   = useState('All')
  const [filterPlayed, setFilterPlayed] = useState(false)
  const [search, setSearch]           = useState('')
  const [unsaved, setUnsaved]         = useState(new Set())
  const [lastSaved, setLastSaved]     = useState(null)

  const isEditMode = match?.stats_entered === true

  useEffect(() => { loadData() }, [matchId])

  async function loadData() {
    setLoading(true)

    const { data: m } = await supabase.from('matches')
      .select('*, team1:team1_id(id,name,color), team2:team2_id(id,name,color), phase:phase_id(name)')
      .eq('id', matchId).single()
    setMatch(m)

    // CHANGE 1: Only load players belonging to the two playing DPL teams
    const teamIds = [m?.team1_id, m?.team2_id].filter(Boolean)
    const { data: ps } = await supabase.from('players')
      .select('*, dpl_team:dpl_team_id(id,name)')
      .in('dpl_team_id', teamIds)
      .eq('is_active', true)
      .order('dpl_team_id').order('gender').order('name')
    setPlayers(ps || [])

    const { data: existing } = await supabase.from('player_match_stats')
      .select('*').eq('match_id', matchId)

    const idMap={}, statMap={}
    existing?.forEach(row => {
      idMap[row.player_id] = row.id
      statMap[row.player_id] = {
        did_bat:row.did_bat, runs:row.runs, balls_faced:row.balls_faced,
        fours:row.fours, sixes:row.sixes, is_out:row.is_out,
        did_bowl:row.did_bowl, overs_bowled:row.overs_bowled, wickets:row.wickets,
        runs_conceded:row.runs_conceded, maidens:row.maidens, wides:row.wides,
        no_balls:row.no_balls, dot_balls:row.dot_balls,
        catches:row.catches, stumpings:row.stumpings, run_outs:row.run_outs,
        is_motm:row.is_motm||false
      }
    })
    setExistingIds(idMap); setStats(statMap)
    setUnsaved(new Set())
    setLastSaved(existing?.length ? new Date() : null)
    if (ps?.[0]) setActivePlayer(ps[0].id)
    setLoading(false)
  }

  function handleChange(pid, field, value) {
    setStats(s => ({...s, [pid]:{...(s[pid]||{...BLANK}),[field]:value}}))
    setUnsaved(u => new Set(u).add(pid))
  }
  function handleBool(pid, field, checked) {
    // Only one MOTM allowed
    if (field === 'is_motm' && checked) {
      const currentMotm = Object.entries(stats).find(([id,s]) => s.is_motm && parseInt(id) !== pid)
      if (currentMotm) {
        const prevName = players.find(p=>p.id===parseInt(currentMotm[0]))?.name
        toast.error(`${prevName} is already Man of the Match. Remove first.`); return
      }
    }
    setStats(s => ({...s, [pid]:{...(s[pid]||{...BLANK}),[field]:checked}}))
    setUnsaved(u => new Set(u).add(pid))
  }

  async function savePlayer(pid) {
    const s = stats[pid]||BLANK
    setSavingPlayer(pid)
    try {
      const payload = {player_id:parseInt(pid), match_id:parseInt(matchId), entered_by:user.id, ...s}
      if (existingIds[pid]) {
        await supabase.from('player_match_stats').update(payload).eq('id', existingIds[pid])
      } else {
        const {data} = await supabase.from('player_match_stats').insert(payload).select().single()
        if (data) setExistingIds(ids=>({...ids,[pid]:data.id}))
      }
      await supabase.from('matches').update({stats_entered:true,is_completed:true}).eq('id',matchId)
      setMatch(m=>({...m,stats_entered:true,is_completed:true}))
      setUnsaved(u=>{const n=new Set(u);n.delete(parseInt(pid));return n})
      setLastSaved(new Date())
      toast.success(`Saved: ${players.find(p=>p.id===parseInt(pid))?.name}`)
    } catch(err) { toast.error('Save failed: '+err.message) }
    finally { setSavingPlayer(null) }
  }

  async function saveAll() {
    const toSave = players.filter(p=>{
      const s=stats[p.id]
      return s&&(s.did_bat||s.did_bowl||s.catches>0||s.stumpings>0||s.run_outs>0||s.is_motm)
    })
    if (!toSave.length) { toast.error('No stats to save — mark at least one player as batted, bowled, or fielded.'); return }
    setSaving(true)
    try {
      for (const player of toSave) {
        const s = stats[player.id]
        const payload = {player_id:player.id, match_id:parseInt(matchId), entered_by:user.id, ...s}
        if (existingIds[player.id]) {
          await supabase.from('player_match_stats').update(payload).eq('id',existingIds[player.id])
        } else {
          const {data} = await supabase.from('player_match_stats').insert(payload).select().single()
          if (data) setExistingIds(ids=>({...ids,[player.id]:data.id}))
        }
      }
      await supabase.from('matches').update({stats_entered:true,is_completed:true}).eq('id',matchId)
      setMatch(m=>({...m,stats_entered:true,is_completed:true}))
      setUnsaved(new Set()); setLastSaved(new Date())
      toast.success(`✅ Stats saved for ${toSave.length} players! Fantasy points recalculated.`)
    } catch(err) { toast.error('Error: '+err.message) }
    finally { setSaving(false) }
  }

  async function clearPlayer(pid) {
    if (!existingIds[pid]) {
      setStats(s=>{const n={...s};delete n[pid];return n})
      setUnsaved(u=>{const n=new Set(u);n.delete(pid);return n}); return
    }
    if (!window.confirm(`Clear all stats for ${players.find(p=>p.id===pid)?.name}?`)) return
    await supabase.from('player_match_stats').delete().eq('id',existingIds[pid])
    setStats(s=>{const n={...s};delete n[pid];return n})
    setExistingIds(ids=>{const n={...ids};delete n[pid];return n})
    setUnsaved(u=>{const n=new Set(u);n.delete(pid);return n})
    toast.success('Stats cleared')
  }

  const motmPlayer = players.find(p=>stats[p.id]?.is_motm)
  const playersWithStats = players.filter(p=>{
    const s=stats[p.id]
    return s&&(s.did_bat||s.did_bowl||s.catches>0||s.stumpings>0||s.run_outs>0||s.is_motm)
  }).length

  // Teams for filter dropdown — only team1 and team2
  const dplTeams = match ? [match.team1, match.team2].filter(Boolean) : []

  const filteredPlayers = players.filter(p=>{
    if (filterTeam!=='All' && p.dpl_team_id?.toString()!==filterTeam) return false
    if (filterPlayed){const s=stats[p.id];if(!s||(!s.did_bat&&!s.did_bowl&&!s.catches&&!s.stumpings&&!s.run_outs&&!s.is_motm))return false}
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner"/></div></Layout>
  if (!match) return <Layout><div className="page-content"><div className="empty-state"><div className="empty-state-title">Match not found</div></div></div></Layout>

  return (
    <Layout>
      <div className="page-content">

        {/* Header */}
        <div className="page-header">
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:6}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/admin/matches')}>← Back</button>
            <h1 className="page-title" style={{margin:0}}>
              {isEditMode ? '✏️ Edit Match Stats' : '📊 Enter Match Stats'}
            </h1>
            {isEditMode ? <span className="badge badge-green">Stats Saved — Editing</span>
                        : <span className="badge badge-gold">First Entry</span>}
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',fontSize:'0.9rem'}}>
            <span style={{fontWeight:700,color:'var(--gold-400)'}}>
              Match {match.match_number}: {match.team1?.name} vs {match.team2?.name}
            </span>
            {match.phase && <span className="phase-indicator"><span className="phase-dot"/>{match.phase.name}</span>}
            {match.match_date && <span style={{color:'var(--gray-400)'}}>{match.match_date}</span>}
          </div>
        </div>

        {/* Team scope notice */}
        <div style={{
          padding:'10px 16px', marginBottom:16, borderRadius:8, fontSize:'0.85rem',
          background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)', color:'var(--gray-400)'
        }}>
          👥 Showing <strong style={{color:'var(--blue-400)'}}>{players.length} players</strong> from{' '}
          <strong style={{color:'var(--cream)'}}>{match.team1?.name}</strong> and{' '}
          <strong style={{color:'var(--cream)'}}>{match.team2?.name}</strong> only.
          {motmPlayer && (
            <span style={{marginLeft:16,color:'var(--gold-400)',fontWeight:600}}>
              ⭐ MOTM: {motmPlayer.name}
            </span>
          )}
        </div>

        {/* Status bar */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          flexWrap:'wrap', gap:12, padding:'14px 18px', marginBottom:20,
          background: isEditMode ? 'rgba(34,135,92,0.08)' : 'rgba(212,175,55,0.08)',
          border:`1px solid ${isEditMode?'rgba(34,135,92,0.3)':'rgba(212,175,55,0.25)'}`, borderRadius:12
        }}>
          <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap',fontSize:'0.875rem'}}>
            <span style={{color:'var(--gray-400)'}}>
              Stats entered: <strong style={{color:'var(--gold-400)'}}>{playersWithStats} players</strong>
            </span>
            {unsaved.size>0 && <span style={{color:'var(--yellow-400)',fontWeight:600}}>⚠ {unsaved.size} unsaved</span>}
            {lastSaved && unsaved.size===0 && <span style={{color:'var(--green-300)'}}>✓ All saved · {lastSaved.toLocaleTimeString()}</span>}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>navigate('/admin/matches')}>Cancel</button>
            <button className="btn btn-primary" onClick={saveAll} disabled={saving} style={{minWidth:180}}>
              {saving ? '⏳ Saving...' : isEditMode ? '💾 Save All & Recalculate' : '💾 Save All Stats'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <input className="form-input search-input" placeholder="Search player..."
            value={search} onChange={e=>setSearch(e.target.value)} />
          <select className="form-select" value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}>
            <option value="All">Both Teams</option>
            {dplTeams.map(t=><option key={t.id} value={t.id.toString()}>{t.name}</option>)}
          </select>
          <label style={{display:'flex',gap:8,alignItems:'center',fontSize:'0.875rem',cursor:'pointer',whiteSpace:'nowrap'}}>
            <input type="checkbox" checked={filterPlayed} onChange={e=>setFilterPlayed(e.target.checked)}/>
            Stats entered only
          </label>
        </div>

        {/* Players */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filteredPlayers.map(player => {
            const s           = stats[player.id]||BLANK
            const hasStats    = s.did_bat||s.did_bowl||s.catches>0||s.stumpings>0||s.run_outs>0||s.is_motm
            const isOpen      = activePlayer===player.id
            const isDirty     = unsaved.has(player.id)
            const isSavingThis = savingPlayer===player.id
            const isThisTeam1 = player.dpl_team_id===match.team1_id

            return (
              <div key={player.id} style={{
                background: hasStats?'var(--green-800)':'var(--green-900)',
                border:`1px solid ${s.is_motm?'var(--gold-400)':isDirty?'rgba(212,175,55,0.6)':hasStats?'var(--green-500)':'var(--green-700)'}`,
                borderRadius:12, overflow:'hidden',
                boxShadow: s.is_motm?'0 0 12px rgba(212,175,55,0.25)':isDirty?'0 0 0 1px rgba(212,175,55,0.15)':'none',
                transition:'all 0.15s'
              }}>

                {/* Collapsed row */}
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer'}}
                  onClick={()=>setActivePlayer(isOpen?null:player.id)}>

                  {/* Team colour dot */}
                  <div style={{
                    width:10,height:10,borderRadius:'50%',flexShrink:0,
                    background: isThisTeam1 ? (match.team1?.color||'var(--blue-400)') : (match.team2?.color||'var(--red-400)')
                  }} title={player.dpl_team?.name}/>

                  <div style={{flex:1,minWidth:0}}>
                    <span style={{fontWeight:600,marginRight:8}}>{player.name}</span>
                    {s.is_motm && <span style={{fontSize:'0.72rem',background:'var(--gold-400)',color:'var(--green-950)',padding:'1px 7px',borderRadius:4,fontWeight:700,marginRight:6}}>⭐ MOTM</span>}
                    {isDirty && <span style={{fontSize:'0.68rem',background:'rgba(212,175,55,0.2)',color:'var(--gold-400)',padding:'1px 6px',borderRadius:4,fontWeight:700}}>UNSAVED</span>}
                    {existingIds[player.id]&&!isDirty && <span style={{fontSize:'0.68rem',background:'rgba(34,135,92,0.2)',color:'var(--green-300)',padding:'1px 6px',borderRadius:4}}>SAVED</span>}
                    <div style={{fontSize:'0.75rem',color:'var(--gray-400)',marginTop:2}}>
                      {player.skill} · {player.gender} ·
                      <span style={{marginLeft:4,padding:'0 5px',borderRadius:3,
                        background: isThisTeam1?'rgba(96,165,250,0.15)':'rgba(251,113,133,0.15)',
                        color: isThisTeam1?'var(--blue-400)':'#fb7185'}}>
                        {player.dpl_team?.name}
                      </span>
                    </div>
                  </div>

                  {/* Summary chips */}
                  {hasStats && (
                    <div style={{display:'flex',gap:6,fontSize:'0.78rem',flexWrap:'wrap',justifyContent:'flex-end'}}>
                      {s.did_bat && <span style={{background:'rgba(212,175,55,0.1)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:6,padding:'2px 7px',color:'var(--gold-300)'}}>🏏 {s.runs}({s.balls_faced})</span>}
                      {s.did_bowl && <span style={{background:'rgba(34,135,92,0.1)',border:'1px solid rgba(34,135,92,0.2)',borderRadius:6,padding:'2px 7px',color:'var(--green-300)'}}>🎯 {s.wickets}w/{s.overs_bowled}ov</span>}
                      {(s.catches>0||s.stumpings>0||s.run_outs>0) && <span style={{background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:6,padding:'2px 7px',color:'var(--blue-400)'}}>🧤 {s.catches}c</span>}
                    </div>
                  )}

                  {/* Quick actions */}
                  <div style={{display:'flex',gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    {isDirty && (
                      <button className="btn btn-primary btn-sm" style={{fontSize:'0.75rem'}}
                        onClick={()=>savePlayer(player.id)} disabled={isSavingThis}>
                        {isSavingThis?'⏳':'💾 Save'}
                      </button>
                    )}
                    {hasStats && (
                      <button className="btn btn-danger btn-sm" style={{fontSize:'0.72rem',padding:'4px 8px'}}
                        onClick={()=>clearPlayer(player.id)} title="Clear stats">✕</button>
                    )}
                    <span style={{color:'var(--gray-400)',fontSize:'0.8rem',padding:'0 2px'}}>{isOpen?'▲':'▼'}</span>
                  </div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{borderTop:'1px solid var(--green-700)',padding:'16px 18px',background:'rgba(0,0,0,0.12)'}}>

                    {/* MOTM */}
                    <div style={{
                      display:'flex',alignItems:'center',gap:12,marginBottom:20,
                      padding:'10px 14px',borderRadius:8,
                      background: s.is_motm?'rgba(212,175,55,0.1)':'var(--green-900)',
                      border:`1px solid ${s.is_motm?'var(--gold-400)':'var(--green-700)'}`
                    }}>
                      <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontWeight:700,color:s.is_motm?'var(--gold-400)':'var(--cream)'}}>
                        <input type="checkbox" checked={s.is_motm}
                          onChange={e=>handleBool(player.id,'is_motm',e.target.checked)}/>
                        ⭐ Man of the Match (+10 pts)
                      </label>
                      {motmPlayer&&!s.is_motm && (
                        <span style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>
                          Already awarded to {motmPlayer.name}
                        </span>
                      )}
                    </div>

                    {/* Playing bonus notice */}
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,fontSize:'0.82rem',color:'var(--green-300)'}}>
                      <span>🟢</span>
                      <span>+4 playing bonus points applied automatically for every player with stats</span>
                    </div>

                    {/* BATTING */}
                    <div style={{marginBottom:20}}>
                      <label style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,cursor:'pointer',fontWeight:700,color:'var(--gold-400)'}}>
                        <input type="checkbox" checked={s.did_bat} onChange={e=>handleBool(player.id,'did_bat',e.target.checked)}/>
                        🏏 Batting
                      </label>
                      {s.did_bat && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                          <Num pid={player.id} field="runs"        label="Runs"      stats={stats} onChange={handleChange}/>
                          <Num pid={player.id} field="balls_faced" label="Balls"     stats={stats} onChange={handleChange}/>
                          <Num pid={player.id} field="fours"       label="4s"        stats={stats} onChange={handleChange}/>
                          <Num pid={player.id} field="sixes"       label="6s"        stats={stats} onChange={handleChange}/>
                          <div style={{display:'flex',alignItems:'flex-end',paddingBottom:4}}>
                            <label style={{display:'flex',gap:6,alignItems:'center',fontSize:'0.82rem',cursor:'pointer'}}>
                              <input type="checkbox" checked={s.is_out} onChange={e=>handleBool(player.id,'is_out',e.target.checked)}/>
                              Got Out
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BOWLING */}
                    <div style={{marginBottom:20}}>
                      <label style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,cursor:'pointer',fontWeight:700,color:'var(--green-300)'}}>
                        <input type="checkbox" checked={s.did_bowl} onChange={e=>handleBool(player.id,'did_bowl',e.target.checked)}/>
                        🎯 Bowling
                      </label>
                      {s.did_bowl && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                          <Num pid={player.id} field="overs_bowled"  label="Overs"       stats={stats} onChange={handleChange} step={0.1}/>
                          <Num pid={player.id} field="wickets"        label="Wickets"     stats={stats} onChange={handleChange}/>
                          <Num pid={player.id} field="runs_conceded"  label="Runs Given"  stats={stats} onChange={handleChange}/>
                          <Num pid={player.id} field="maidens"        label="Maidens"     stats={stats} onChange={handleChange}/>
                          <Num pid={player.id} field="dot_balls"      label="Dots"        stats={stats} onChange={handleChange}/>
                          <Num pid={player.id} field="wides"          label="Wides"       stats={stats} onChange={handleChange}/>
                          <Num pid={player.id} field="no_balls"       label="No Balls"    stats={stats} onChange={handleChange}/>
                        </div>
                      )}
                    </div>

                    {/* FIELDING */}
                    <div style={{marginBottom:16}}>
                      <div style={{fontWeight:700,color:'var(--blue-400)',marginBottom:14}}>🧤 Fielding</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                        <Num pid={player.id} field="catches"   label="Catches"   stats={stats} onChange={handleChange}/>
                        <Num pid={player.id} field="stumpings" label="Stumpings" stats={stats} onChange={handleChange}/>
                        <Num pid={player.id} field="run_outs"  label="Run Outs"  stats={stats} onChange={handleChange}/>
                      </div>
                    </div>

                    {/* Per-player save bar */}
                    <div style={{display:'flex',gap:10,paddingTop:12,borderTop:'1px solid var(--green-700)'}}>
                      <button className="btn btn-primary btn-sm" onClick={()=>savePlayer(player.id)}
                        disabled={isSavingThis||!hasStats}>
                        {isSavingThis?'⏳ Saving...':existingIds[player.id]?'💾 Update Player':'💾 Save Player'}
                      </button>
                      {hasStats && <button className="btn btn-danger btn-sm" onClick={()=>clearPlayer(player.id)}>✕ Clear</button>}
                      {isDirty && (
                        <button className="btn btn-ghost btn-sm" onClick={()=>{loadData();toast('Changes discarded')}}>
                          ↩ Discard
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {filteredPlayers.length===0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No players found</div>
              <div className="empty-state-desc">
                Only players from {match.team1?.name} and {match.team2?.name} are shown
              </div>
            </div>
          )}
        </div>

        {/* Sticky bottom bar */}
        <div style={{
          position:'sticky',bottom:16,marginTop:24,
          display:'flex',justifyContent:'space-between',alignItems:'center',
          background:'var(--green-900)',border:'1px solid var(--green-700)',
          borderRadius:12,padding:'12px 20px',boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
          flexWrap:'wrap',gap:12
        }}>
          <div style={{fontSize:'0.875rem',color:'var(--gray-400)'}}>
            {unsaved.size>0
              ? <span style={{color:'var(--yellow-400)'}}>⚠ {unsaved.size} unsaved change{unsaved.size>1?'s':''}</span>
              : lastSaved
                ? <span style={{color:'var(--green-300)'}}>✓ All saved · {lastSaved.toLocaleTimeString()}</span>
                : <span>{playersWithStats} players with stats · {motmPlayer?`MOTM: ${motmPlayer.name}`:'No MOTM set'}</span>
            }
          </div>
          <button className="btn btn-primary btn-lg" onClick={saveAll} disabled={saving}>
            {saving?'⏳ Saving & Recalculating...'
              : isEditMode?'💾 Save All & Recalculate Points'
              : `💾 Save All Stats (${playersWithStats} players)`}
          </button>
        </div>
      </div>
    </Layout>
  )
}
