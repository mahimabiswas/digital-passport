import * as dotenv from "dotenv";
dotenv.config();
import hre from "hardhat";

const CONTRACT_ADDRESS = "0x9e19FF549Da5F78bC3fA0aE10f5ff0c91d28cBbb";

async function main() {
  const { ethers } = await import("ethers");

  const privateKey = process.env.SEPOLIA_PRIVATE_KEY!;
  const rpcUrl = process.env.SEPOLIA_RPC_URL!;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifact = await hre.artifacts.readArtifact("DigitalPassport");
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet);

  // Register a test product
  const tx = await contract.registerProduct(
    "Air Max 1 - Sample 001",          // name
    "Limited run sample, size 9",       // description
    "04A3B2C1D0E9F8",                   // NFC UID (your NTAG215 uid goes here later)
    ethers.parseEther("0.01")           // royalty: 0.01 ETH per transfer
  );

  console.log("Transaction sent:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);

  // Read it back
  const product = await contract.getProduct(0);
  console.log("\nProduct registered:");
  console.log("  Token ID:", product.tokenId.toString());
  console.log("  Name:", product.name);
  console.log("  Creator:", product.creator);
  console.log("  Owner:", product.currentOwner);
  console.log("  NFC UID:", product.nfcUid);
  console.log("  Royalty:", ethers.formatEther(product.royaltyAmount), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});