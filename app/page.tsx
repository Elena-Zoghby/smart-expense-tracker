"use client";
import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import categoryKeywords from "@/data/categoryKeywords.json";
import { UserButton, useUser,useAuth} from "@clerk/nextjs";
type Expense = {
  id: string;
  title: string;
  amount: number;
  date: string;
  description?: string;
  category: string;
};

const categories = ["Food", "Transport", "Bills", "Entertainment", "Shopping", "Other"];
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AA00FF", "#FF3366"];
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function Home() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const [budget, setBudget] = useState<number | null>(0);
  const [remainingBudget, setRemainingBudget] = useState<number | null>(0);
  const [budgetInput, setBudgetInput] = useState("");

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "byCategory">("all");
  const [filterCategory, setFilterCategory] = useState("All");

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setDarkMode(true);
    }
  }, []);

  // Save theme whenever it changes
  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Toggle dark mode and save preference
  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setDarkMode(!darkMode);
  };

  const [manualCategory, setManualCategory] = useState(false);



  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);



  //Auto Category Detection
  const detectCategory = (title: string): string => {
    if (!title.trim()) return "Other";

    const words = title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/);

    let bestCategory: string | null = null;
    let highestScore = 0;

    (Object.keys(categoryKeywords) as (keyof typeof categoryKeywords)[]).forEach(category => {
      let score = 0;
      for (const keyword of categoryKeywords[category]) {
        if (words.includes(keyword)) score++;
      }
      if (score > highestScore) {
        highestScore = score;
        bestCategory = category;
      }
    });

    return bestCategory ?? "Other";
  };

  useEffect(() => {
  if (!user) return;
  const fetchExpenses = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${BASE_URL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      console.error(err);
    }
  };
  fetchExpenses();
}, [user]);


  useEffect(() => {
  if (!user) return;
  const fetchStats = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${BASE_URL}/api/expenses/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setBudget(data.budget || 0);
      setRemainingBudget(data.remainingBudget || 0);
    } catch (err) {
      console.error(err);
    }
  };
  fetchStats();
}, [expenses, user]);
  const chartData = categories
    .map((cat) => ({
      name: cat,
      value: expenses
        .filter((e) => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0),
    }))
    .filter((data) => data.value > 0);

  const now = new Date();

  const monthlyExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
  });

  const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const budgetUsage = budget && budget > 0 ? (totalExpenses / budget) * 100 : 0;

  const topCategory = (() => {
    const totals: Record<string, number> = {};

    categories.forEach(cat => {
      totals[cat] = monthlyExpenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
    });

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return sorted[0] && sorted[0][1] > 0 ? sorted[0][0] : "None";
  })();

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setAmount(String(editing.amount));
      setDate(editing.date.split("T")[0]);
      setDescription(editing.description || "");
      setCategory(editing.category);
    }
  }, [editing]);

  const handleAddExpense = async () => {
  if (!title || !amount || !date) return alert("Fill all required fields");
  if (Number(amount) <= 0) return alert("Amount must be positive");
  setIsSubmitting(true);
  try {
    const token = await getToken();
    if (editing) {
      const res = await fetch(`${BASE_URL}/expenses/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, amount: Number(amount), date, description, category }),
      });
      if (!res.ok) throw new Error("Failed to update expense");
      const updated = await res.json();
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditing(null);
    } else {
      const res = await fetch(`${BASE_URL}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, amount: Number(amount), date, description, category }),
      });
      if (!res.ok) throw new Error("Failed to add expense");
      const newExp = await res.json();
      setExpenses((prev) => [...prev, newExp]);
    }
    setTitle(""); setAmount(""); setDate(""); setDescription(""); setCategory("Food");
    setManualCategory(false);
  } catch (err) {
    console.error(err);
    alert("Error saving expense");
  } finally {
    setIsSubmitting(false);
  }
};

  const handleDelete = async (id: string) => {
  try {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/expenses/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to delete");
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  } catch (err) {
    console.error(err);
    alert("Error deleting expense");
  }
};
  let budgetAlert = "";
  let alertColor = "";

  if (budgetUsage >= 100) {
    budgetAlert = "Budget exceeded!";
    alertColor = "text-red-600 dark:text-red-400";
  } else if (budgetUsage >= 80) {
    budgetAlert = "You are close to your limit";
    alertColor = "text-yellow-600 dark:text-yellow-400";
  } else {
    budgetAlert = "Budget is under control";
    alertColor = "text-green-600 dark:text-green-400";
  }

  const handleBudget = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!budgetInput || Number(budgetInput) <= 0) return alert("Enter a valid budget");
  try {
    const token = await getToken();
    const method = budget === 0 || budget === null ? "POST" : "PUT";
    const res = await fetch(`${BASE_URL}/api/budget`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: Number(budgetInput) }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || "Failed to save budget");
    }
    const data = await res.json();
    setBudget(data.amount);
    setRemainingBudget(data.amount - totalExpenses);
    setBudgetInput("");
  } catch (err) {
    console.error(err);
    alert("Failed to save budget");
  }
};

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();

    return expenses.filter((exp) => {
      const matchesSearch =
        q.length === 0 || exp.title.toLowerCase().includes(q);

      const matchesCategory =
        filterMode === "all" ||
        filterCategory === "All" ||
        exp.category === filterCategory;

      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, filterMode, filterCategory]);

  useEffect(() => {
    if (filterMode === "all") setFilterCategory("All");
  }, [filterMode]);

// Prediction Logic
const getPrediction = () => {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  
  if (monthlyExpenses.length === 0) return 0;
  
  // Calculate pace: Total spent so far / days elapsed
  const dailyBurnRate = totalExpenses / today;
  return dailyBurnRate * daysInMonth;
};

const predictedSpending = getPrediction();
// ===== Spending Trend (This Week vs Last Week) =====
const nowDate = new Date();

const startOfThisWeek = new Date(nowDate);
startOfThisWeek.setDate(nowDate.getDate() - nowDate.getDay());
startOfThisWeek.setHours(0, 0, 0, 0);

const startOfLastWeek = new Date(startOfThisWeek);
startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

const endOfLastWeek = new Date(startOfThisWeek);
endOfLastWeek.setMilliseconds(-1);

const thisWeekTotal = expenses
  .filter(e => {
    const d = new Date(e.date);
    return d >= startOfThisWeek;
  })
  .reduce((sum, e) => sum + e.amount, 0);

const lastWeekTotal = expenses
  .filter(e => {
    const d = new Date(e.date);
    return d >= startOfLastWeek && d <= endOfLastWeek;
  })
  .reduce((sum, e) => sum + e.amount, 0);

let trendPercent = 0;
if (lastWeekTotal > 0) {
  trendPercent = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
}

const trendUp = thisWeekTotal > lastWeekTotal;

const getSuggestion = () => {
  if (predictedSpending === 0) return "Add some expenses to see your monthly prediction.";
  if (!budget || budget === 0) return `You're on track to spend $${predictedSpending.toFixed(2)} this month. Set a budget to see how you're doing!`;
  
  if (predictedSpending > budget) {
    const over = predictedSpending - budget;
    return `Warning: At this pace, you'll exceed your budget by $${over.toFixed(2)}. Consider cutting back on ${topCategory.toLowerCase()}.`;
  }
  return "Great job! You're currently on track to stay within your budget.";
};

//export to pdf
const handleExportPdf = async () => {
  try {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/expenses/export-pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Backend failed to produce PDF");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Expenses_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Export failed. Is the backend server running?");
  }
};
  return (
   <div
      className={`min-h-screen transition-colors duration-300 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"
        }`}
    >
      <div className="fixed top-4 right-4 z-10 flex items-center gap-3"> {/* ✅ added flex items-center gap-3 */}
        
        
        <UserButton afterSignOutUrl="/sign-in" />
        <button
          onClick={toggleDarkMode}
          className={`p-3 rounded-lg shadow-lg border transition-all duration-300 ${darkMode
              ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
              : "bg-white border-gray-200 hover:shadow-xl"
            }`}
          aria-label="Toggle dark mode"
        >
          {darkMode ? "Turn Light Mode on" : "Turn Dark Mode on"}
        </button>
      </div>

      <main className="container mx-auto p-6">
        <h1 className="text-3xl font-bold text-center mb-8">
          Smart Expense Tracker
        </h1>
          {user && (
          <p className={`text-center mb-6 text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>
            Welcome back, {user.firstName || user.emailAddresses[0].emailAddress} 👋
          </p>
        )}
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-1/3">
            <div
              className={`rounded-xl shadow-lg p-6 border sticky top-6 ${darkMode
                  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-gray-200"
                }`}
            >
              <h2
                className={`text-xl font-semibold mb-6 pb-3 border-b ${darkMode
                    ? "text-slate-100 border-slate-800"
                    : "text-gray-800 border-gray-200"
                  }`}
              >
                {editing ? "Edit Expense" : "Add New Expense"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${darkMode ? "text-slate-300" : "text-gray-700"
                      }`}
                  >
                    Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Grocery shopping"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);

                      if (!manualCategory) {
                        const detected = detectCategory(e.target.value);
                        if (detected) {
                          setCategory(detected);
                        }
                      }
                    }}
                  
                  className={`w-full border rounded-lg p-3 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent ${darkMode
                      ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400"
                      : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${darkMode ? "text-slate-300" : "text-gray-700"
                      }`}
                  >
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full border rounded-lg p-3 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent ${darkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400"
                        : "bg-white border-gray-300 text-gray-900"
                      }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${darkMode ? "text-slate-300" : "text-gray-700"
                      }`}
                  >
                    Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full border rounded-lg p-3 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent ${darkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100"
                        : "bg-white border-gray-300 text-gray-900"
                      }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${darkMode ? "text-slate-300" : "text-gray-700"
                      }`}
                  >
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Additional details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`w-full border rounded-lg p-3 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent ${darkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400"
                        : "bg-white border-gray-300 text-gray-900"
                      }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${darkMode ? "text-slate-300" : "text-gray-700"
                      }`}
                  >
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`w-full border rounded-lg p-3 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent ${darkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100"
                        : "bg-white border-gray-300 text-gray-900"
                      }`}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleAddExpense}
                  disabled={isSubmitting}
                  className={`w-full p-3 rounded-lg text-white font-medium transition-colors duration-200 shadow-md hover:shadow-lg ${isSubmitting
                      ? darkMode
                        ? "bg-slate-600 cursor-not-allowed"
                        : "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                    }`}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editing
                      ? "Update Expense"
                      : "Add Expense"}
                </button>

                {editing && (
                  <button
                    onClick={() => {
                      setEditing(null);
                      setTitle("");
                      setAmount("");
                      setDate("");
                      setDescription("");
                      setCategory("Food");
                    }}
                    className={`w-full p-3 rounded-lg font-medium transition-colors duration-200 ${darkMode
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="lg:w-2/3 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className={`rounded-xl shadow-lg p-6 border ${darkMode
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-gray-200"
                  }`}
              >
                <p
                  className={`text-sm mb-1 ${darkMode ? "text-slate-400" : "text-gray-500"
                    }`}
                >
                  Monthly Total
                </p>
                <p
                  className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-800"
                    }`}
                >
                  ${totalExpenses.toFixed(2)}
                </p>
                {lastWeekTotal > 0 && (
            <p
              className={`text-sm mt-2 font-medium ${
                trendUp ? "text-red-500" : "text-green-500"
              }`}
            >
              {trendUp ? "▲" : "▼"} {Math.abs(trendPercent).toFixed(0)}% vs last week
            </p>
          )}
              </div>

              <div
                className={`rounded-xl shadow-lg p-6 border ${darkMode
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-gray-200"
                  }`}
              >
                <p
                  className={`text-sm mb-1 ${darkMode ? "text-slate-400" : "text-gray-500"
                    }`}
                >
                  Budget Status
                </p>
                <p
                  className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-800"
                    }`}
                >
                  ${(remainingBudget ?? 0).toFixed(2)}
                </p>
                <div
                  className={`w-full rounded-full h-2 mt-3 ${darkMode ? "bg-slate-700" : "bg-gray-200"
                    }`}
                >
                  <div
                    className={`h-2 rounded-full ${budgetUsage >= 100
                        ? "bg-red-500"
                        : budgetUsage >= 80
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    style={{ width: `${Math.min(budgetUsage, 100)}%` }}
                  ></div>
                </div>
                <p className={`text-sm font-medium mt-2 ${alertColor}`}>
                  {budgetAlert}
                </p>
              </div>

              <div
                className={`rounded-xl shadow-lg p-6 border ${darkMode
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-gray-200"
                  }`}
              >
                <p
                  className={`text-sm mb-1 ${darkMode ? "text-slate-400" : "text-gray-500"
                    }`}
                >
                  Expense Count
                </p>
                <p
                  className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-800"
                    }`}
                >
                  {expenses.length}
                </p>
              </div>

              <div
                className={`rounded-xl shadow-lg p-6 border ${darkMode
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-gray-200"
                  }`}
              >
                <p
                  className={`text-sm mb-1 ${darkMode ? "text-slate-400" : "text-gray-500"
                    }`}
                >
                  Top Category
                </p>
                <p
                  className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-800"
                    }`}
                >
                  {topCategory}
                </p>
              </div>
            </div>

            <div
              className={`rounded-xl shadow-lg p-6 border ${darkMode
                  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-gray-200"
                }`}
            >
              <h2
                className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"
                  }`}
              >
                Monthly Budget Setup
              </h2>
              {/* Prediction / Suggestion Section */}
            <div className={`p-4 rounded-xl border mt-4 ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-blue-50 border-blue-100 text-blue-900"}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wide">Monthly Prediction</h3>
                <span className="text-lg font-bold">${predictedSpending.toFixed(2)}</span>
              </div>
              <p className="text-sm opacity-90 italic">
                "{getSuggestion()}"
              </p>
            </div>
              <form onSubmit={handleBudget} className="flex gap-3">
                <input
                  type="number"
                  placeholder="Enter budget amount"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className={`flex-1 border rounded-lg p-3 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent ${darkMode
                      ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400"
                      : "bg-white border-gray-300 text-gray-900"
                    }`}
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
                >
                  Save
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div
                className={`rounded-xl shadow-lg p-6 border ${darkMode
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-gray-200"
                  }`}
              >
                <h2
                  className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"
                    }`}
                >
                  Expenses by Category
                </h2>
                <div className="flex justify-center">
                  <PieChart width={280} height={280}>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) =>
                        `${entry.name} ${((entry.percent || 0) * 100).toFixed(0)}%`
                      }
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: darkMode ? "#1e293b" : "#fff",
                        borderColor: darkMode ? "#334155" : "#e5e7eb",
                        color: darkMode ? "#fff" : "#000",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </div>
              </div>

              <div
                className={`rounded-xl shadow-lg p-6 border ${darkMode
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-gray-200"
                  }`}
              >
                <h2
                  className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"
                    }`}
                >
                  Search & Filter
                </h2>

                <div className="space-y-4">
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${darkMode ? "text-slate-300" : "text-gray-700"
                        }`}
                    >
                      Search by title
                    </label>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Type to search..."
                      className={`w-full border rounded-lg p-3 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent ${darkMode
                          ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400"
                          : "bg-white border-gray-300 text-gray-900"
                        }`}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterMode("all")}
                      className={`flex-1 p-3 rounded-lg font-medium transition-all duration-200 ${filterMode === "all"
                          ? "bg-blue-600 text-white shadow-md"
                          : darkMode
                            ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode("byCategory")}
                      className={`flex-1 p-3 rounded-lg font-medium transition-all duration-200 ${filterMode === "byCategory"
                          ? "bg-blue-600 text-white shadow-md"
                          : darkMode
                            ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                    >
                      By Category
                    </button>
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${darkMode ? "text-slate-300" : "text-gray-700"
                        }`}
                    >
                      Category
                    </label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      disabled={filterMode === "all"}
                      className={`w-full border rounded-lg p-3 transition-all ${filterMode === "all"
                          ? darkMode
                            ? "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                            : "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed"
                          : darkMode
                            ? "bg-slate-800 border-slate-700 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            : "bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        }`}
                    >
                      <option value="All">All Categories</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`rounded-xl shadow-lg p-6 border ${darkMode
                  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-gray-200"
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2
                  className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-800"
                    }`}
                >
                  Expense List
                </h2>
                <span
                  className={`text-sm px-3 py-1 rounded-full ${darkMode
                      ? "bg-slate-800 text-slate-400"
                      : "bg-gray-100 text-gray-600"
                    }`}
                >
                  {filteredExpenses.length}{" "}
                  {filteredExpenses.length === 1 ? "item" : "items"}
                </span>
              </div>

              {filteredExpenses.length === 0 ? (
                <p
                  className={`text-center py-8 ${darkMode ? "text-slate-400" : "text-gray-600"
                    }`}
                >
                  No matching expenses. Try a different search or filter.
                </p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {filteredExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className={`flex justify-between items-center border p-4 rounded-lg transition-all duration-200 hover:shadow-md ${darkMode
                          ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                          : "bg-gray-50 border-gray-200"
                        }`}
                    >
                      <div className="flex-1">
                        <p
                          className={`font-medium ${darkMode ? "text-white" : "text-gray-800"
                            }`}
                        >
                          {exp.title}
                        </p>
                        <p
                          className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-500"
                            }`}
                        >
                          {exp.category} •{" "}
                          {new Date(exp.date).toLocaleDateString()}
                        </p>
                        {exp.description && (
                          <p
                            className={`text-xs mt-1 ${darkMode ? "text-slate-500" : "text-gray-400"
                              }`}
                          >
                            {exp.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`font-bold ${darkMode ? "text-white" : "text-gray-800"
                            }`}
                        >
                          ${exp.amount.toFixed(2)}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditing(exp)}
                            className={`text-xs px-3 py-1.5 rounded transition-colors duration-200 ${darkMode
                                ? "bg-slate-700 text-slate-300 hover:bg-blue-600 hover:text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-white"
                              }`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className={`text-xs px-3 py-1.5 rounded transition-colors duration-200 ${darkMode
                                ? "bg-slate-700 text-slate-300 hover:bg-red-500 hover:text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-red-500 hover:text-white"
                              }`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleExportPdf}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}