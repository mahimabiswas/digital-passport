import * as dotenv from "dotenv";
dotenv.config();
import hre from "hardhat";

const CONTRACT_ADDRESS = "0xC7e35CF1074a4d577F0b78bd44FF7E340D7276C8";

async function main() {
  const { ethers } = await import("ethers");

  const privateKey = process.env.SEPOLIA_PRIVATE_KEY!;
  const rpcUrl = process.env.SEPOLIA_RPC_URL!;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifact = await hre.artifacts.readArtifact("DigitalPassport");
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet);

  const tx = await contract.cancelTransfer(0);
  await tx.wait();
  console.log("Transfer cancelled");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});