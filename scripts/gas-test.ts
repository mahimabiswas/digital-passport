import * as dotenv from "dotenv";
dotenv.config();
import hre from "hardhat";
import * as snarkjs from "snarkjs";

const CONTRACT_ADDRESS = "0x368b525374B2eE8493765dfc23013Ec5d2B47508";

async function main() {
  const { ethers } = await import("ethers");

  const privateKey = process.env.SEPOLIA_PRIVATE_KEY!;
  const rpcUrl = process.env.SEPOLIA_RPC_URL!;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifact = await hre.artifacts.readArtifact("DigitalPassport");
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet);

  const TOKEN_ID = 0;
  const SALE_PRICE = ethers.parseEther("0.2");
  const ROYALTY_BASIS_POINTS = 500n;
  const MIN_PRICE = ethers.parseEther("0.1");
  const ROYALTY_DUE = (SALE_PRICE * ROYALTY_BASIS_POINTS) / 10000n;

  // GAS TEST 1: registerProduct 
  console.log("=== GAS MEASUREMENTS ===\n");
  const registerGas = await contract.registerProduct.estimateGas(
    "Gas Test Product",
    "Description",
    "04GASTEST001",
    500,
    ethers.parseEther("0.1")
  );
  console.log("registerProduct gas:", registerGas.toString());

  // GAS TEST 2: initiateTransfer 
  // Need a registered product first - use token 0 which exists
  // Cancel any pending transfer first
  try {
    const cancelTx = await contract.cancelTransfer(TOKEN_ID);
    await cancelTx.wait();
    console.log("Cancelled existing pending transfer");
  } catch (e) {
    // No pending transfer, that's fine
  }

    const initiateGas = await contract.initiateTransfer.estimateGas(
        TOKEN_ID,
        wallet.address,
        SALE_PRICE
    );
  console.log("initiateTransfer gas:", initiateGas.toString());

  //  initiate to test completeTransfer
  const initTx = await contract.initiateTransfer(TOKEN_ID, wallet.address, SALE_PRICE);
  await initTx.wait();

  // GAS TEST 3: completeTransfer WITH ZKP 
  console.log("\nGenerating ZKP proof...");
  const input = {
    price: SALE_PRICE.toString(),
    minPrice: MIN_PRICE.toString(),
    royaltyAmount: ROYALTY_DUE.toString(),
    basisPoints: ROYALTY_BASIS_POINTS.toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    "circuits/RoyaltyProof_js/RoyaltyProof.wasm",
    "circuits/royalty_0001.zkey"
  );

  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const calldataJson = JSON.parse("[" + calldata + "]");
  const pA = calldataJson[0];
  const pB = calldataJson[1];
  const pC = calldataJson[2];
  const pubSignals = calldataJson[3];

  const completeWithZKPGas = await contract.completeTransfer.estimateGas(
    TOKEN_ID,
    pA, pB, pC, pubSignals,
    { value: ROYALTY_DUE }
  );
  console.log("completeTransfer WITH ZKP gas:", completeWithZKPGas.toString());

  console.log("\n=== SUMMARY ===");
  console.log("registerProduct:            ", registerGas.toString(), "gas");
  console.log("initiateTransfer:           ", initiateGas.toString(), "gas");
  console.log("completeTransfer (with ZKP):", completeWithZKPGas.toString(), "gas");
  console.log("\nFor context:");
  console.log("Simple ETH transfer:         21,000 gas");
  console.log("ERC-721 transfer (no ZKP):  ~65,000 gas");
  console.log("Groth16 verification cost:  ~200,000-250,000 gas (estimated overhead)");

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});