import { useState } from 'react'
import Home from './pages/Home.jsx'
import Collection from './pages/Collection.jsx'
import Records from './pages/Records.jsx'
import Stats from './pages/Stats.jsx'
import './styles/app.css'

const TABS = [
  { key: 'home', label: '首页' },
  { key: 'collection', label: '我的娃' },
  { key: 'records', label: '记账' },
  { key: 'stats', label: '统计' }
]

export default function App() {
  const [tab, setTab] = useState('home')

  return (
    <div className="app">
      <main className="app-page">
        {tab === 'home' && <Home onGoTab={setTab} />}
        {tab === 'collection' && <Collection />}
        {tab === 'records' && <Records />}
        {tab === 'stats' && <Stats />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={'tabbar-item' + (tab === t.key ? ' active' : '')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
