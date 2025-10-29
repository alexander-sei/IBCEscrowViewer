import './App.css'
import ChannelList from './components/ChannelList'

function App() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>Sei IBC Escrow</h1>
      <p style={{ color: '#64748b', marginTop: 6, marginBottom: 16 }}>
        View outbound IBC transfer channels and the assets locked in their escrow
        addresses.
      </p>
      <ChannelList />
    </div>
  )
}

export default App
