import mongoose, { Schema } from 'mongoose';

export type FavoriteCity = {
  query: string;
  label?: string;
  addedAt: Date;
};

export type UserDoc = {
  name?: string;
  email: string;
  passwordHash?: string;
  favorites: FavoriteCity[];
};

const FavoriteCitySchema = new Schema<FavoriteCity>({
  query: { type: String, required: true },
  label: { type: String },
  addedAt: { type: Date, default: Date.now },
});

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String },
    favorites: { type: [FavoriteCitySchema], default: [] },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model<UserDoc>('User', UserSchema);

