import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWriteContract, useAccount } from 'wagmi'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { decodeEventLog } from 'viem'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

export default function RegisterPage() {
    const navigate = useNavigate()
    const { address, isConnected } = useAccount()

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [nfcUid, setNfcUid] = useState('')
    const [royaltyPercent, setRoyaltyPercent] = useState('')
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    const [step, setStep] = useState<'idle' | 'uploading' | 'saving' | 'minting' | 'done' | 'error'>('idle')
    const [error, setError] = useState<string | null>(null)

    const { writeContractAsync } = useWriteContract()

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
    }

    const handleSubmit = async () => {
        if (!isConnected) {
            setError('Please connect your wallet first')
            return
        }
        if (!name || !description || !nfcUid || !royaltyPercent) {
            setError('Please fill in all fields')
            return
        }

        setError(null)

        try {
            // upload image
            setStep('uploading')
            let imageUrl = ''

            if (imageFile) {
                const formData = new FormData()
                formData.append('image', imageFile)
                const uploadRes = await fetch(`${BACKEND_URL}/api/upload`, {
                    method: 'POST',
                    body: formData,
                })
                if (!uploadRes.ok) throw new Error('Image upload failed')
                const uploadData = await uploadRes.json()
                imageUrl = uploadData.imageUrl
            }

            // save metadata to backend before minting
            setStep('saving')
            const royaltyBasisPoints = BigInt(Math.round(parseFloat(royaltyPercent) * 100))

            const saveRes = await fetch(`${BACKEND_URL}/api/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    nfcUid,
                    imageUrl,
                    creatorAddress: address,
                    royaltyBasisPoints: Number(royaltyBasisPoints),
                }),
            })
            if (!saveRes.ok) {
                const errData = await saveRes.json()
                throw new Error(errData.error || 'Failed to save product metadata')
            }

            // mint NFT on-chain
            setStep('minting')
            const { sepolia } = await import('viem/chains')

            const hash = await writeContractAsync({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'registerProduct',
                args: [name, description, nfcUid, royaltyBasisPoints],
                chain: sepolia,
                account: address,
            })

            // wait for confirmation and extract tokenId
            const receipt = await waitForReceipt(hash)
            let tokenId = null
            for (const log of receipt.logs as any[]) {
                try {
                    const decoded = decodeEventLog({
                        abi: CONTRACT_ABI,
                        data: log.data,
                        topics: log.topics as any,
                    })
                    if ((decoded as any).eventName === 'ProductRegistered') {
                        tokenId = Number(((decoded as any).args as any).tokenId)
                        break
                    }
                } catch { }
            }

            // patch backend record with tokenId
            if (tokenId !== null) {
                await fetch(`${BACKEND_URL}/api/products/nfc/${nfcUid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tokenId, transactionHash: hash }),
                })
            }

            setStep('done')
            setTimeout(() => navigate(`/passport/${nfcUid}`), 2000)

        } catch (err: any) {
            console.error(err)
            setError(err.message || 'Something went wrong')
            setStep('error')
        }
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

    const stepLabels: Record<string, string> = {
        idle: '',
        uploading: 'Uploading image...',
        saving: 'Saving metadata...',
        minting: 'Minting NFT on Sepolia...',
        done: 'Product registered successfully',
        error: 'Something went wrong',
    }

    return (
        <div className="min-h-screen pt-14">
            <div className="max-w-2xl mx-auto px-6 py-12">

                <div className="mb-10">
                    <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mb-2">
                        DIGITAL PASSPORT
                    </p>
                    <h1 className="font-display font-black text-5xl tracking-tight uppercase">
                        REGISTER PRODUCT
                    </h1>
                </div>

                {!isConnected && (
                    <div className="border border-border px-6 py-4 mb-6">
                        <p className="font-mono text-[11px] text-muted-foreground">
                            Connect your wallet to register a product
                        </p>
                    </div>
                )}

                <div className="space-y-px">

                    <div className="border border-border p-4">
                        <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                            PRODUCT NAME
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Air Max 1 - Sample 001"
                            className="w-full bg-transparent text-foreground font-sans text-sm outline-none placeholder:text-muted-foreground/40"
                        />
                    </div>

                    <div className="border border-border p-4">
                        <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                            DESCRIPTION
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Limited run sample, size 9"
                            rows={3}
                            className="w-full bg-transparent text-foreground font-sans text-sm outline-none resize-none placeholder:text-muted-foreground/40"
                        />
                    </div>

                    <div className="border border-border p-4">
                        <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                            NFC TAG UID
                        </label>
                        <input
                            type="text"
                            value={nfcUid}
                            onChange={e => setNfcUid(e.target.value.toUpperCase())}
                            placeholder="04A3B2C1D0E9F8"
                            className="w-full bg-transparent text-foreground font-mono text-sm outline-none placeholder:text-muted-foreground/40"
                        />
                    </div>

                    <div className="border border-border p-4">
                        <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-2">
                            ROYALTY PERCENTAGE
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={royaltyPercent}
                                onChange={e => setRoyaltyPercent(e.target.value)}
                                placeholder="5"
                                min="0"
                                max="10"
                                step="0.5"
                                className="w-full bg-transparent text-foreground font-mono text-sm outline-none placeholder:text-muted-foreground/40"
                            />
                            <span className="font-mono text-[11px] text-muted-foreground">%</span>
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                            Max 10%
                        </p>
                    </div>

                    <div className="border border-border p-4">
                        <label className="font-mono text-[10px] tracking-widest text-muted-foreground block mb-3">
                            PRODUCT IMAGE
                        </label>
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleImageChange}
                            className="hidden"
                            id="image-upload"
                        />
                        <label
                            htmlFor="image-upload"
                            className="cursor-pointer border border-dashed border-border flex items-center justify-center p-8 hover:border-primary/40 transition-colors"
                        >
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="max-h-48 object-contain" />
                            ) : (
                                <p className="font-mono text-[10px] text-muted-foreground tracking-widest">
                                    CLICK TO UPLOAD IMAGE
                                </p>
                            )}
                        </label>
                    </div>

                </div>

                {error && (
                    <div className="border border-destructive/40 px-4 py-3 mt-4">
                        <p className="font-mono text-[11px] text-destructive">{error}</p>
                    </div>
                )}

                {step !== 'idle' && step !== 'error' && (
                    <div className="border border-primary/20 px-4 py-3 mt-4 bg-primary/5">
                        <p className="font-mono text-[11px] text-primary">{stepLabels[step]}</p>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={step !== 'idle' && step !== 'error'}
                    className="w-full mt-4 py-4 bg-primary text-primary-foreground font-mono text-[11px] tracking-widest hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {step === 'idle' || step === 'error' ? 'REGISTER PRODUCT' : stepLabels[step].toUpperCase()}
                </button>

            </div>
        </div>
    )
}