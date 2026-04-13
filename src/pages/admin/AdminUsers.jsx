import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function AdminUsers() {
  const { user: adminUser } = useAuth()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [deleting, setDeleting] = useState(null)   // id being deleted
  const [confirmId, setConfirmId] = useState(null) // id awaiting confirm

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*, teams:fantasy_teams(count)')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function toggleAdmin(profile) {
    if (profile.id === adminUser.id) {
      toast.error("You can't change your own admin status")
      return
    }
    const newVal = !profile.is_admin
    await supabase.from('profiles').update({ is_admin: newVal }).eq('id', profile.id)
    setUsers(u => u.map(x => x.id === profile.id ? { ...x, is_admin: newVal } : x))
    toast.success(newVal ? `${profile.username} is now an admin` : `${profile.username} admin removed`)
  }

  async function deleteUser(profile) {
    if (profile.id === adminUser.id) {
      toast.error("You can't delete your own account")
      return
    }
    setDeleting(profile.id)
    try {
      // Delete profile row — the DB trigger will cascade to auth.users automatically
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id)

      if (error) throw error

      setUsers(u => u.filter(x => x.id !== profile.id))
      setConfirmId(null)
      toast.success(`${profile.username} deleted — their login access is revoked immediately`)
    } catch (err) {
      toast.error('Delete failed: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.username?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.flat_number?.toLowerCase().includes(q)
    )
  })

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Users 👤</h1>
          <p className="page-subtitle">
            {users.length} registered users ·{' '}
            <strong style={{ color: 'var(--gold-400)' }}>
              {users.filter(u => u.is_admin).length} admin(s)
            </strong>
          </p>
        </div>

        {/* Info banner */}
        <div style={{
          padding: '12px 16px', marginBottom: 20, borderRadius: 8, fontSize: '0.85rem',
          background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
          color: 'var(--gray-400)'
        }}>
          💡 Deleting a user removes their profile <strong style={{ color: 'var(--cream)' }}>and revokes their login access immediately</strong> — they will be signed out on their next action.
        </div>

        <div className="filter-bar">
          <input className="form-input search-input" placeholder="Search name, username or flat..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="loading-center" style={{ minHeight: 200 }}>
            <div className="loading-spinner" />
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Username</th>
                  <th>Flat / RH</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isMe      = u.id === adminUser.id
                  const isDeleting = deleting === u.id
                  const isConfirm  = confirmId === u.id

                  return (
                    <tr key={u.id} style={{ opacity: isDeleting ? 0.5 : 1 }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{u.full_name || '—'}</div>
                        {isMe && (
                          <span style={{ fontSize: '0.68rem', background: 'rgba(212,175,55,0.15)', color: 'var(--gold-300)', padding: '1px 6px', borderRadius: 4 }}>
                            You
                          </span>
                        )}
                      </td>
                      <td className="td-muted">{u.username}</td>
                      <td className="td-muted">{u.flat_number || '—'}</td>
                      <td>
                        <span className={`badge ${u.is_admin ? 'badge-gold' : 'badge-gray'}`}>
                          {u.is_admin ? '⚙️ Admin' : 'User'}
                        </span>
                      </td>
                      <td className="td-muted" style={{ fontSize: '0.8rem' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        {!isConfirm ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            {!isMe && (
                              <button
                                className={`btn btn-sm ${u.is_admin ? 'btn-secondary' : 'btn-secondary'}`}
                                onClick={() => toggleAdmin(u)}
                                title={u.is_admin ? 'Remove admin' : 'Make admin'}
                              >
                                {u.is_admin ? '↓ Remove Admin' : '↑ Make Admin'}
                              </button>
                            )}
                            {!isMe && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => setConfirmId(u.id)}
                                disabled={isDeleting}
                              >
                                🗑 Delete
                              </button>
                            )}
                          </div>
                        ) : (
                          /* Confirm delete */
                          <div style={{
                            display: 'flex', gap: 8, alignItems: 'center',
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 8, padding: '6px 10px'
                          }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--red-400)', fontWeight: 600 }}>
                              Delete {u.username}?
                            </span>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => deleteUser(u)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? '⏳ Deleting...' : '✓ Yes, Delete'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">👤</div>
                <div className="empty-state-title">No users found</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
