import * as dotenv from "dotenv";
dotenv.config();
import hre from "hardhat";

async function main() {
    const { ethers } = await import("ethers");
    
    const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    
    if (!privateKey || !rpcUrl) throw new Error("Missing env vars");
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const artifact = await hre.artifacts.readArtifact("DigitalPassport");
    const contract = new ethers.Contract(
        "0x66387E6EBBa3597652c14E2D643C685CAD80D693",
        artifact.abi,
        wallet
    );
    
    // Test registerProduct with imageURI
    console.log("Registering product...");
    const tx = await contract.registerProduct(
        "Test Product",
        "Test Description", 
        "04TESTUID001",
        500, // 5% royalty
        "ipfs://bafkreic4hqynip5r4aisbbhavlytjyrszybf6svw6kahxmxzp22jk33l6q"
    );
    const receipt = await tx.wait();
    console.log("Transaction hash:", receipt.hash);
    
    // Read tokenURI
    const tokenId = 0n;
    const uri = await contract.tokenURI(tokenId);
    console.log("Token URI:", uri);
    
    // Read product
    const product = await contract.getProduct(tokenId);
    console.log("Product name:", product.productName);
    console.log("Creator:", product.creator);
}

main().catch(console.error);