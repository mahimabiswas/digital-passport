import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
    tokenId: number;
    name: string;
    description: string;
    nfcUid: string;
    imageUrl: string;
    cid: string;
    creatorAddress: string;
    royaltyBasisPoints: number;
    transactionHash: string;
    createdAt: Date;
    materialComposition?: string;
    countryOfOrigin?: string;
    sustainabilityInfo?: string;
    repairabilityInfo?: string;
    recyclabilityInfo?: string;
}

const ProductSchema: Schema = new Schema(
    {
        tokenId: { type: Number, required: false, default: null, sparse: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        nfcUid: { type: String, required: true, unique: true, trim: true },
        imageUrl: { type: String, default: "" },
        cid: { type: String, default: null },
        creatorAddress: { type: String, required: true, lowercase: true },
        royaltyBasisPoints: { type: Number, required: true },
        transactionHash: { type: String, default: null },
        materialComposition: { type: String, default: null },
        countryOfOrigin: { type: String, default: null },
        sustainabilityInfo: { type: String, default: null },
        repairabilityInfo: { type: String, default: null },
        recyclabilityInfo: { type: String, default: null },
    },
    { timestamps: true }
);

export default mongoose.model<IProduct>("Product", ProductSchema);