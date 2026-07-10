import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()

  const navLinks = [
    { label: 'DASHBOARD', path: '/dashboard' },
    { label: 'REGISTER', path: '/register' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-6 h-6 border border-primary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <div className="w-2.5 h-2.5 bg-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-sm tracking-[0.2em] text-foreground">
              PASSPORT
            </span>
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest hidden sm:block">
              PROTOCOL
            </span>
          </div>
        </Link>

        {/* Nav + Wallet */}
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`font-mono text-[11px] tracking-widest transition-colors ${
                  location.pathname === link.path
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <ConnectButton />
        </div>

      </div>
    </header>
  )
}