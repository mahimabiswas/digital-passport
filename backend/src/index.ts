import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db";
import productRoutes from "./routes/products";
import historyRoutes from './routes/history'
import path from 'path'
import uploadRoutes from './routes/upload'
import verifyNfcRoutes from './routes/verifyNfc'

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/products", productRoutes);
app.use("/api/history", historyRoutes);
app.use('/api/upload', uploadRoutes)
app.use('/api/verify-nfc', verifyNfcRoutes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();