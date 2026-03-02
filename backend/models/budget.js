import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
  {
    userId: { 
      type: String,
      required: true,
      index: true
    },
    month: {
      type: String,
      required: true,
      unique: false, 
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);


budgetSchema.index({ userId: 1, month: 1 }, { unique: true });

export default mongoose.model("Budget", budgetSchema);