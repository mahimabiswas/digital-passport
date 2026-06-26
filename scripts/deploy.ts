import * as dotenv from "dotenv";
dotenv.config();
import hre from "hardhat";

async function main() {
  const { ethers } = await import("ethers");

  const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
  const rpcUrl = process.env.SEPOLIA_RPC_URL;

  if (!privateKey || !rpcUrl) {
    throw new Error("Missing SEPOLIA_PRIVATE_KEY or SEPOLIA_RPC_URL in .env");
  }

  console.log("Private key loaded, length:", privateKey.length);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying with account:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const artifact = await hre.artifacts.readArtifact("DigitalPassport");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  const passport = await factory.deploy();
  await passport.waitForDeployment();

  const address = await passport.getAddress();
  console.log("DigitalPassport deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});