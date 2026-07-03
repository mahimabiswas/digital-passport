import * as dotenv from "dotenv";
dotenv.config();
import hre from "hardhat";
import * as snarkjs from "snarkjs";
// import * as path from "path";

const CONTRACT_ADDRESS = "0x368b525374B2eE8493765dfc23013Ec5d2B47508";

async function main() {
  const { ethers } = await import("ethers");

  const privateKey = process.env.SEPOLIA_PRIVATE_KEY!;
  const rpcUrl = process.env.SEPOLIA_RPC_URL!;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const seller = new ethers.Wallet(privateKey, provider);

  // For testing, buyer is a different wallet
  // In real usage buyer would be a different person
//   const buyerPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Hardhat test account, fine for Sepolia testing
//   const buyer = new ethers.Wallet(buyerPrivateKey, provider);
  const buyer = new ethers.Wallet(privateKey, provider);
  const artifact = await hre.artifacts.readArtifact("DigitalPassport");
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, seller);

  const TOKEN_ID = 0;
  const SALE_PRICE = ethers.parseEther("0.2");    // 0.2 ETH sale price
  const ROYALTY_BASIS_POINTS = 500n;               // 5%
  const MIN_PRICE = ethers.parseEther("0.1");      // 0.1 ETH minimum

  // Royalty = 0.2 ETH * 500 / 10000 = 0.01 ETH
  const ROYALTY_DUE = (SALE_PRICE * ROYALTY_BASIS_POINTS) / 10000n;

  console.log("Sale price:", ethers.formatEther(SALE_PRICE), "ETH");
  console.log("Royalty due:", ethers.formatEther(ROYALTY_DUE), "ETH");
  console.log("Buyer address:", buyer.address);

  // Step 1 - Initiate transfer
  console.log("\nStep 1: Initiating transfer...");
//   const initTx = await contract.initiateTransfer(TOKEN_ID, buyer.address, SALE_PRICE);
  const initTx = await contract.initiateTransfer(TOKEN_ID, seller.address, SALE_PRICE);
  await initTx.wait();
  console.log("Transfer initiated");

  // Step 2 - Generate ZKP proof
  console.log("\nStep 2: Generating ZKP proof...");

  const input = {
    price: SALE_PRICE.toString(),
    minPrice: MIN_PRICE.toString(),
    royaltyAmount: ROYALTY_DUE.toString(),
    basisPoints: ROYALTY_BASIS_POINTS.toString(),
  };

  console.log("Circuit inputs:", input);

    const wasmPath = "circuits/RoyaltyProof_js/RoyaltyProof.wasm";
    const zkeyPath = "circuits/royalty_0001.zkey";

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

  console.log("Proof generated successfully");
  console.log("Public signals:", publicSignals);

  // Format proof for Solidity
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const calldataJson = JSON.parse("[" + calldata + "]");

  const pA = calldataJson[0];
  const pB = calldataJson[1];
  const pC = calldataJson[2];
  const pubSignals = calldataJson[3];

  console.log("\nFormatted for contract call:");
  console.log("pA:", pA);
  console.log("pB:", pB);
  console.log("pC:", pC);
  console.log("pubSignals:", pubSignals);

  // Step 3 - Complete transfer as buyer
  console.log("\nStep 3: Completing transfer with proof...");
  const buyerContract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, buyer);

  const completeTx = await buyerContract.completeTransfer(
    TOKEN_ID,
    pA,
    pB,
    pC,
    pubSignals,
    { value: ROYALTY_DUE }
  );

  await completeTx.wait();
  console.log("Transfer complete!");

  // Verify new owner
  const newOwner = await contract.ownerOf(TOKEN_ID);
  console.log("\nNew owner:", newOwner);
  console.log("Expected:", buyer.address);
  console.log("Match:", newOwner.toLowerCase() === buyer.address.toLowerCase());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

process.exit(0);