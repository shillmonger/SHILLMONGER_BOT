import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITPMatrix extends Document {
  min_balance: number;
  max_balance: number;
  tp_level: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TPMatrixSchema: Schema = new Schema(
  {
    min_balance: {
      type: Number,
      required: true,
    },
    max_balance: {
      type: Number,
      required: true,
    },
    tp_level: {
      type: Number,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const TPMatrix: Model<ITPMatrix> = mongoose.models.TPMatrix || mongoose.model<ITPMatrix>('TPMatrix', TPMatrixSchema);

export default TPMatrix;
