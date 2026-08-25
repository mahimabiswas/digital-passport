// @ts-nocheck
import { expect } from "chai";
import { parseEther } from "ethers";
import hre from "hardhat";

const { ethers, networkHelpers } = await hre.network.create();

describe("DigitalPassport", function () {

    // ─── Fixtures ─────────────────────────────────────────────────

    async function deployFixture() {
        const [creator, buyer, previousOwner, other] = await ethers.getSigners();
        const contract = await ethers.deployContract("DigitalPassport");
        return { contract, creator, buyer, previousOwner, other };
    }

    async function registerProductFixture() {
        const base = await networkHelpers.loadFixture(deployFixture);
        const { contract, creator } = base;
        await contract.connect(creator).registerProduct(
            "Test Product", "Test Description", "04TESTUID001", 500n, "ipfs://testCID"
        );
        return { ...base, tokenId: 0n };
    }

    // After: buyer owns token, creator is previousOwner
    async function secondarySaleFixture() {
        const base = await networkHelpers.loadFixture(registerProductFixture);
        const { contract, creator, buyer } = base;
        await contract.connect(creator).initiateTransfer(0n, buyer.address, 0n, parseEther("1"));
        await contract.connect(buyer).confirmReceipt(0n);
        return { ...base, tokenId: 0n };
    }

    // After: other owns token, buyer is previousOwner
    async function thirdSaleFixture() {
        const base = await networkHelpers.loadFixture(secondarySaleFixture);
        const { contract, buyer, other } = base;
        const royalty = parseEther("0.05");
        await contract.connect(buyer).initiateTransfer(0n, other.address, royalty, parseEther("1"));
        await contract.connect(other).depositEscrow(0n, { value: royalty });
        await contract.connect(other).confirmReceipt(0n);
        return { ...base, tokenId: 0n };
    }

    // ─── registerProduct ──────────────────────────────────────────

    describe("registerProduct", function () {
        it("registers a product with correct fields", async function () {
            const { contract, creator } = await networkHelpers.loadFixture(deployFixture);
            await contract.connect(creator).registerProduct(
                "Samba OG", "Size 7", "04ABCD1234", 500n, "ipfs://testCID"
            );
            const product = await contract.getProduct(0n);
            expect(product.productName).to.equal("Samba OG");
            expect(product.creator.toLowerCase()).to.equal(creator.address.toLowerCase());
            expect(product.royaltyBasisPoints).to.equal(500n);
            expect(product.nfcUid).to.equal("04ABCD1234");
            expect(product.exists).to.be.true;
        });

        it("sets tokenURI correctly", async function () {
            const { contract, creator } = await networkHelpers.loadFixture(deployFixture);
            await contract.connect(creator).registerProduct(
                "Test", "Desc", "04UID001", 500n, "ipfs://QmTestCID"
            );
            const uri = await contract.tokenURI(0n);
            expect(uri).to.equal("ipfs://QmTestCID");
        });

        it("maps NFC UID to tokenId", async function () {
            const { contract, creator } = await networkHelpers.loadFixture(deployFixture);
            await contract.connect(creator).registerProduct(
                "Test", "Desc", "04UID002", 500n, "ipfs://testCID"
            );
            const tokenId = await contract.getTokenByNfc("04UID002");
            expect(tokenId).to.equal(0n);
        });

        it("fails if royalty exceeds 1000 basis points", async function () {
            const { contract, creator } = await networkHelpers.loadFixture(deployFixture);
            await expect(
                contract.connect(creator).registerProduct(
                    "Test", "Desc", "04UID003", 1001n, "ipfs://testCID"
                )
            ).to.be.revertedWith("Royalty cannot exceed 10%");
        });

        it("fails if NFC UID is empty", async function () {
            const { contract, creator } = await networkHelpers.loadFixture(deployFixture);
            await expect(
                contract.connect(creator).registerProduct(
                    "Test", "Desc", "", 500n, "ipfs://testCID"
                )
            ).to.be.revertedWith("NFC UID required");
        });

        it("emits ProductRegistered event", async function () {
            const { contract, creator } = await networkHelpers.loadFixture(deployFixture);
            await expect(
                contract.connect(creator).registerProduct(
                    "Test", "Desc", "04UID004", 500n, "ipfs://testCID"
                )
            ).to.emit(contract, "ProductRegistered");
        });
    });

    // ─── initiateTransfer ─────────────────────────────────────────

    describe("initiateTransfer", function () {
        it("seller can initiate primary sale transfer", async function () {
            const { contract, creator, buyer, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await contract.connect(creator).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"));
            const pending = await contract.getPendingTransfer(tokenId);
            expect(pending.active).to.be.true;
            expect(pending.buyer.toLowerCase()).to.equal(buyer.address.toLowerCase());
        });

        it("fails if caller is not token owner", async function () {
            const { contract, buyer, other, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await expect(
                contract.connect(other).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"))
            ).to.be.revertedWith("Not token owner");
        });

        it("fails if transfer already pending", async function () {
            const { contract, creator, buyer, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await contract.connect(creator).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"));
            await expect(
                contract.connect(creator).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"))
            ).to.be.revertedWith("Transfer already pending");
        });

        it("primary sale fails if royaltyAmount > 0", async function () {
            const { contract, creator, buyer, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await expect(
                contract.connect(creator).initiateTransfer(tokenId, buyer.address, parseEther("0.05"), parseEther("1"))
            ).to.be.revertedWith("No royalty on primary sale");
        });

        it("secondary sale fails if royalty below required amount", async function () {
            const { contract, buyer, creator, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            await expect(
                contract.connect(buyer).initiateTransfer(tokenId, creator.address, parseEther("0.01"), parseEther("1"))
            ).to.be.revertedWith("Royalty below required amount");
        });

        it("secondary sale fails if royaltyAmount is 0", async function () {
            const { contract, buyer, creator, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            await expect(
                contract.connect(buyer).initiateTransfer(tokenId, creator.address, 0n, parseEther("1"))
            ).to.be.revertedWith("Royalty required for secondary sale");
        });
    });

    // ─── depositEscrow ────────────────────────────────────────────

    describe("depositEscrow", function () {
        it("buyer can deposit correct escrow amount", async function () {
            const { contract, buyer, creator, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, creator.address, royalty, parseEther("1"));
            await contract.connect(creator).depositEscrow(tokenId, { value: royalty });
            const pending = await contract.getPendingTransfer(tokenId);
            expect(pending.escrowDeposited).to.be.true;
        });

        it("fails if caller is not designated buyer", async function () {
            const { contract, buyer, creator, other, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, creator.address, royalty, parseEther("1"));
            await expect(
                contract.connect(other).depositEscrow(tokenId, { value: royalty })
            ).to.be.revertedWith("Not the designated buyer");
        });

        it("fails if insufficient ETH sent", async function () {
            const { contract, buyer, creator, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, creator.address, royalty, parseEther("1"));
            await expect(
                contract.connect(creator).depositEscrow(tokenId, { value: parseEther("0.01") })
            ).to.be.revertedWith("Insufficient escrow amount");
        });

        it("fails for primary sale", async function () {
            const { contract, creator, buyer, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await contract.connect(creator).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"));
            await expect(
                contract.connect(buyer).depositEscrow(tokenId, { value: parseEther("0.05") })
            ).to.be.revertedWith("No escrow required for primary sale");
        });

        it("fails if escrow already deposited", async function () {
            const { contract, buyer, creator, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, creator.address, royalty, parseEther("1"));
            await contract.connect(creator).depositEscrow(tokenId, { value: royalty });
            await expect(
                contract.connect(creator).depositEscrow(tokenId, { value: royalty })
            ).to.be.revertedWith("Escrow already deposited");
        });
    });

    // ─── confirmReceipt ───────────────────────────────────────────

    describe("confirmReceipt", function () {
        it("primary sale: transfers NFT without escrow", async function () {
            const { contract, creator, buyer, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await contract.connect(creator).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"));
            await contract.connect(buyer).confirmReceipt(tokenId);
            const owner = await contract.ownerOf(tokenId);
            expect(owner.toLowerCase()).to.equal(buyer.address.toLowerCase());
        });

        it("fails if caller is not designated buyer", async function () {
            const { contract, creator, buyer, other, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await contract.connect(creator).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"));
            await expect(
                contract.connect(other).confirmReceipt(tokenId)
            ).to.be.revertedWith("Not the designated buyer");
        });

        it("secondary sale: fails if escrow not deposited", async function () {
            const { contract, buyer, creator, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, creator.address, royalty, parseEther("1"));
            await expect(
                contract.connect(creator).confirmReceipt(tokenId)
            ).to.be.revertedWith("Escrow not deposited yet");
        });

        it("royalty invariant: creator receives royalty on secondary sale", async function () {
            const { contract, creator, buyer, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, creator.address, royalty, parseEther("1"));
            await contract.connect(creator).depositEscrow(tokenId, { value: royalty });
            const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);
            await contract.connect(creator).confirmReceipt(tokenId);
            const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);
            expect(creatorBalanceAfter).to.be.greaterThan(creatorBalanceBefore);
        });
        // it("holding-period-based: exactly 7 days gets 10% not 0%", async function () {
        //     const { contract, creator, buyer, other } = await networkHelpers.loadFixture(thirdSaleFixture);
        //     await networkHelpers.time.increase(7 * 24 * 60 * 60); // exactly 7 days
        //     const royalty = parseEther("0.05");
        //     await contract.connect(other).initiateTransfer(0n, creator.address, royalty, parseEther("1"));
        //     await contract.connect(creator).depositEscrow(0n, { value: royalty });
        //     const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
        //     await contract.connect(creator).confirmReceipt(0n);
        //     const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
        //     const expectedShare = royalty * 1000n / 10000n;
        //     expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(expectedShare);
        // });
        it("holding-period-based: holder < 7 days gets 0% previous owner share", async function () {
            const { contract, buyer, other, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, other.address, royalty, parseEther("1"));
            await contract.connect(other).depositEscrow(tokenId, { value: royalty });
            const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
            await contract.connect(other).confirmReceipt(tokenId);
            const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
            expect(buyerBalanceAfter).to.equal(buyerBalanceBefore);
        });

        it("holding-period-based: holder >= 7 and holder < 180 days gets 10% previous owner share", async function () {
            const { contract, creator, buyer, other } = await networkHelpers.loadFixture(thirdSaleFixture);
            await networkHelpers.time.increase(8 * 24 * 60 * 60);
            const royalty = parseEther("0.05");
            await contract.connect(other).initiateTransfer(0n, creator.address, royalty, parseEther("1"));
            await contract.connect(creator).depositEscrow(0n, { value: royalty });
            const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
            await contract.connect(creator).confirmReceipt(0n);
            const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
            const expectedShare = royalty * 1000n / 10000n;
            expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(expectedShare);
        });

        it("holding-period-based: holder >= 180 and holder < 365 days gets 20% previous owner share", async function () {
            const { contract, creator, buyer, other } = await networkHelpers.loadFixture(thirdSaleFixture);
            await networkHelpers.time.increase(181 * 24 * 60 * 60);
            const royalty = parseEther("0.05");
            await contract.connect(other).initiateTransfer(0n, creator.address, royalty, parseEther("1"));
            await contract.connect(creator).depositEscrow(0n, { value: royalty });
            const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
            await contract.connect(creator).confirmReceipt(0n);
            const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
            const expectedShare = royalty * 2000n / 10000n;
            expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(expectedShare);
        });

        it("holding-period-based: holder >= 365 days gets 30% previous owner share", async function () {
            const { contract, creator, buyer, other } = await networkHelpers.loadFixture(thirdSaleFixture);
            await networkHelpers.time.increase(366 * 24 * 60 * 60);
            const royalty = parseEther("0.05");
            await contract.connect(other).initiateTransfer(0n, creator.address, royalty, parseEther("1"));
            await contract.connect(creator).depositEscrow(0n, { value: royalty });
            const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
            await contract.connect(creator).confirmReceipt(0n);
            const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
            const expectedShare = royalty * 3000n / 10000n;
            expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(expectedShare);
        });

        it("royalty split: creator gets 90% when previous owner held 7-180 days", async function () {
            const { contract, creator, buyer, other } = await networkHelpers.loadFixture(thirdSaleFixture);
            await networkHelpers.time.increase(8 * 24 * 60 * 60);
            const royalty = parseEther("0.05");
            await contract.connect(other).initiateTransfer(0n, creator.address, royalty, parseEther("1"));
            await contract.connect(creator).depositEscrow(0n, { value: royalty });
            const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);
            await contract.connect(creator).confirmReceipt(0n);
            const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);
            const expectedCreatorShare = royalty * 9000n / 10000n;
            // Creator pays gas so use gte with small tolerance
            expect(creatorBalanceAfter - creatorBalanceBefore).to.be.gte(expectedCreatorShare - parseEther("0.001"));
        });

        it("escrow atomicity: NFT does not transfer without escrow deposit", async function () {
            const { contract, buyer, creator, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, creator.address, royalty, parseEther("1"));
            await expect(
                contract.connect(creator).confirmReceipt(tokenId)
            ).to.be.revertedWith("Escrow not deposited yet");
            const owner = await contract.ownerOf(tokenId);
            expect(owner.toLowerCase()).to.equal(buyer.address.toLowerCase());
        });

        it("emits OwnershipTransferred event", async function () {
            const { contract, creator, buyer, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await contract.connect(creator).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"));
            await expect(
                contract.connect(buyer).confirmReceipt(tokenId)
            ).to.emit(contract, "OwnershipTransferred");
        });
    });

    // ─── cancelTransfer ───────────────────────────────────────────

    describe("cancelTransfer", function () {
        it("seller can cancel before escrow deposited", async function () {
            const { contract, creator, buyer, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await contract.connect(creator).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"));
            await contract.connect(creator).cancelTransfer(tokenId);
            const pending = await contract.getPendingTransfer(tokenId);
            expect(pending.active).to.be.false;
        });

        it("buyer gets refund on cancel after escrow deposited", async function () {
            const { contract, buyer, creator, other, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, other.address, royalty, parseEther("1"));
            await contract.connect(other).depositEscrow(tokenId, { value: royalty });
            const otherBalanceBefore = await ethers.provider.getBalance(other.address);
            await contract.connect(other).cancelTransfer(tokenId);
            const otherBalanceAfter = await ethers.provider.getBalance(other.address);
            expect(otherBalanceAfter).to.be.greaterThan(otherBalanceBefore);
        });

        it("fails if no pending transfer", async function () {
            const { contract, creator, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await expect(
                contract.connect(creator).cancelTransfer(tokenId)
            ).to.be.revertedWith("No pending transfer");
        });

        it("fails if unauthorised caller", async function () {
            const { contract, creator, buyer, other, tokenId } = await networkHelpers.loadFixture(registerProductFixture);
            await contract.connect(creator).initiateTransfer(tokenId, buyer.address, 0n, parseEther("1"));
            await expect(
                contract.connect(other).cancelTransfer(tokenId)
            ).to.be.revertedWith("Not authorised to cancel");
        });

        it("anyone can cancel after 14 days", async function () {
            const { contract, buyer, creator, other, tokenId } = await networkHelpers.loadFixture(secondarySaleFixture);
            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(tokenId, other.address, royalty, parseEther("1"));
            await contract.connect(other).depositEscrow(tokenId, { value: royalty });
            await networkHelpers.time.increase(15 * 24 * 60 * 60);
            await contract.connect(creator).cancelTransfer(tokenId);
            const pending = await contract.getPendingTransfer(tokenId);
            expect(pending.active).to.be.false;
        });
    });
});