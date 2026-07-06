import { Router, Request, Response } from "express";
import Product from "../models/Product";

const router = Router();

// POST /api/products - save product metadata after minting
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      tokenId,
      name,
      description,
      nfcUid,
      imageUrl,
      creatorAddress,
      royaltyBasisPoints,
      minPrice,
    } = req.body;

    // Check if product already exists
    const existing = await Product.findOne({ tokenId });
    if (existing) {
      res.status(409).json({ error: "Product with this tokenId already exists" });
      return;
    }

    const product = new Product({
      tokenId,
      name,
      description,
      nfcUid,
      imageUrl,
      creatorAddress: creatorAddress.toLowerCase(),
      royaltyBasisPoints,
      minPrice,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/products/:tokenId - get product by token ID
router.get("/:tokenId", async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId as string);
    const product = await Product.findOne({ tokenId });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/products/nfc/:nfcUid - get product by NFC UID
router.get("/nfc/:nfcUid", async (req: Request, res: Response) => {
  try {
    const nfcUid = req.params.nfcUid as string;
    const product = await Product.findOne({ nfcUid });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error("Error fetching product by NFC:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;