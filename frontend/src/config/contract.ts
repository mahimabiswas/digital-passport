export const CONTRACT_ADDRESS = '0x66387E6EBBa3597652c14E2D643C685CAD80D693' as const

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
                    { name: 'previousOwner', type: 'address' },
                    { name: 'previousOwnerReceivedAt', type: 'uint256' },
                    { name: 'productName', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'nfcUid', type: 'string' },
                    { name: 'royaltyBasisPoints', type: 'uint256' },
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
                    { name: 'salePrice', type: 'uint256' },
                    { name: 'escrowAmount', type: 'uint256' },
                    { name: 'depositedAt', type: 'uint256' },
                    { name: 'active', type: 'bool' },
                    { name: 'escrowDeposited', type: 'bool' },
                ],
            },
        ],
    },
    {
        name: 'getPendingTransfer',
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
                    { name: 'escrowAmount', type: 'uint256' },
                    { name: 'depositedAt', type: 'uint256' },
                    { name: 'active', type: 'bool' },
                    { name: 'escrowDeposited', type: 'bool' },
                ],
            },
        ],
    },
    {
        name: 'registerProduct',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'productName', type: 'string' },
            { name: 'productDescription', type: 'string' },
            { name: 'nfcUid', type: 'string' },
            { name: 'royaltyBasisPoints', type: 'uint256' },
            { name: 'imageURI', type: 'string' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'TransferInitiated',
        type: 'event',
        inputs: [
            { name: 'tokenId', type: 'uint256', indexed: true },
            { name: 'seller', type: 'address', indexed: true },
            { name: 'buyer', type: 'address', indexed: true },
            { name: 'royaltyDue', type: 'uint256', indexed: false },
        ],
    },
    {
        name: 'EscrowDeposited',
        type: 'event',
        inputs: [
            { name: 'tokenId', type: 'uint256', indexed: true },
            { name: 'buyer', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
    {
        name: 'TransferCancelled',
        type: 'event',
        inputs: [
            { name: 'tokenId', type: 'uint256', indexed: true },
            { name: 'cancelledBy', type: 'address', indexed: true },
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
            { name: 'salePrice', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'depositEscrow',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            { name: 'tokenId', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'confirmReceipt',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'tokenId', type: 'uint256' },
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
    {
        name: 'ProductRegistered',
        type: 'event',
        inputs: [
            { name: 'tokenId', type: 'uint256', indexed: true },
            { name: 'creator', type: 'address', indexed: true },
            { name: 'productName', type: 'string', indexed: false },
            { name: 'nfcUid', type: 'string', indexed: false },
        ],
    },
    {
        name: 'OwnershipTransferred',
        type: 'event',
        inputs: [
            { name: 'tokenId', type: 'uint256', indexed: true },
            { name: 'from', type: 'address', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'creatorShare', type: 'uint256', indexed: false },
            { name: 'previousOwnerShare', type: 'uint256', indexed: false },
            { name: 'salePrice', type: 'uint256', indexed: false },
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
] as const