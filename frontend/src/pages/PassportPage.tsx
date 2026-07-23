import { useParams } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { useState, useEffect } from 'react'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { useAccount, useWriteContract } from 'wagmi'
import { parseEther, createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import * as snarkjs from 'snarkjs'

export default function PassportPage() {
    const { nfcUid } = useParams()
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
    // Off-chain metadata from backend
    const [metadata, setMetadata] = useState<{
        imageUrl: string
        description: string
    } | null>(null)

    // Ownership history from backend (which queries Etherscan)
    const [history, setHistory] = useState<{
        from: string
        to: string
        date: string
        type: 'mint' | 'transfer'
    }[]>([])

    const { address } = useAccount()
    const { writeContractAsync } = useWriteContract()

    // Transfer state
    const [showInitiateForm, setShowInitiateForm] = useState(false)
    const [showCompleteForm, setShowCompleteForm] = useState(false)
    const [buyerAddress, setBuyerAddress] = useState('')
    const [salePrice, setSalePrice] = useState('')
    const [transferStep, setTransferStep] = useState<'idle' | 'generating' | 'confirming' | 'done' | 'error'>('idle')
    const [transferError, setTransferError] = useState<string | null>(null)
    // Step 1 — get tokenId directly from contract using NFC UID
    const { data: tokenId } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getTokenByNfc',
        args: nfcUid ? [nfcUid] : undefined,
        query: { enabled: !!nfcUid },
    })

    // Step 2 — get full product data from contract
    const { data: product } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getProduct',
        args: tokenId !== undefined ? [tokenId] : undefined,
        query: { enabled: tokenId !== undefined },
    })

    // Step 3 — get current owner from contract
    const { data: currentOwner } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'ownerOf',
        args: tokenId !== undefined ? [tokenId] : undefined,
        query: { enabled: tokenId !== undefined },
    })

    // Step 4 — get pending transfer from contract
    const { data: pendingTransfer } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'pendingTransfers',
        args: tokenId !== undefined ? [tokenId] : undefined,
        query: { enabled: tokenId !== undefined },
    })

    // Step 5 — get image and description from backend
    useEffect(() => {
        if (!nfcUid) return
        fetch(`${BACKEND_URL}/api/products/nfc/${nfcUid}`)
            .then(res => res.json())
            .then(data => setMetadata({
                imageUrl: data.imageUrl,
                description: data.description,
            }))
            .catch(err => console.error('Failed to fetch metadata:', err))
    }, [nfcUid])

    // Step 6 — get ownership history from backend
    useEffect(() => {
        if (tokenId === undefined) return
        fetch(`${BACKEND_URL}/api/history/${tokenId.toString()}`)
            .then(res => res.json())
            .then(data => setHistory(data))
            .catch(err => console.error('Failed to fetch history:', err))
    }, [tokenId])

    // Loading state — wait for product data from chain
    if (!product) return (
        <div className="min-h-screen pt-14 flex items-center justify-center">
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground animate-pulse">
                LOADING...
            </p>
        </div>
    )
    const royaltyDue = (salePrice: string, basisPoints: bigint): bigint => {
        if (!salePrice) return 0n
        const priceWei = parseEther(salePrice)
        return (priceWei * basisPoints) / 10000n
    }

    const handleInitiateTransfer = async () => {
        if (!buyerAddress || !salePrice || !product || tokenId === undefined) return
        setTransferError(null)

        try {
            setTransferStep('confirming')
            const royalty = royaltyDue(salePrice, product.royaltyBasisPoints)
            const { sepolia: sepoliaChain } = await import('viem/chains')

            await writeContractAsync({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'initiateTransfer',
                args: [tokenId, buyerAddress as `0x${string}`, royalty],
                chain: sepoliaChain,
                account: address,
            })

            setTransferStep('done')
            setShowInitiateForm(false)
            window.location.reload()
        } catch (err: any) {
            setTransferError(err.message || 'Transaction failed')
            setTransferStep('error')
        }
    }

    const handleCompleteTransfer = async () => {
        if (!salePrice || !product || tokenId === undefined || !pendingTransfer) return
        setTransferError(null)

        try {
            // Step 1 — generate ZKP proof in browser
            setTransferStep('generating')
            const priceWei = parseEther(salePrice)
            const minPriceWei = product.minPrice

            const input = {
                price: priceWei.toString(),
                minPrice: minPriceWei.toString(),
                royaltyAmount: pendingTransfer.royaltyDue.toString(),
                basisPoints: product.royaltyBasisPoints.toString(),
            }

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                '/RoyaltyProof.wasm',
                '/royalty_0001.zkey'
            )

            const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)
            const calldataJson = JSON.parse('[' + calldata + ']')
            const pA = calldataJson[0]
            const pB = calldataJson[1]
            const pC = calldataJson[2]
            const pubSignals = calldataJson[3]

            // Step 2 — submit proof + payment on-chain
            setTransferStep('confirming')
            const { sepolia: sepoliaChain } = await import('viem/chains')

            await writeContractAsync({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'completeTransfer',
                args: [tokenId, pA, pB, pC, pubSignals],
                value: pendingTransfer.royaltyDue,
                chain: sepoliaChain,
                account: address,
            })

            setTransferStep('done')
            setShowCompleteForm(false)
            window.location.reload()
        } catch (err: any) {
            setTransferError(err.message || 'Transaction failed')
            setTransferStep('error')
        }
    }

    const handleCancelTransfer = async () => {
        if (tokenId === undefined) return
        try {
            const { sepolia: sepoliaChain } = await import('viem/chains')
            await writeContractAsync({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'cancelTransfer',
                args: [tokenId],
                chain: sepoliaChain,
                account: address,
            })
            window.location.reload()
        } catch (err: any) {
            console.error(err)
        }
    }
    return (
        <div className="min-h-screen pt-14">
            <div className="max-w-4xl mx-auto px-6 py-12">

                {/* Top section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">

                    {/* Product image */}
                    <div className="aspect-square bg-card border border-border overflow-hidden">
                        {metadata?.imageUrl ? (
                            <img
                                src={metadata.imageUrl}
                                alt={product.name}
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
                                {product.name}
                            </h1>
                        </div>

                        {/* Description */}
                        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                            {metadata?.description || product.description}
                        </p>

                        {/* Key details */}
                        <div className="border border-border">
                            {[
                                { label: 'TOKEN ID', value: `#${product.tokenId.toString()}` },
                                { label: 'NFC UID', value: product.nfcUid },
                                { label: 'ROYALTY', value: `${Number(product.royaltyBasisPoints) / 100}%` },
                                { label: 'MIN RESALE', value: `${(Number(product.minPrice) / 1e18).toFixed(3)} ETH` },
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
                <div className="border border-border mb-8">
                    <div className="px-6 py-4 border-b border-border">
                        <p className="font-mono text-[10px] tracking-widest text-muted-foreground mb-1">
                            ORIGINAL CREATOR
                        </p>
                        <p className="font-mono text-sm text-foreground">
                            {product.creator.slice(0, 6)}...{product.creator.slice(-4)}
                        </p>
                    </div>

                    <div className="px-6 py-4 border-b border-border">
                        <p className="font-mono text-[10px] tracking-widest text-muted-foreground mb-1">
                            CURRENT OWNER
                        </p>
                        <p className="font-mono text-sm text-foreground">
                            {currentOwner?.slice(0, 6)}...{currentOwner?.slice(-4)}
                        </p>
                    </div>

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

                {/* Ownership History */}
                {history.length > 0 && (
                    <div className="border border-border">
                        <div className="px-6 py-4 border-b border-border">
                            <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                OWNERSHIP HISTORY
                            </p>
                        </div>
                        {history.map((event, i) => (
                            <div
                                key={i}
                                className="px-6 py-4 border-b border-border last:border-b-0 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                    <div>
                                        <p className="font-mono text-[10px] text-muted-foreground tracking-widest mb-1">
                                            {event.type === 'mint' ? 'MINTED' : 'TRANSFERRED'}
                                        </p>
                                        <p className="font-mono text-[11px] text-foreground">
                                            {event.type === 'mint'
                                                ? `To ${event.to.slice(0, 6)}...${event.to.slice(-4)}`
                                                : `${event.from.slice(0, 6)}...${event.from.slice(-4)} → ${event.to.slice(0, 6)}...${event.to.slice(-4)}`
                                            }
                                        </p>
                                    </div>
                                </div>
                                <p className="font-mono text-[10px] text-muted-foreground">
                                    {event.date}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

            </div>
            {/* Transfer Actions */}
            {address && product && tokenId !== undefined && (
                <div className="mt-8">

                    {/* Seller — initiate transfer */}
                    {currentOwner?.toLowerCase() === address.toLowerCase() && !pendingTransfer?.active && (
                        <div className="border border-border">
                            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                                <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                    YOU OWN THIS PRODUCT
                                </p>
                                <button
                                    onClick={() => setShowInitiateForm(!showInitiateForm)}
                                    className="font-mono text-[10px] tracking-widest text-primary hover:underline"
                                >
                                    {showInitiateForm ? 'CANCEL' : 'INITIATE TRANSFER →'}
                                </button>
                            </div>

                            {showInitiateForm && (
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                                            BUYER WALLET ADDRESS
                                        </label>
                                        <input
                                            type="text"
                                            value={buyerAddress}
                                            onChange={e => setBuyerAddress(e.target.value)}
                                            placeholder="0x..."
                                            className="w-full bg-transparent border border-border px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                                            AGREED SALE PRICE (ETH)
                                        </label>
                                        <input
                                            type="number"
                                            value={salePrice}
                                            onChange={e => setSalePrice(e.target.value)}
                                            placeholder="0.5"
                                            step="0.01"
                                            className="w-full bg-transparent border border-border px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/50"
                                        />
                                        {salePrice && (
                                            <p className="font-mono text-[10px] text-muted-foreground mt-1">
                                                ROYALTY DUE: {Number(royaltyDue(salePrice, product.royaltyBasisPoints)) / 1e18} ETH
                                            </p>
                                        )}
                                    </div>

                                    {transferError && (
                                        <p className="font-mono text-[10px] text-destructive">{transferError}</p>
                                    )}

                                    <button
                                        onClick={handleInitiateTransfer}
                                        disabled={transferStep === 'confirming'}
                                        className="w-full py-3 bg-primary text-primary-foreground font-mono text-[11px] tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                    >
                                        {transferStep === 'confirming' ? 'CONFIRMING...' : 'CONFIRM TRANSFER'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Seller — cancel pending transfer */}
                    {currentOwner?.toLowerCase() === address.toLowerCase() && pendingTransfer?.active && (
                        <div className="border border-amber-500/40 px-6 py-4 flex items-center justify-between">
                            <p className="font-mono text-[10px] tracking-widest text-amber-400">
                                TRANSFER PENDING — WAITING FOR BUYER
                            </p>
                            <button
                                onClick={handleCancelTransfer}
                                className="font-mono text-[10px] tracking-widest text-destructive hover:underline"
                            >
                                CANCEL
                            </button>
                        </div>
                    )}

                    {/* Buyer — complete transfer */}
                    {pendingTransfer?.active &&
                        pendingTransfer.buyer.toLowerCase() === address.toLowerCase() && (
                            <div className="border border-primary/40">
                                <div className="px-6 py-4 border-b border-border">
                                    <p className="font-mono text-[10px] tracking-widest text-primary mb-1">
                                        TRANSFER AWAITING YOUR COMPLETION
                                    </p>
                                    <p className="font-mono text-[10px] text-muted-foreground">
                                        ROYALTY DUE: {Number(pendingTransfer.royaltyDue) / 1e18} ETH
                                    </p>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                                            ENTER AGREED SALE PRICE (PRIVATE — STAYS IN BROWSER)
                                        </label>
                                        <input
                                            type="number"
                                            value={salePrice}
                                            onChange={e => setSalePrice(e.target.value)}
                                            placeholder="0.5"
                                            step="0.01"
                                            className="w-full bg-transparent border border-border px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/50"
                                        />
                                        <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                                            Used to generate ZKP proof. Never sent to any server.
                                        </p>
                                    </div>

                                    {transferStep === 'generating' && (
                                        <p className="font-mono text-[10px] text-primary animate-pulse">
                                            GENERATING ZERO-KNOWLEDGE PROOF...
                                        </p>
                                    )}

                                    {transferError && (
                                        <p className="font-mono text-[10px] text-destructive">{transferError}</p>
                                    )}

                                    <button
                                        onClick={handleCompleteTransfer}
                                        disabled={transferStep === 'generating' || transferStep === 'confirming'}
                                        className="w-full py-3 bg-primary text-primary-foreground font-mono text-[11px] tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                    >
                                        {transferStep === 'generating' ? 'GENERATING PROOF...' :
                                            transferStep === 'confirming' ? 'CONFIRMING ON-CHAIN...' :
                                                `COMPLETE TRANSFER & PAY ${Number(pendingTransfer.royaltyDue) / 1e18} ETH`}
                                    </button>
                                </div>
                            </div>
                        )}

                </div>
            )}
        </div>
    )
}