// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract DigitalPassport is ERC721 {

    struct Product {
        uint256 tokenId;
        address creator;
        string name;
        string description;
        string nfcUid;
        uint256 royaltyBasisPoints; // 500 = 5%, 1000 = 10%
        bool exists;
    }

    struct PendingTransfer {
        address seller;
        address buyer;
        uint256 declaredPrice;  // in wei
        uint256 royaltyDue;     // in wei
        bool active;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => Product) public products;
    mapping(uint256 => PendingTransfer) public pendingTransfers;
    mapping(string => uint256) public nfcToToken;

    event ProductRegistered(
        uint256 indexed tokenId,
        address indexed creator,
        string name,
        string nfcUid
    );

    event TransferInitiated(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 declaredPrice,
        uint256 royaltyDue
    );

    event OwnershipTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 royaltyPaid
    );

    constructor() ERC721("DigitalPassport", "DGP") {}

    function registerProduct(
        string memory name,
        string memory description,
        string memory nfcUid,
        uint256 royaltyBasisPoints
    ) external returns (uint256) {
        require(royaltyBasisPoints <= 5000, "Royalty cannot exceed 50%");
        require(bytes(nfcUid).length > 0, "NFC UID required");

        uint256 tokenId = _nextTokenId++;

        products[tokenId] = Product({
            tokenId: tokenId,
            creator: msg.sender,
            name: name,
            description: description,
            nfcUid: nfcUid,
            royaltyBasisPoints: royaltyBasisPoints,
            exists: true
        });

        nfcToToken[nfcUid] = tokenId;

        _safeMint(msg.sender, tokenId);

        emit ProductRegistered(tokenId, msg.sender, name, nfcUid);
        return tokenId;
    }

    // Step 1: seller declares buyer and sale price
    function initiateTransfer(
        uint256 tokenId,
        address buyer,
        uint256 declaredPrice
    ) external {
        require(products[tokenId].exists, "Product does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(buyer != address(0), "Invalid buyer address");
        require(declaredPrice > 0, "Price must be greater than zero");
        require(!pendingTransfers[tokenId].active, "Transfer already pending");

        uint256 royaltyDue = (declaredPrice * products[tokenId].royaltyBasisPoints) / 10000;

        pendingTransfers[tokenId] = PendingTransfer({
            seller: msg.sender,
            buyer: buyer,
            declaredPrice: declaredPrice,
            royaltyDue: royaltyDue,
            active: true
        });

        emit TransferInitiated(tokenId, msg.sender, buyer, declaredPrice, royaltyDue);
    }

    // Step 2: buyer completes transfer with royalty payment
    // ZKP proof to be added
    function completeTransfer(uint256 tokenId) external payable {
        PendingTransfer storage pending = pendingTransfers[tokenId];

        require(pending.active, "No pending transfer");
        require(pending.buyer == msg.sender, "Not the designated buyer");
        require(msg.value >= pending.royaltyDue, "Insufficient royalty payment");

        address seller = pending.seller;
        address creator = products[tokenId].creator;
        uint256 royaltyPaid = pending.royaltyDue;

        // Clear pending transfer before external call
        pending.active = false;

        // Pay royalty to creator
        (bool sent, ) = creator.call{value: royaltyPaid}("");
        require(sent, "Royalty payment failed");

        // Refund any excess payment
        if (msg.value > royaltyPaid) {
            (bool refunded, ) = msg.sender.call{value: msg.value - royaltyPaid}("");
            require(refunded, "Refund failed");
        }

        // Transfer the NFT
        _transfer(seller, msg.sender, tokenId);

        emit OwnershipTransferred(tokenId, seller, msg.sender, royaltyPaid);
    }

    function cancelTransfer(uint256 tokenId) external {
        PendingTransfer storage pending = pendingTransfers[tokenId];
        require(pending.active, "No pending transfer");
        require(pending.seller == msg.sender, "Not the seller");

        pending.active = false;
    }

    function getProduct(uint256 tokenId) external view returns (Product memory) {
        require(products[tokenId].exists, "Product does not exist");
        return products[tokenId];
    }

    function getTokenByNfc(string memory nfcUid) external view returns (uint256) {
        return nfcToToken[nfcUid];
    }
}