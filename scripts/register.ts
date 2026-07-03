import * as dotenv from "dotenv";
dotenv.config();
import hre from "hardhat";

const CONTRACT_ADDRESS = "0x368b525374B2eE8493765dfc23013Ec5d2B47508";

async function main() {
  const { ethers } = await import("ethers");

  const privateKey = process.env.SEPOLIA_PRIVATE_KEY!;
  const rpcUrl = process.env.SEPOLIA_RPC_URL!;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifact = await hre.artifacts.readArtifact("DigitalPassport");
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet);

  const tx = await contract.registerProduct(
    "Air Max 1 - Sample 001",
    "Limited run sample, size 9",
    "04A3B2C1D0E9F8",
    500,                              // 5% royalty
    ethers.parseEther("0.1")         // minimum price 0.1 ETH
  );

  console.log("Transaction sent:", tx.hash);
  await tx.wait();
  console.log("Confirmed");

  const product = await contract.getProduct(0);
  const owner = await contract.ownerOf(0);

  console.log("\nProduct registered:");
  console.log("  Token ID:", product.tokenId.toString());
  console.log("  Name:", product.name);
  console.log("  Creator:", product.creator);
  console.log("  Current Owner:", owner);
  console.log("  NFC UID:", product.nfcUid);
  console.log("  Royalty:", product.royaltyBasisPoints.toString(), "basis points");
  console.log("  Min Price:", ethers.formatEther(product.minPrice), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});