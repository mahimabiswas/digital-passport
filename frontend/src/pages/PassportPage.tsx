import { useParams } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { useState, useEffect } from 'react'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { useAccount, useWriteContract } from 'wagmi'
import { parseEther } from 'viem'

export default function PassportPage() {
    const { nfcUid } = useParams()
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

    const [metadata, setMetadata] = useState<{
        imageUrl: string
        description: string
    } | null>(null)

    const [history, setHistory] = useState<{
        from: string
        to: string
        date: string
        type: 'mint' | 'transfer'
    }[]>([])

    const { address } = useAccount()
    const { writeContractAsync } = useWriteContract()

    const [showInitiateForm, setShowInitiateForm] = useState(false)
    const [buyerAddress, setBuyerAddress] = useState('')
    const [salePrice, setSalePrice] = useState('')
    const [transferStep, setTransferStep] = useState<'idle' | 'confirming' | 'done' | 'error'>('idle')
    const [transferError, setTransferError] = useState<string | null>(null)
    const [nfcVerified, setNfcVerified] = useState(false)
    const [nfcError, setNfcError] = useState<string | null>(null)
    const { data: tokenId } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getTokenByNfc',
        args: nfcUid ? [nfcUid] : undefined,
        query: { enabled: !!nfcUid },
    })

    const { data: product } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getProduct',
        args: tokenId !== undefined ? [tokenId] : undefined,
        query: { enabled: tokenId !== undefined },
    })

    const { data: currentOwner } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'ownerOf',
        args: tokenId !== undefined ? [tokenId] : undefined,
        query: { enabled: tokenId !== undefined },
    })

    const { data: pendingTransfer, refetch: refetchPending } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getPendingTransfer',
        args: tokenId !== undefined ? [tokenId] : undefined,
        query: { enabled: tokenId !== undefined },
    })

    useEffect(() => {
        if (!nfcUid) return
        fetch(`${BACKEND_URL}/api/products/nfc/${nfcUid}`)
            .then(res => res.json())
            .then(data => setMetadata({ imageUrl: data.imageUrl, description: data.description }))
            .catch(err => console.error('Failed to fetch metadata:', err))
    }, [nfcUid])

    useEffect(() => {
        if (tokenId === undefined) return
        fetch(`${BACKEND_URL}/api/history/${tokenId.toString()}`)
            .then(res => res.json())
            .then(data => setHistory(data))
            .catch(err => console.error('Failed to fetch history:', err))
    }, [tokenId])
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const picc = params.get('picc')
        const enc = params.get('enc')
        const cmac = params.get('cmac')
        const verified = params.get('verified')

        console.log('NFC params:', { picc, enc, cmac, verified })

        if (verified === 'true') {
            setNfcVerified(true)
            return
        }

        if (!picc || !enc || !cmac) {
            console.log('No NFC params, skipping')
            return
        }

        console.log('Calling verify-nfc...')

        fetch(`${BACKEND_URL}/api/verify-nfc?picc=${picc}&enc=${enc}&cmac=${cmac}`)
            .then(res => res.json())
            .then(data => {
                console.log('Verify response:', data)
                if (data.verified) {
                    const redirectUrl = `${window.location.origin}/passport/${data.uid}?verified=true`
                    console.log('Redirecting to:', redirectUrl)
                    window.location.replace(redirectUrl)
                } else {
                    setNfcError(data.error || 'NFC verification failed')
                }
            })
            .catch(err => {
                console.error('Verify error:', err)
                setNfcError('NFC verification failed')
            })
    }, [])
    if (!product) return (
        <div className="min-h-screen pt-14 flex items-center justify-center">
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground animate-pulse">
                LOADING...
            </p>
        </div>
    )

    const isPrimarySale = product.previousOwner === '0x0000000000000000000000000000000000000000'

    const royaltyDue = (salePrice: string, basisPoints: bigint): bigint => {
        if (!salePrice || isPrimarySale) return 0n
        const priceWei = parseEther(salePrice)
        return (priceWei * basisPoints) / 10000n
    }
    const waitForReceipt = async (hash: `0x${string}`) => {
        const { createPublicClient, http } = await import('viem')
        const { sepolia } = await import('viem/chains')
        const client = createPublicClient({
            chain: sepolia,
            transport: http(import.meta.env.VITE_RPC_URL),
        })
        return client.waitForTransactionReceipt({ hash })
    }
    const sendTx = async (args: any) => {
        const hash = await writeContractAsync(args)
        await waitForReceipt(hash)
        await new Promise(r => setTimeout(r, 1500))
        return hash
    }

    const handleInitiateTransfer = async () => {
        if (!buyerAddress || !product || tokenId === undefined) return
        if (!isPrimarySale && !salePrice) return
        setTransferError(null)
        try {
            setTransferStep('confirming')
            const royalty = royaltyDue(salePrice, product.royaltyBasisPoints)
            const { sepolia: sepoliaChain } = await import('viem/chains')
            await sendTx({
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

    const handleDepositEscrow = async () => {
        if (!pendingTransfer || tokenId === undefined) return
        setTransferError(null)
        try {
            setTransferStep('confirming')
            const { sepolia: sepoliaChain } = await import('viem/chains')
            await sendTx({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'depositEscrow',
                args: [tokenId],
                value: pendingTransfer.royaltyDue,
                chain: sepoliaChain,
                account: address,
            })
            setTransferStep('idle')
            refetchPending()
        } catch (err: any) {
            setTransferError(err.message || 'Transaction failed')
            setTransferStep('error')
        }
    }

    const handleConfirmReceipt = async () => {
        if (tokenId === undefined) return
        setTransferError(null)
        try {
            setTransferStep('confirming')
            const { sepolia: sepoliaChain } = await import('viem/chains')
            await sendTx({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'confirmReceipt',
                args: [tokenId],
                chain: sepoliaChain,
                account: address,
            })
            setTransferStep('done')
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
            await sendTx({
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
                                { label: 'SALE TYPE', value: isPrimarySale ? 'PRIMARY (NO ROYALTY)' : 'SECONDARY' },
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
                    <div className="border border-border mb-8">
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
                <div className="max-w-4xl mx-auto px-6 pb-12">

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

                                    {!isPrimarySale && (
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
                                    )}

                                    {isPrimarySale && (
                                        <p className="font-mono text-[10px] text-muted-foreground/60">
                                            PRIMARY SALE — NO ROYALTY REQUIRED
                                        </p>
                                    )}

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

                    {/* Buyer — deposit escrow then confirm receipt */}
                    {pendingTransfer?.active &&
                        pendingTransfer.buyer.toLowerCase() === address.toLowerCase() && (
                            <div className="border border-primary/40">
                                <div className="px-6 py-4 border-b border-border">
                                    <p className="font-mono text-[10px] tracking-widest text-primary mb-1">
                                        TRANSFER AWAITING YOUR COMPLETION
                                    </p>
                                    {pendingTransfer.royaltyDue > 0n && (
                                        <p className="font-mono text-[10px] text-muted-foreground">
                                            ROYALTY DUE: {Number(pendingTransfer.royaltyDue) / 1e18} ETH
                                        </p>
                                    )}
                                </div>

                                <div className="p-6 space-y-3">
                                    {pendingTransfer.royaltyDue === 0n ? (
                                        // Primary sale — no escrow needed
                                        <>
                                            <p className="font-mono text-[10px] text-muted-foreground/60">
                                                PRIMARY SALE — Tap the NFC tag to verify you have received the item, then confirm to complete the transfer.
                                            </p>
                                            {transferError && (
                                                <p className="font-mono text-[10px] text-destructive">{transferError}</p>
                                            )}
                                            {!nfcVerified && (
                                                <p className="font-mono text-[10px] text-amber-400">
                                                    {nfcError ? `NFC ERROR: ${nfcError}` : 'TAP THE PHYSICAL ITEM\'S NFC TAG TO UNLOCK TRANSFER'}
                                                </p>
                                            )}
                                            <button
                                                onClick={handleConfirmReceipt}
                                                disabled={transferStep === 'confirming'}
                                                className="w-full py-3 bg-primary text-primary-foreground font-mono text-[11px] tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                            >
                                                {transferStep === 'confirming' ? 'CONFIRMING...' : !nfcVerified ? 'VERIFY NFC TAG' : 'CONFIRM RECEIPT & COMPLETE TRANSFER'}
                                            </button>
                                        </>
                                    ) : !pendingTransfer.escrowDeposited ? (
                                        // Secondary sale step 1 — deposit
                                        <>
                                            <p className="font-mono text-[10px] text-muted-foreground/60">
                                                STEP 1 — Deposit royalty into escrow. Funds are held in the contract until you confirm receipt of the physical item.
                                            </p>
                                            {transferError && (
                                                <p className="font-mono text-[10px] text-destructive">{transferError}</p>
                                            )}
                                            <button
                                                onClick={handleDepositEscrow}
                                                disabled={transferStep === 'confirming'}
                                                className="w-full py-3 bg-primary text-primary-foreground font-mono text-[11px] tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                            >
                                                {transferStep === 'confirming' ? 'DEPOSITING...' : `DEPOSIT ${Number(pendingTransfer.royaltyDue) / 1e18} ETH INTO ESCROW`}
                                            </button>
                                        </>
                                    ) : (
                                        // Secondary sale step 2 — confirm
                                        <>
                                            <p className="font-mono text-[10px] text-muted-foreground/60">
                                                STEP 2 — Tap the NFC tag on the physical item to verify you have received it, then confirm to release escrow and complete the transfer.
                                            </p>
                                            {transferError && (
                                                <p className="font-mono text-[10px] text-destructive">{transferError}</p>
                                            )}
                                            <button
                                                onClick={handleConfirmReceipt}
                                                disabled={transferStep === 'confirming'}
                                                className="w-full py-3 bg-primary text-primary-foreground font-mono text-[11px] tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                            >
                                                {transferStep === 'confirming' ? 'CONFIRMING...' : !nfcVerified ? 'VERIFY NFC TAG' : 'CONFIRM RECEIPT & COMPLETE TRANSFER'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                </div>
            )}
        </div>
    )
}