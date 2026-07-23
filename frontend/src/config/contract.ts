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
    {
        name: 'Transfer',
        type: 'event',
        inputs: [
            { name: 'from', type: 'address', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'tokenId', type: 'uint256', indexed: true },
        ],
    },
    {
        name: 'registerProduct',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'name', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'nfcUid', type: 'string' },
            { name: 'royaltyBasisPoints', type: 'uint256' },
            { name: 'minPrice', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'ProductRegistered',
        type: 'event',
        inputs: [
            { name: 'tokenId', type: 'uint256', indexed: true },
            { name: 'creator', type: 'address', indexed: true },
            { name: 'name', type: 'string', indexed: false },
            { name: 'nfcUid', type: 'string', indexed: false },
        ],
    },
    {
        name: 'initiateTransfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: 'buyer', type: 'address' },
            { name: 'royaltyAmount', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'completeTransfer',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: '_pA', type: 'uint256[2]' },
            { name: '_pB', type: 'uint256[2][2]' },
            { name: '_pC', type: 'uint256[2]' },
            { name: '_pubSignals', type: 'uint256[3]' },
        ],
        outputs: [],
    },
    {
        name: 'cancelTransfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'tokenId', type: 'uint256' },
        ],
        outputs: [],
    },
] as const