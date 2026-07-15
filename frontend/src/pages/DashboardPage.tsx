import { useAccount } from 'wagmi'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'


const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

interface Product {
  tokenId: number
  name: string
  description: string
  nfcUid: string
  imageUrl: string
  royaltyBasisPoints: number
  minPrice: string
  transactionHash: string | null
}

function ProductCard({ product }: { product: Product }) {
  const { data: currentOwner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'ownerOf',
    args: product.tokenId !== null ? [BigInt(product.tokenId)] : undefined,
    query: { enabled: product.tokenId !== null },
  })
  
  const { address } = useAccount()

  const status = product.tokenId === null
    ? 'incomplete'
    : currentOwner?.toLowerCase() === address?.toLowerCase()
    ? 'owned'
    : 'transferred'
//   console.log(currentOwner,product.description)
  const statusConfig = {
    owned: { label: 'OWNED', classes: 'border-primary/40 text-primary' },
    transferred: { label: 'TRANSFERRED', classes: 'border-muted-foreground/40 text-muted-foreground' },
    incomplete: { label: 'INCOMPLETE', classes: 'border-destructive/40 text-destructive' },
  }

  const { label, classes } = statusConfig[status]

  return (
    <Link
      to={product.tokenId !== null ? `/passport/${product.nfcUid}` : '#'}
      className="block border border-border hover:border-primary/30 transition-colors group"
    >
      {/* Image */}
      <div className="aspect-square bg-card overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest">
              NO IMAGE
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-display font-bold text-lg uppercase leading-tight">
            {product.name}
          </h3>
          <span className={`shrink-0 font-mono text-[9px] tracking-widest border px-1.5 py-0.5 ${classes}`}>
            {label}
          </span>
        </div>

        <p className="font-mono text-[10px] text-muted-foreground mb-3 line-clamp-2">
          {product.description}
        </p>

        <div className="flex justify-between items-center">
          <span className="font-mono text-[10px] text-muted-foreground">
            TOKEN #{product.tokenId ?? '—'}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {Number(product.royaltyBasisPoints) / 100}% ROYALTY
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) return

    const fetchProducts = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${BACKEND_URL}/api/products/creator/${address}`)
        const data = await res.json()
        setProducts(data)
      } catch (err) {
        console.error('Failed to fetch products:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [address])

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground mb-6">
            CONNECT WALLET TO VIEW YOUR PRODUCTS
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-14">
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mb-2">
              CREATOR DASHBOARD
            </p>
            <h1 className="font-display font-black text-5xl tracking-tight uppercase">
              MY PRODUCTS
            </h1>
          </div>
          <Link
            to="/register"
            className="font-mono text-[11px] tracking-widest border border-primary text-primary px-4 py-2 hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            + REGISTER NEW
          </Link>
        </div>

        {/* Wallet address */}
        <div className="border border-border px-4 py-3 mb-8 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
            CONNECTED WALLET
          </span>
          <span className="font-mono text-[11px] text-foreground">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>

        {/* Products grid */}
        {loading ? (
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground animate-pulse">
            LOADING...
          </p>
        ) : products.length === 0 ? (
          <div className="border border-border p-12 text-center">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground mb-4">
              NO PRODUCTS REGISTERED YET
            </p>
            <Link
              to="/register"
              className="font-mono text-[11px] tracking-widest text-primary hover:underline"
            >
              REGISTER YOUR FIRST PRODUCT →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {products.map(product => (
              <div key={product.nfcUid} className="bg-background">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}