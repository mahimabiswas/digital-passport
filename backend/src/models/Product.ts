import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  tokenId: number;
  name: string;
  description: string;
  nfcUid: string;
  imageUrl: string;
  creatorAddress: string;
  royaltyBasisPoints: number;
  minPrice: string;
  createdAt: Date;
}

const ProductSchema: Schema = new Schema(
  {
    tokenId: {
      type: Number,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    nfcUid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    creatorAddress: {
      type: String,
      required: true,
      lowercase: true,
    },
    royaltyBasisPoints: {
      type: Number,
      required: true,
    },
    minPrice: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IProduct>("Product", ProductSchema);