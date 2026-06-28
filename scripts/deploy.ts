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

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying with account:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH");

  // Deploy verifier first
  console.log("\nDeploying Groth16Verifier...");
  const verifierArtifact = await hre.artifacts.readArtifact("Groth16Verifier");
  const verifierFactory = new ethers.ContractFactory(verifierArtifact.abi, verifierArtifact.bytecode, wallet);
  const verifier = await verifierFactory.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("Groth16Verifier deployed to:", verifierAddress);

  // Deploy passport with verifier address
  console.log("\nDeploying DigitalPassport...");
  const passportArtifact = await hre.artifacts.readArtifact("DigitalPassport");
  const passportFactory = new ethers.ContractFactory(passportArtifact.abi, passportArtifact.bytecode, wallet);
  const passport = await passportFactory.deploy(verifierAddress);
  await passport.waitForDeployment();
  const passportAddress = await passport.getAddress();
  console.log("DigitalPassport deployed to:", passportAddress);

  console.log("\nDone. Save these addresses:");
  console.log("VERIFIER_ADDRESS=", verifierAddress);
  console.log("PASSPORT_ADDRESS=", passportAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});