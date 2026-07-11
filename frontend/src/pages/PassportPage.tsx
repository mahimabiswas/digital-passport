import { useParams } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { useState, useEffect } from 'react'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'

const BACKEND_URL = 'http://localhost:3001'

export default function PassportPage() {
  const { nfcUid } = useParams()

  // State for backend data
  const [metadata, setMetadata] = useState<{
    tokenId: number
    imageUrl: string
    description: string
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // fetch tokenId and metadata from backend using NFC UID
  useEffect(() => {
    if (!nfcUid) return

    const fetchMetadata = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/products/nfc/${nfcUid}`)
        if (!res.ok) throw new Error('Product not found')
        const data = await res.json()
        setMetadata({
          tokenId: data.tokenId,
          imageUrl: data.imageUrl,
          description: data.description,
        })
      } catch (err) {
        setError('Product not found')
      } finally {
        setLoading(false)
      }
    }

    fetchMetadata()
  }, [nfcUid])

  //  fetch on-chain product data using tokenId
  const { data: product } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getProduct',
    args: metadata ? [BigInt(metadata.tokenId)] : undefined,
    query: { enabled: !!metadata },
  })

  // fetch current owner
  const { data: currentOwner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'ownerOf',
    args: metadata ? [BigInt(metadata.tokenId)] : undefined,
    query: { enabled: !!metadata },
  })

    const { data: pendingTransfer } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'pendingTransfers',
    args: metadata ? [BigInt(metadata.tokenId)] : undefined,
    query: { enabled: !!metadata },
    })

  console.log('metadata:', metadata)
  console.log('product:', product)
  console.log('currentOwner:', currentOwner)
  console.log('pendingTransfer:', pendingTransfer)

  if (loading) return (
    <div className="min-h-screen pt-14 flex items-center justify-center">
      <p className="font-mono text-[11px] tracking-widest text-muted-foreground">
        LOADING...
      </p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen pt-14 flex items-center justify-center">
      <p className="font-mono text-[11px] tracking-widest text-destructive">
        {error}
      </p>
    </div>
  )

  return (
  <div className="min-h-screen pt-14">
    <div className="max-w-4xl mx-auto px-6 py-12">

      {/* Top section — image + core info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">

        {/* Product image */}
        <div className="aspect-square bg-card border border-border overflow-hidden">
          {metadata?.imageUrl ? (
            <img
              src={metadata.imageUrl}
              alt={product?.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-mono text-[10px] text-muted-foreground tracking-widest">
                NO IMAGE
              </span>
            </div>
          )}
        </div>

        {/* Core info */}
        <div className="flex flex-col justify-between">

          {/* Status badge */}
          <div className="mb-6">
            {pendingTransfer?.active ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-medium tracking-widest border border-amber-500/40 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                TRANSFER PENDING
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-medium tracking-widest border border-primary/40 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                VERIFIED
              </span>
            )}
          </div>

          {/* Product name */}
          <div className="mb-6">
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mb-2">
              DIGITAL PASSPORT
            </p>
            <h1 className="font-display font-black text-5xl tracking-tight leading-none uppercase">
              {product?.name}
            </h1>
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {metadata?.description}
          </p>

          {/* Key details */}
          <div className="border border-border">
            {[
              { label: 'TOKEN ID', value: `#${product?.tokenId.toString()}` },
              { label: 'NFC UID', value: product?.nfcUid },
              { label: 'ROYALTY', value: `${Number(product?.royaltyBasisPoints) / 100}%` },
              { label: 'MIN RESALE', value: `${(Number(product?.minPrice) / 1e18).toFixed(3)} ETH` },
            ].map((item, i) => (
              <div
                key={i}
                className="flex justify-between items-center px-4 py-3 border-b border-border last:border-b-0"
              >
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  {item.label}
                </span>
                <span className="font-mono text-[11px] text-foreground">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Ownership section */}
      <div className="border border-border">

        {/* Creator */}
        <div className="px-6 py-4 border-b border-border">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground mb-1">
            ORIGINAL CREATOR
          </p>
          <p className="font-mono text-sm text-foreground">
            {product?.creator.slice(0, 6)}...{product?.creator.slice(-4)}
          </p>
        </div>

        {/* Current owner */}
        <div className="px-6 py-4 border-b border-border">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground mb-1">
            CURRENT OWNER
          </p>
          <p className="font-mono text-sm text-foreground">
            {currentOwner?.slice(0, 6)}...{currentOwner?.slice(-4)}
          </p>
        </div>

        {/* Pending transfer info */}
        {pendingTransfer?.active && (
          <div className="px-6 py-4 border-b border-border bg-amber-500/5">
            <p className="font-mono text-[10px] tracking-widest text-amber-400 mb-1">
              PENDING BUYER
            </p>
            <p className="font-mono text-sm text-foreground">
              {pendingTransfer.buyer.slice(0, 6)}...{pendingTransfer.buyer.slice(-4)}
            </p>
          </div>
        )}

      </div>

    </div>
  </div>
)
}