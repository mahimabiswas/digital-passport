import { Link } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function LandingPage() {
  return (
    <div className="min-h-screen pt-14">

      <section className="max-w-4xl mx-auto px-6 py-24 border-b border-border">
        <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mb-6">
          DIGITAL PASSPORT PROTOCOL
        </p>
        <h1 className="font-display font-black text-6xl md:text-8xl tracking-tight uppercase leading-none mb-8">
          OWNERSHIP
          <br />
          <span className="text-primary">VERIFIED.</span>
          <br />
          ROYALTIES
          <br />
          ENFORCED.
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mb-10 leading-relaxed">
          A blockchain-based ownership passport for physical products.
          Creators receive royalties automatically on every resale —
          enforced by smart contract, not by trust.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            to="/register"
            className="px-6 py-3 bg-primary text-primary-foreground font-mono text-[11px] tracking-widest hover:bg-primary/90 transition-colors"
          >
            REGISTER A PRODUCT
          </Link>
          <Link
            to="/dashboard"
            className="px-6 py-3 border border-border text-foreground font-mono text-[11px] tracking-widest hover:border-primary/40 transition-colors"
          >
            VIEW DASHBOARD
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-border">
        <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mb-10">
          HOW IT WORKS
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          {[
            {
              step: '01',
              title: 'REGISTER',
              description: 'Creator registers a physical product on-chain. An NFT passport is minted. An NFC chip is attached to the product linking it to its digital record.'
            },
            {
              step: '02',
              title: 'TRANSFER',
              description: 'When the product is resold, the buyer generates a zero-knowledge proof of correct royalty calculation. The contract verifies it and pays the creator automatically.'
            },
            {
              step: '03',
              title: 'VERIFY',
              description: 'Anyone can tap the NFC tag to verify authenticity and view the full ownership history. No platform required — the blockchain is the record.'
            }
          ].map((item) => (
            <div key={item.step} className="bg-background p-8">
              <p className="font-mono text-[10px] tracking-widest text-primary mb-4">
                {item.step}
              </p>
              <h3 className="font-display font-bold text-2xl mb-4">
                {item.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}