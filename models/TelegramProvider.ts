import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITelegramProvider extends Document {
  groupId: string;
  groupName: string;
  profileImage: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TelegramProviderSchema: Schema = new Schema(
  {
    groupId: {
      type: String,
      required: true,
      unique: true,
    },
    groupName: {
      type: String,
      required: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const TelegramProvider: Model<ITelegramProvider> = mongoose.models.TelegramProvider || mongoose.model<ITelegramProvider>('TelegramProvider', TelegramProviderSchema);

export default TelegramProvider;
