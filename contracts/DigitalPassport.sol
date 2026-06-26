// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DigitalPassport {

    struct Product {
        uint256 tokenId;
        address creator;
        address currentOwner;
        string name;
        string description;
        string nfcUid;
        uint256 royaltyAmount; // in wei
        bool exists;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => Product) public products;
    mapping(string => uint256) public nfcToToken; // nfc UID => tokenId

    event ProductRegistered(uint256 indexed tokenId, address indexed creator, string name, string nfcUid);
    event OwnershipTransferred(uint256 indexed tokenId, address indexed from, address indexed to, uint256 royaltyPaid);

    function registerProduct(
        string memory name,
        string memory description,
        string memory nfcUid,
        uint256 royaltyAmount
    ) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;

        products[tokenId] = Product({
            tokenId: tokenId,
            creator: msg.sender,
            currentOwner: msg.sender,
            name: name,
            description: description,
            nfcUid: nfcUid,
            royaltyAmount: royaltyAmount,
            exists: true
        });

        nfcToToken[nfcUid] = tokenId;

        emit ProductRegistered(tokenId, msg.sender, name, nfcUid);
        return tokenId;
    }

    function transferOwnership(uint256 tokenId, address newOwner) external payable {
        Product storage product = products[tokenId];

        require(product.exists, "Product does not exist");
        require(product.currentOwner == msg.sender, "Not current owner");
        require(newOwner != address(0), "Invalid new owner");
        require(msg.value >= product.royaltyAmount, "Royalty payment required");

        // Pay royalty to creator
        (bool sent, ) = product.creator.call{value: msg.value}("");
        require(sent, "Royalty payment failed");

        address previousOwner = product.currentOwner;
        product.currentOwner = newOwner;

        emit OwnershipTransferred(tokenId, previousOwner, newOwner, msg.value);
    }

    function getProduct(uint256 tokenId) external view returns (Product memory) {
        require(products[tokenId].exists, "Product does not exist");
        return products[tokenId];
    }

    function getTokenByNfc(string memory nfcUid) external view returns (uint256) {
        return nfcToToken[nfcUid];
    }
}