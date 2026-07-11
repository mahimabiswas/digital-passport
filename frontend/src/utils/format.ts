// Truncates a wallet address for display
// 0x2003BdEecbf086Ddc77cC35715E2290B5651aE3d → 0x2003...ae3d
export function truncateAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Converts wei to ETH string
// 100000000000000000n → "0.1"
export function weiToEth(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4)
}

// Formats basis points to percentage string
// 500n → "5%"
export function basisPointsToPercent(bp: bigint): string {
  return `${Number(bp) / 100}%`
}