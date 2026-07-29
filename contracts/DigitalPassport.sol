// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract DigitalPassport is ERC721 {

    struct Product {
        uint256 tokenId;
        address creator;
        address previousOwner;
        uint256 previousOwnerReceivedAt;
        string name;
        string description;
        string nfcUid;
        uint256 royaltyBasisPoints;
        bool exists;
    }

    struct PendingTransfer {
        address seller;
        address buyer;
        uint256 royaltyDue;
        uint256 escrowAmount;
        uint256 depositedAt;
        bool active;
        bool escrowDeposited;
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
        uint256 royaltyDue
    );

    event EscrowDeposited(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amount
    );

    event OwnershipTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 creatorShare,
        uint256 previousOwnerShare
    );

    event TransferCancelled(
        uint256 indexed tokenId,
        address indexed cancelledBy
    );

    constructor() ERC721("DigitalPassport", "DGP") {}

    // REGISTER

    function registerProduct(
        string memory name,
        string memory description,
        string memory nfcUid,
        uint256 royaltyBasisPoints
    ) external returns (uint256) {
        require(royaltyBasisPoints <= 1000, "Royalty cannot exceed 10%");
        require(bytes(nfcUid).length > 0, "NFC UID required");

        uint256 tokenId = _nextTokenId++;

        products[tokenId] = Product({
            tokenId: tokenId,
            creator: msg.sender,
            previousOwner: address(0),
            previousOwnerReceivedAt: block.timestamp,
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

    // SELLER INITIATES TRANSFER

    // Primary sale = product has never been owned by anyone other than creator
    // i.e. previousOwner == address(0)
    // Primary sale: royaltyAmount must be 0, no escrow, no royalty
    // Secondary sale: royaltyAmount must be > 0, escrow required

    function initiateTransfer(
        uint256 tokenId,
        address buyer,
        uint256 royaltyAmount
    ) external {
        require(products[tokenId].exists, "Product does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(buyer != address(0), "Invalid buyer address");
        require(buyer != msg.sender, "Cannot transfer to yourself");
        require(!pendingTransfers[tokenId].active, "Transfer already pending");

        bool isPrimarySale = (products[tokenId].previousOwner == address(0));

        if (isPrimarySale) {
            require(royaltyAmount == 0, "No royalty on primary sale");
        } else {
            require(royaltyAmount > 0, "Royalty required for secondary sale");
        }

        pendingTransfers[tokenId] = PendingTransfer({
            seller: msg.sender,
            buyer: buyer,
            royaltyDue: royaltyAmount,
            escrowAmount: 0,
            depositedAt: 0,
            active: true,
            escrowDeposited: false
        });

        emit TransferInitiated(tokenId, msg.sender, buyer, royaltyAmount);
    }

    // BUYER DEPOSITS ESCROW (only for secondary sales)

    function depositEscrow(uint256 tokenId) external payable {
        PendingTransfer storage pending = pendingTransfers[tokenId];

        require(pending.active, "No pending transfer");
        require(pending.buyer == msg.sender, "Not the designated buyer");
        require(!pending.escrowDeposited, "Escrow already deposited");
        require(pending.royaltyDue > 0, "No escrow required for primary sale");
        require(msg.value >= pending.royaltyDue, "Insufficient escrow amount");

        pending.escrowDeposited = true;
        pending.escrowAmount = msg.value;
        pending.depositedAt = block.timestamp;

        emit EscrowDeposited(tokenId, msg.sender, msg.value);
    }

    // BUYER CONFIRMS RECEIPT AFTER NFC TAP
    // Primary sale: no escrow needed, NFT transfers directly
    // Secondary sale: releases escrow, pays royalty split, transfers NFT

    function confirmReceipt(uint256 tokenId) external {
        PendingTransfer storage pending = pendingTransfers[tokenId];
        Product storage product = products[tokenId];

        require(pending.active, "No pending transfer");
        require(pending.buyer == msg.sender, "Not the designated buyer");

        bool isPrimarySale = (pending.royaltyDue == 0);

        if (!isPrimarySale) {
            require(pending.escrowDeposited, "Escrow not deposited yet");
        }

        address seller = pending.seller;
        address creator = product.creator;
        address previousOwner = product.previousOwner;
        uint256 royaltyPaid = pending.escrowAmount;

        // Clear state BEFORE external calls — prevents reentrancy
        pending.active = false;
        pending.escrowDeposited = false;
        pending.escrowAmount = 0;

        if (!isPrimarySale) {
            // Calculate time-weighted split
            uint256 timeHeld = block.timestamp - product.previousOwnerReceivedAt;
            uint256 previousOwnerBps = _getPreviousOwnerBps(timeHeld);

            uint256 previousOwnerShare = (royaltyPaid * previousOwnerBps) / 10000;
            uint256 creatorShare = royaltyPaid - previousOwnerShare;

            // Pay creator
            (bool sentCreator,) = creator.call{value: creatorShare}("");
            require(sentCreator, "Creator payment failed");

            // Pay previous owner if eligible
            if (
                previousOwnerShare > 0 &&
                previousOwner != address(0) &&
                previousOwner != creator
            ) {
                (bool sentPrevious,) = previousOwner.call{value: previousOwnerShare}("");
                require(sentPrevious, "Previous owner payment failed");
            } else if (previousOwnerShare > 0) {
                // Previous owner not eligible — creator gets it all
                (bool sentExtra,) = creator.call{value: previousOwnerShare}("");
                require(sentExtra, "Creator extra payment failed");
            }

            emit OwnershipTransferred(
                tokenId,
                seller,
                msg.sender,
                creatorShare,
                previousOwnerShare
            );
        } else {
            // Primary sale — no royalty paid
            emit OwnershipTransferred(tokenId, seller, msg.sender, 0, 0);
        }

        // Update ownership tracking for next transfer
        product.previousOwner = seller;
        product.previousOwnerReceivedAt = block.timestamp;

        // Transfer NFT to buyer
        _transfer(seller, msg.sender, tokenId);
    }

    // CANCEL TRANSFER
    // Seller: can cancel anytime
    // Buyer: can cancel only after depositing escrow
    // Anyone: can cancel after 14 days if escrow deposited

    function cancelTransfer(uint256 tokenId) external {
        PendingTransfer storage pending = pendingTransfers[tokenId];

        require(pending.active, "No pending transfer");
        require(
            pending.seller == msg.sender ||
            (pending.escrowDeposited && pending.buyer == msg.sender) ||
            (pending.escrowDeposited && block.timestamp > pending.depositedAt + 14 days),
            "Not authorised to cancel"
        );

        uint256 refundAmount = pending.escrowAmount;
        address buyer = pending.buyer;

        // Clear state BEFORE external calls
        pending.active = false;
        pending.escrowDeposited = false;
        pending.escrowAmount = 0;

        // Refund buyer if escrow was deposited
        if (refundAmount > 0) {
            (bool refunded,) = buyer.call{value: refundAmount}("");
            require(refunded, "Refund failed");
        }

        emit TransferCancelled(tokenId, msg.sender);
    }

    // TIME-WEIGHTED SPLIT
    // Creator always gets (100% - previousOwnerBps) of royalty
    // Previous owner gets 0-30% based on how long they held

    function _getPreviousOwnerBps(uint256 timeHeld) internal pure returns (uint256) {
        if (timeHeld < 7 days) {
            return 0;       // flipper — creator gets 100% of royalty
        } else if (timeHeld < 180 days) {
            return 1000;    // short term — creator gets 90%, previous owner gets 10%
        } else if (timeHeld < 365 days) {
            return 2000;    // medium term — creator gets 80%, previous owner gets 20%
        } else {
            return 3000;    // long term — creator gets 70%, previous owner gets 30%
        }
    }


    function getProduct(uint256 tokenId) external view returns (Product memory) {
        require(products[tokenId].exists, "Product does not exist");
        return products[tokenId];
    }

    function getTokenByNfc(string memory nfcUid) external view returns (uint256) {
        return nfcToToken[nfcUid];
    }

    function getPendingTransfer(uint256 tokenId) external view returns (PendingTransfer memory) {
        return pendingTransfers[tokenId];
    }
}