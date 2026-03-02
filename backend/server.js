import Expense from "./models/expense.js";
import Budget from "./models/budget.js";
import 'dotenv/config'; 
import mongoose from 'mongoose';
import express from 'express';
import cors from "cors";
import PDFDocument from 'pdfkit';
import { createClerkClient,verifyToken } from '@clerk/backend'; // ✅ ADD THIS

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const port = 3001;

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); 
console.log("Clerk key loaded:", !!process.env.CLERK_SECRET_KEY);
const mongoURI = process.env.MONGO_URI;


const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

if (!mongoURI) {
  console.error("❌ ERROR: MONGODB_URI is not defined in your .env file!");
} else {
  mongoose.connect(mongoURI)
    .then(() => console.log("✅ SUCCESS: We are connected to MongoDB!"))
    .catch((err) => console.error("❌ ERROR: Connection failed:", err));
}


const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - no token' });
    }
    const token = authHeader.split(' ')[1];

    const payload = await verifyToken(token, { 
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    req.userId = payload.sub;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: 'Invalid token', error: err.message });
  }
};

app.get('/health', (req, res) => { 
  res.send({ status: 'Server is running!' });
});



app.get('/expenses', requireAuth, async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1 }); 
    const responseData = expenses.map(exp => ({
      id: exp._id, 
      title: exp.title,
      amount: exp.amount,
      date: exp.date,
      category: exp.category,
      description: exp.description,
      createdAt: exp.createdAt,
      updatedAt: exp.updatedAt
    }));
    res.json(responseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/expenses', requireAuth, async (req, res) => {
  try {
    const { title, amount, date, category, description } = req.body;
    if (!title || !amount || !date || !category) {
      return res.status(400).json({ message: "Missing fields" });
    }
    const expense = new Expense({
      userId: req.userId, // ✅
      title, amount, date, category,
      description: description || ''
    });
    const saved = await expense.save();
    res.status(201).json({
      id: saved._id, title: saved.title, amount: saved.amount,
      date: saved.date, category: saved.category,
      description: saved.description, createdAt: saved.createdAt, updatedAt: saved.updatedAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, amount, date, description, category } = req.body;
    if (!title || !amount || !date || !category) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid expense ID format" });
    }
    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: id, userId: req.userId }, // ✅ only update if it belongs to this user
      { title, amount: Number(amount), date: new Date(date), description: description || '', category },
      { new: true, runValidators: true }
    );
    if (!updatedExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.json({
      id: updatedExpense._id, title: updatedExpense.title, amount: updatedExpense.amount,
      date: updatedExpense.date, description: updatedExpense.description,
      category: updatedExpense.category, createdAt: updatedExpense.createdAt, updatedAt: updatedExpense.updatedAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid expense ID format" });
    }
    const deletedExpense = await Expense.findOneAndDelete({ _id: id, userId: req.userId }); // ✅
    if (!deletedExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.json({ message: "Expense deleted successfully", id: deletedExpense._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Budget

app.get("/api/budget", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000; 
    const month = new Date(now - offset).toISOString().slice(0, 7);
    const budget = await Budget.findOne({ month, userId: req.userId }); // ✅
    res.json(budget);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/budget", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000; 
    const month = new Date(now - offset).toISOString().slice(0, 7);
    const existing = await Budget.findOne({ month, userId: req.userId }); // ✅
    if (existing) {
      return res.status(400).json({ message: "Budget already exists for this month" });
    }
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid budget amount" });
    }
    const budget = new Budget({ month, amount, userId: req.userId }); // ✅
    await budget.save();
    res.status(201).json(budget);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/budget", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000; 
    const month = new Date(now - offset).toISOString().slice(0, 7);
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid budget amount" });
    }
    const updated = await Budget.findOneAndUpdate(
      { month, userId: req.userId }, // ✅
      { amount },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "No budget found for this month" });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/expenses/export-pdf', requireAuth, async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId }); // ✅
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=ExpenseReport.pdf');
    doc.pipe(res);
    doc.fillColor("#444444").fontSize(20).text("Smart Expense Tracker", 50, 50);
    doc.fontSize(10).text(`Report Date: ${new Date().toLocaleDateString()}`, 50, 80, { align: 'right' });
    doc.moveDown();
    doc.moveTo(50, 100).lineTo(550, 100).stroke();
    const tableTop = 130;
    const itemCodeX = 50, descriptionX = 100, categoryX = 300, amountX = 450;
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Date", itemCodeX, tableTop);
    doc.text("Description", descriptionX, tableTop);
    doc.text("Category", categoryX, tableTop);
    doc.text("Amount", amountX, tableTop, { width: 90, align: "right" });
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    let currentY = tableTop + 25;
    doc.font("Helvetica");
    expenses.forEach((exp) => {
      if (currentY > 750) { doc.addPage(); currentY = 50; }
      doc.fontSize(10)
         .text(new Date(exp.date).toLocaleDateString(), itemCodeX, currentY)
         .text(exp.title, descriptionX, currentY)
         .text(exp.category, categoryX, currentY)
         .text(`$${exp.amount.toFixed(2)}`, amountX, currentY, { width: 90, align: "right" });
      currentY += 20;
    });
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    doc.moveTo(50, currentY + 10).lineTo(550, currentY + 10).stroke();
    doc.fontSize(12).font("Helvetica-Bold")
       .text("Total Spending:", categoryX, currentY + 25)
       .text(`$${total.toFixed(2)}`, amountX, currentY + 25, { width: 90, align: "right" });
    doc.end();
  } catch (error) {
    res.status(500).send("Error generating PDF");
  }
});

app.get("/api/expenses/stats", requireAuth, async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    const expenses = await Expense.find({
      userId: req.userId, // ✅
      date: { $gte: startOfMonth, $lt: endOfMonth },
    });
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const categoryTotals = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000; 
    const month = new Date(now - offset).toISOString().slice(0, 7);
    const budget = await Budget.findOne({ month, userId: req.userId }); // ✅
    const remainingBudget = budget ? budget.amount - totalSpent : null;
    res.json({
      totalSpent, remainingBudget,
      expensesCount: expenses.length,
      categoryTotals,
      budget: budget ? budget.amount : 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server is live at http://localhost:${port}`);
});