import { Router, Request, Response } from "express";
import Product from "../models/Product";

const router = Router();

// POST /api/products - create a new product
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      tokenId,
      name,
      description,
      nfcUid,
      imageUrl,
      cid,
      creatorAddress,
      royaltyBasisPoints,
      materialComposition,
      countryOfOrigin,
      sustainabilityInfo,
      repairabilityInfo,
      recyclabilityInfo,
    } = req.body

    // Check by NFC UID — not tokenId
    const existing = await Product.findOne({ nfcUid })
    if (existing) {
      res.status(409).json({ error: "Product with this NFC UID already exists" })
      return
    }

    const product = new Product({
      tokenId: tokenId ?? null,
      name,
      description,
      nfcUid,
      imageUrl,
      cid,
      creatorAddress: creatorAddress.toLowerCase(),
      royaltyBasisPoints,
      materialComposition: materialComposition || null,
      countryOfOrigin: countryOfOrigin || null,
      sustainabilityInfo: sustainabilityInfo || null,
      repairabilityInfo: repairabilityInfo || null,
      recyclabilityInfo: recyclabilityInfo || null,
    })

    await product.save()
    res.status(201).json(product)
  } catch (error) {
    console.error("Error saving product:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET by NFC UID
router.get("/nfc/:nfcUid", async (req: Request, res: Response) => {
  try {
    const nfcUid = req.params.nfcUid as string
    const product = await Product.findOne({ nfcUid })

    if (!product) {
      res.status(404).json({ error: "Product not found" })
      return
    }

    res.json(product)
  } catch (error) {
    console.error("Error fetching product by NFC:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.patch("/nfc/:nfcUid", async (req: Request, res: Response) => {
  try {
    const { nfcUid } = req.params
    const { tokenId, transactionHash } = req.body

    const product = await Product.findOneAndUpdate(
      { nfcUid },
      { tokenId, transactionHash },
      { new: true }
    )

    if (!product) {
      res.status(404).json({ error: "Product not found" })
      return
    }

    res.json(product)
  } catch (error) {
    console.error("Error updating tokenId:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

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

// GET /api/products/creator/:address - get all products by creator
router.get("/creator/:address", async (req: Request, res: Response) => {
  try {
    const address = (req.params.address as string).toLowerCase()
    const products = await Product.find({ creatorAddress: address })
    res.json(products)
  } catch (error) {
    console.error("Error fetching creator products:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})


export default router;