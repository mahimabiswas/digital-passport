export const CONTRACT_ADDRESS = '0xb80dF6a3c2AA5Eed80F54D9eE2A2Fa0bA214dA15' as const

export const CONTRACT_ABI = [
  {
    name: 'getProduct',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'nfcUid', type: 'string' },
          { name: 'royaltyBasisPoints', type: 'uint256' },
          { name: 'minPrice', type: 'uint256' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getTokenByNfc',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'nfcUid', type: 'string' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'pendingTransfers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'seller', type: 'address' },
          { name: 'buyer', type: 'address' },
          { name: 'royaltyDue', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'OwnershipTransferred',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'royaltyPaid', type: 'uint256', indexed: false },
    ],
  },
] as const