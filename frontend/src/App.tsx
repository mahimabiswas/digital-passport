import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { config } from './config/wagmi'
import Header from './components/Header'
import PassportPage from './pages/PassportPage'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <BrowserRouter>
            <Header />
            <Routes>
              <Route path="/" element={<div className="text-primary p-8 pt-20 font-display text-4xl">DIGITAL PASSPORT</div>} />
              <Route path="/register" element={<div className="text-primary p-8 pt-20">Register</div>} />
              <Route path="/dashboard" element={<div className="text-primary p-8 pt-20">Dashboard</div>} />
              <Route path="/passport/:nfcUid" element={<PassportPage />} />
              <Route path="/transfer/:tokenId" element={<div className="text-primary p-8 pt-20">Transfer</div>} />
            </Routes>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App