import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'Digital Passport',
  projectId: '206cf95e6cad25bed4566a2a7b89c181',
  chains: [sepolia],
  ssr: false,
})