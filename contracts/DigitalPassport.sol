// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./RoyaltyVerifier.sol";
contract DigitalPassport is ERC721 {

    struct Product {
        uint256 tokenId;
        address creator;
        string name;
        string description;
        string nfcUid;
        uint256 royaltyBasisPoints;
        uint256 minPrice;
        bool exists;
    }

    struct PendingTransfer {
        address seller;
        address buyer;
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
        uint256 royaltyDue
    );

    event OwnershipTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 royaltyPaid
    );

    Groth16Verifier public verifier;

    constructor(address verifierAddress) ERC721("DigitalPassport", "DGP") {
        verifier = Groth16Verifier(verifierAddress);
    }

    function registerProduct(
        string memory name,
        string memory description,
        string memory nfcUid,
        uint256 royaltyBasisPoints,
        uint256 minPrice
    ) external returns (uint256) {
        require(royaltyBasisPoints <= 5000, "Royalty cannot exceed 50%");
        require(bytes(nfcUid).length > 0, "NFC UID required");
        require(minPrice > 0, "Min price must be greater than zero");

        uint256 tokenId = _nextTokenId++;

        products[tokenId] = Product({
            tokenId: tokenId,
            creator: msg.sender,
            name: name,
            description: description,
            nfcUid: nfcUid,
            royaltyBasisPoints: royaltyBasisPoints,
            minPrice: minPrice,
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
        uint256 royaltyAmount
    ) external {
        require(products[tokenId].exists, "Product does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(buyer != address(0), "Invalid buyer address");
        require(royaltyAmount > 0, "Royalty must be greater than zero");
        require(!pendingTransfers[tokenId].active, "Transfer already pending");

        pendingTransfers[tokenId] = PendingTransfer({
            seller: msg.sender,
            buyer: buyer,
            royaltyDue: royaltyAmount,
            active: true
        });

        emit TransferInitiated(tokenId, msg.sender, buyer, royaltyAmount);
    }

    // Step 2: buyer completes transfer with royalty payment
    function completeTransfer(
        uint256 tokenId,
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[3] calldata _pubSignals
    ) external payable {
    PendingTransfer storage pending = pendingTransfers[tokenId];

    require(pending.active, "No pending transfer");
    require(pending.buyer == msg.sender, "Not the designated buyer");
    require(msg.value >= pending.royaltyDue, "Insufficient royalty payment");

    // Verify ZKP proof
    bool validProof = verifier.verifyProof(_pA, _pB, _pC, _pubSignals);
    require(validProof, "Invalid ZKP proof");

    // Verify public signals match what we expect
    // _pubSignals[0] = minPrice, _pubSignals[1] = royaltyAmount, _pubSignals[2] = basisPoints
    require(_pubSignals[1] == pending.royaltyDue, "Royalty mismatch");
    require(_pubSignals[2] == products[tokenId].royaltyBasisPoints, "Basis points mismatch");
    require(_pubSignals[0] == products[tokenId].minPrice, "Min price mismatch");

    address seller = pending.seller;
    address creator = products[tokenId].creator;
    uint256 royaltyPaid = pending.royaltyDue;

    pending.active = false;

    (bool sent, ) = creator.call{value: royaltyPaid}("");
    require(sent, "Royalty payment failed");

    if (msg.value > royaltyPaid) {
        (bool refunded, ) = msg.sender.call{value: msg.value - royaltyPaid}("");
        require(refunded, "Refund failed");
    }

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