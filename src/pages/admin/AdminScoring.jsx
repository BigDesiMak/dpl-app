import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'

export default function AdminScoring() {
  const [settings, setSettings] = useState([])
  const [changed, setChanged] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    const { data } = await supabase.from('scoring_settings').select('*').order('category').order('key')
    setSettings(data || [])
    setLoading(false)
  }

  function setValue(key, value) {
    setChanged(c => ({ ...c, [key]: value }))
    setSettings(s => s.map(x => x.key === key ? { ...x, value: parseFloat(value) } : x))
  }

  async function saveAll() {
    const entries = Object.entries(changed)
    if (entries.length === 0) { toast('No changes to save'); return }
    setSaving(true)
    for (const [key, value] of entries) {
      await supabase.from('scoring_settings').update({ value: parseFloat(value), updated_at: new Date().toISOString() }).eq('key', key)
    }
    setSaving(false)
    setChanged({})
    toast.success(`${entries.length} scoring rule(s) updated! ⚙️`)
    loadSettings()
  }

  const groups = ['batting', 'bowling', 'fielding', 'multipliers']
  const groupLabels = { batting: '🏏 Batting', bowling: '🎯 Bowling', fielding: '🧤 Fielding', multipliers: '👑 Multipliers' }

  const formatKey = k => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div><h1 className="page-title">Scoring Rules ⚙️</h1><p className="page-subtitle">Configure fantasy point values</p></div>
          <button className="btn btn-primary" onClick={saveAll} disabled={saving || Object.keys(changed).length === 0}>
            {saving ? 'Saving...' : `Save Changes${Object.keys(changed).length > 0 ? ` (${Object.keys(changed).length})` : ''}`}
          </button>
        </div>

        {/* Quick Reference Card */}
        <div className="card card-gold mb-4" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, color: 'var(--gold-400)', marginBottom: 12 }}>📋 DPL Scoring Quick Reference</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, fontSize: '0.8rem', color: 'var(--gray-400)' }}>
            <div><strong style={{color:'var(--cream)'}}>Batting Milestones</strong><br/>15-29 runs: +4pts<br/>30-49 runs: +8pts<br/>50+ runs: +16pts<br/>Duck: -4pts</div>
            <div><strong style={{color:'var(--cream)'}}>Strike Rate (min 5 balls)</strong><br/>150+: +6pts | 120-149: +4pts<br/>70-84: -2pts | 50-69: -4pts<br/>Below 50: -6pts</div>
            <div><strong style={{color:'var(--cream)'}}>Bowling Milestones</strong><br/>3 wickets: +8pts bonus<br/>5 wickets: +16pts bonus<br/>Maiden over: +12pts<br/>Wide/No ball: -2pts each</div>
            <div><strong style={{color:'var(--cream)'}}>Economy Rate (min 1 over)</strong><br/>Below 3.00: +6pts | 3-4.49: +4pts<br/>4.5-5.99: +2pts<br/>8-9: -4pts | 9+: -6pts</div>
          </div>
        </div>

        {groups.map(cat => {
          const catSettings = settings.filter(s => s.category === cat)
          if (!catSettings.length) return null
          return (
            <div key={cat} className="card mb-3">
              <h3 className="card-title" style={{ marginBottom: 20, color: 'var(--gold-400)' }}>{groupLabels[cat]}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {catSettings.map(s => (
                  <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--cream-dark)' }}>{formatKey(s.key)}</label>
                    {s.description && <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: 2 }}>{s.description}</div>}
                    <input type="number" step="0.5" className="form-input"
                      style={{ borderColor: changed[s.key] !== undefined ? 'var(--gold-400)' : undefined }}
                      value={s.value} onChange={e => setValue(s.key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <button className="btn btn-primary btn-lg" onClick={saveAll} disabled={saving || Object.keys(changed).length === 0}>
            {saving ? 'Saving...' : `💾 Save All Changes${Object.keys(changed).length > 0 ? ` (${Object.keys(changed).length} modified)` : ''}`}
          </button>
        </div>
      </div>
    </Layout>
  )
}
