import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/')
  }

  const isAdmin = profile?.is_admin

  return (
    <div className="page-wrapper">
      <nav className="navbar">
        <NavLink to={isAdmin ? '/admin' : '/dashboard'} className="navbar-brand">
          🏏 DPL
          <span className="navbar-brand-sub">Fantasy Cricket 2026</span>
        </NavLink>
        <div className="navbar-links">
          {isAdmin ? (
            <>
              <NavLink to="/admin" className={({isActive}) => `nav-link${isActive?' active':''}`} end>Overview</NavLink>
              <NavLink to="/admin/players" className={({isActive}) => `nav-link${isActive?' active':''}`}>Players</NavLink>
              <NavLink to="/admin/matches" className={({isActive}) => `nav-link${isActive?' active':''}`}>Matches</NavLink>
              <NavLink to="/admin/teams" className={({isActive}) => `nav-link${isActive?' active':''}`}>Teams</NavLink>
              <NavLink to="/admin/phases" className={({isActive}) => `nav-link${isActive?' active':''}`}>Phases</NavLink>
              <NavLink to="/admin/scoring" className={({isActive}) => `nav-link${isActive?' active':''}`}>Scoring</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/dashboard" className={({isActive}) => `nav-link${isActive?' active':''}`}>Dashboard</NavLink>
              <NavLink to="/team" className={({isActive}) => `nav-link${isActive?' active':''}`}>My Team</NavLink>
              <NavLink to="/leaderboard" className={({isActive}) => `nav-link${isActive?' active':''}`}>Leaderboard</NavLink>
              <NavLink to="/players" className={({isActive}) => `nav-link${isActive?' active':''}`}>Players</NavLink>
              <NavLink to="/all-teams" className={({isActive}) => `nav-link${isActive?' active':''}`}>All Teams</NavLink>
              <NavLink to="/scoring" className={({isActive}) => `nav-link${isActive?' active':''}`}>Scoring</NavLink>
            </>
          )}
        </div>
        <div className="nav-user">
          <div className="nav-avatar" title={profile?.full_name || 'User'}>
            {(profile?.full_name || profile?.username || 'U')[0].toUpperCase()}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
