// @ts-nocheck
import { expect } from "chai";
import { parseEther, ethers as ethersLib } from "ethers";
import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";

const ethers = (hre as any).ethers ?? ethersLib;
describe("DigitalPassport", function () {
    async function deployFixture() {
        const [creator, buyer, previousOwner, other] = await ethers.getSigners();
        const Contract = await ethers.getContractFactory("DigitalPassport");
        const contract = await Contract.deploy();
        await contract.waitForDeployment();
        return { contract, creator, buyer, previousOwner, other };
    }

    async function registerProductFixture() {
        const base = await deployFixture();
        const { contract, creator } = base;

        await contract.connect(creator).registerProduct(
            "Test Product", "Test Description", "04TESTUID001", 500n, "ipfs://testCID"
        );

        return { ...base, tokenId: 0n };
    }

    async function secondarySaleFixture() {
        const base = await registerProductFixture();
        const { contract, creator, buyer } = base;

        // Primary sale — transfer to buyer
        await contract.connect(creator).initiateTransfer(
            0n, buyer.address, 0n, parseEther("1")
        );
        await contract.connect(buyer).confirmReceipt(0n);

        return { ...base, tokenId: 0n };
    }

    // ─── registerProduct ───────────────────────────────────────────

    describe("registerProduct", function () {
        it("registers a product with correct fields", async function () {
            const { contract, creator } = await deployFixture();

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
            const { contract, creator } = await deployFixture();

            await contract.connect(creator).registerProduct(
                "Test", "Desc", "04UID001", 500n, "ipfs://QmTestCID"
            );

            const uri = await contract.tokenURI(0n);
            expect(uri).to.equal("ipfs://QmTestCID");
        });

        it("maps NFC UID to tokenId", async function () {
            const { contract, creator } = await deployFixture();

            await contract.connect(creator).registerProduct(
                "Test", "Desc", "04UID002", 500n, "ipfs://testCID"
            );

            const tokenId = await contract.getTokenByNfc("04UID002");
            expect(tokenId).to.equal(0n);
        });

        it("fails if royalty exceeds 1000 basis points", async function () {
            const { contract, creator } = await deployFixture();

            await expect(
                contract.connect(creator).registerProduct(
                    "Test", "Desc", "04UID003", 1001n, "ipfs://testCID"
                )
            ).to.be.revertedWith("Royalty cannot exceed 10%");
        });

        it("fails if NFC UID is empty", async function () {
            const { contract, creator } = await deployFixture();

            await expect(
                contract.connect(creator).registerProduct(
                    "Test", "Desc", "", 500n, "ipfs://testCID"
                )
            ).to.be.revertedWith("NFC UID required");
        });

        it("emits ProductRegistered event", async function () {
            const { contract, creator } = await deployFixture();

            await expect(
                contract.connect(creator).registerProduct(
                    "Test", "Desc", "04UID004", 500n, "ipfs://testCID"
                )
            ).to.emit(contract, "ProductRegistered");
        });
    });

    // ─── initiateTransfer ──────────────────────────────────────────

    describe("initiateTransfer", function () {
        it("seller can initiate primary sale transfer", async function () {
            const { contract, creator, buyer, tokenId } = await registerProductFixture();

            await contract.connect(creator).initiateTransfer(
                tokenId, buyer.address, 0n, parseEther("1")
            );

            const pending = await contract.getPendingTransfer(tokenId);
            expect(pending.active).to.be.true;
            expect(pending.buyer.toLowerCase()).to.equal(buyer.address.toLowerCase());
        });

        it("fails if caller is not token owner", async function () {
            const { contract, buyer, other, tokenId } = await registerProductFixture();

            await expect(
                contract.connect(other).initiateTransfer(
                    tokenId, buyer.address, 0n, parseEther("1")
                )
            ).to.be.revertedWith("Not token owner");
        });

        it("fails if transfer already pending", async function () {
            const { contract, creator, buyer, tokenId } = await registerProductFixture();

            await contract.connect(creator).initiateTransfer(
                tokenId, buyer.address, 0n, parseEther("1")
            );

            await expect(
                contract.connect(creator).initiateTransfer(
                    tokenId, buyer.address, 0n, parseEther("1")
                )
            ).to.be.revertedWith("Transfer already pending");
        });

        it("primary sale fails if royaltyAmount > 0", async function () {
            const { contract, creator, buyer, tokenId } = await registerProductFixture();

            await expect(
                contract.connect(creator).initiateTransfer(
                    tokenId, buyer.address, parseEther("0.05"), parseEther("1")
                )
            ).to.be.revertedWith("No royalty on primary sale");
        });

        it("secondary sale fails if royalty below required amount", async function () {
            const { contract, creator, buyer, tokenId } = await secondarySaleFixture();

            await expect(
                contract.connect(buyer).initiateTransfer(
                    tokenId, creator.address, parseEther("0.01"), parseEther("1")
                )
            ).to.be.revertedWith("Royalty below required amount");
        });

        it("secondary sale fails if royaltyAmount is 0", async function () {
            const { contract, buyer, creator, tokenId } = await secondarySaleFixture();

            await expect(
                contract.connect(buyer).initiateTransfer(
                    tokenId, creator.address, 0n, parseEther("1")
                )
            ).to.be.revertedWith("Royalty required for secondary sale");
        });
    });

    // ─── depositEscrow ─────────────────────────────────────────────

    describe("depositEscrow", function () {
        it("buyer can deposit correct escrow amount", async function () {
            const { contract, creator, buyer, tokenId } = await secondarySaleFixture();

            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(
                tokenId, creator.address, royalty, parseEther("1")
            );

            await contract.connect(creator).depositEscrow(tokenId, { value: royalty });

            const pending = await contract.getPendingTransfer(tokenId);
            expect(pending.escrowDeposited).to.be.true;
        });

        it("fails if caller is not designated buyer", async function () {
            const { contract, creator, buyer, other, tokenId } = await secondarySaleFixture();

            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(
                tokenId, creator.address, royalty, parseEther("1")
            );

            await expect(
                contract.connect(other).depositEscrow(tokenId, { value: royalty })
            ).to.be.revertedWith("Not the designated buyer");
        });

        it("fails if insufficient ETH sent", async function () {
            const { contract, creator, buyer, tokenId } = await secondarySaleFixture();

            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(
                tokenId, creator.address, royalty, parseEther("1")
            );

            await expect(
                contract.connect(creator).depositEscrow(tokenId, { value: parseEther("0.01") })
            ).to.be.revertedWith("Insufficient escrow amount");
        });

        it("fails for primary sale", async function () {
            const { contract, creator, buyer, tokenId } = await registerProductFixture();

            await contract.connect(creator).initiateTransfer(
                tokenId, buyer.address, 0n, parseEther("1")
            );

            await expect(
                contract.connect(buyer).depositEscrow(tokenId, { value: parseEther("0.05") })
            ).to.be.revertedWith("No escrow required for primary sale");
        });
    });

    // ─── confirmReceipt ────────────────────────────────────────────

    describe("confirmReceipt", function () {
        it("primary sale: transfers NFT without escrow", async function () {
            const { contract, creator, buyer, tokenId } = await registerProductFixture();

            await contract.connect(creator).initiateTransfer(
                tokenId, buyer.address, 0n, parseEther("1")
            );
            await contract.connect(buyer).confirmReceipt(tokenId);

            const owner = await contract.ownerOf(tokenId);
            expect(owner.toLowerCase()).to.equal(buyer.address.toLowerCase());
        });

        it("fails if caller is not designated buyer", async function () {
            const { contract, creator, buyer, other, tokenId } = await registerProductFixture();

            await contract.connect(creator).initiateTransfer(
                tokenId, buyer.address, 0n, parseEther("1")
            );

            await expect(
                contract.connect(other).confirmReceipt(tokenId)
            ).to.be.revertedWith("Not the designated buyer");
        });

        it("secondary sale: fails if escrow not deposited", async function () {
            const { contract, buyer, creator, tokenId } = await secondarySaleFixture();

            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(
                tokenId, creator.address, royalty, parseEther("1")
            );

            await expect(
                contract.connect(creator).confirmReceipt(tokenId)
            ).to.be.revertedWith("Escrow not deposited yet");
        });

        it("royalty invariant: creator receives royalty on secondary sale", async function () {
            const { contract, creator, buyer, tokenId } = await secondarySaleFixture();

            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(
                tokenId, creator.address, royalty, parseEther("1")
            );
            await contract.connect(creator).depositEscrow(tokenId, { value: royalty });

            const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);
            await contract.connect(creator).confirmReceipt(tokenId);
            const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);

            expect(creatorBalanceAfter).to.be.greaterThan(creatorBalanceBefore);
        });

        it("time-weighted: holder < 7 days gets 0% previous owner share", async function () {
            const { contract, creator, buyer, other, tokenId } = await secondarySaleFixture();

            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(
                tokenId, other.address, royalty, parseEther("1")
            );
            await contract.connect(other).depositEscrow(tokenId, { value: royalty });

            const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
            await contract.connect(other).confirmReceipt(tokenId);
            const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);

            // Buyer held < 7 days — should receive 0
            expect(buyerBalanceAfter).to.equal(buyerBalanceBefore);
        });

        it("emits OwnershipTransferred event", async function () {
            const { contract, creator, buyer, tokenId } = await registerProductFixture();

            await contract.connect(creator).initiateTransfer(
                tokenId, buyer.address, 0n, parseEther("1")
            );

            await expect(
                contract.connect(buyer).confirmReceipt(tokenId)
            ).to.emit(contract, "OwnershipTransferred");
        });
    });

    // ─── cancelTransfer ────────────────────────────────────────────

    describe("cancelTransfer", function () {
        it("seller can cancel before escrow deposited", async function () {
            const { contract, creator, buyer, tokenId } = await registerProductFixture();

            await contract.connect(creator).initiateTransfer(
                tokenId, buyer.address, 0n, parseEther("1")
            );
            await contract.connect(creator).cancelTransfer(tokenId);

            const pending = await contract.getPendingTransfer(tokenId);
            expect(pending.active).to.be.false;
        });

        it("buyer gets refund on cancel after escrow deposited", async function () {
            const { contract, creator, buyer, other, tokenId } = await secondarySaleFixture();

            const royalty = parseEther("0.05");
            await contract.connect(buyer).initiateTransfer(
                tokenId, other.address, royalty, parseEther("1")
            );
            await contract.connect(other).depositEscrow(tokenId, { value: royalty });

            const otherBalanceBefore = await ethers.provider.getBalance(other.address);
            await contract.connect(other).cancelTransfer(tokenId);
            const otherBalanceAfter = await ethers.provider.getBalance(other.address);

            expect(otherBalanceAfter).to.be.greaterThan(otherBalanceBefore);
        });

        it("fails if no pending transfer", async function () {
            const { contract, creator, tokenId } = await registerProductFixture();

            await expect(
                contract.connect(creator).cancelTransfer(tokenId)
            ).to.be.revertedWith("No pending transfer");
        });

        it("fails if unauthorised caller", async function () {
            const { contract, creator, buyer, other, tokenId } = await registerProductFixture();

            await contract.connect(creator).initiateTransfer(
                tokenId, buyer.address, 0n, parseEther("1")
            );

            await expect(
                contract.connect(other).cancelTransfer(tokenId)
            ).to.be.revertedWith("Not authorised to cancel");
        });
    });
});