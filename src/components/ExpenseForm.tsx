import React, { useState, useRef } from "react";
import { Category, Expense } from "../types";
import { uploadReceiptToDrive, appendExpenseToSheet } from "../googleApi";
import {
  Calendar,
  DollarSign,
  Tag,
  Car,
  ShoppingBag,
  Sparkles,
  Film,
  Utensils,
  HelpCircle,
  FileUp,
  FileText,
  X,
  Check,
  Loader2,
} from "lucide-react";

interface ExpenseFormProps {
  accessToken: string;
  onExpenseAdded: () => void;
}

const CATEGORY_META = [
  { name: Category.Transport, label: "Transport / Parking", icon: Car, bg: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: Category.Groceries, label: "Groceries", icon: ShoppingBag, bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { name: Category.Lifestyle, label: "Lifestyle", icon: Sparkles, bg: "bg-purple-50 text-purple-700 border-purple-200" },
  { name: Category.Entertainment, label: "Entertainment", icon: Film, bg: "bg-pink-50 text-pink-700 border-pink-200" },
  { name: Category.Food, label: "Food", icon: Utensils, bg: "bg-amber-50 text-amber-700 border-amber-200" },
  { name: Category.Unknown, label: "Unknown", icon: HelpCircle, bg: "bg-stone-50 text-stone-700 border-stone-200" },
];

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  accessToken,
  onExpenseAdded,
}) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [item, setItem] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>(Category.Food);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setReceiptFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setReceiptFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !item || !amount) {
      setSubmitError("Please fill out all required fields marked with *");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      setSubmitError("Please input a valid positive expense amount.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      let receiptUrl = "";
      let receiptName = "";

      if (receiptFile) {
        setIsUploading(true);
        const sanitizedItem = item
          .trim()
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .replace(/__+/g, "_");
        const customName = `${selectedCategory.toLowerCase()}_${sanitizedItem.toLowerCase()}_${date}`;
        const uploadResult = await uploadReceiptToDrive(accessToken, receiptFile, customName);
        receiptUrl = uploadResult.webViewLink;
        receiptName = uploadResult.name;
        setIsUploading(false);
      }

      const expenseData: Omit<Expense, "id"> = {
        date,
        item,
        amount: numericAmount,
        category: selectedCategory,
        receiptUrl,
        receiptName,
      };

      await appendExpenseToSheet(accessToken, expenseData);
      
      // Success State Reset
      setSubmitSuccess(true);
      setItem("");
      setAmount("");
      setReceiptFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onExpenseAdded();

      setTimeout(() => {
        setSubmitSuccess(false);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message || "Failed to log transaction. Please try again.");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div id="expense-form-root" className="w-full bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm">
      <div id="form-header" className="border-b border-slate-100 pb-6 mb-6 -mx-6 -mt-6 p-6 rounded-t-xl bg-slate-50/50">
        <h2 className="font-sans font-bold text-lg text-slate-800">
          New Expense Entry
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          Syncs directly to DATA Google Sheet
        </p>
      </div>

      <form id="expense-entry-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Date Row */}
        <div id="input-group-date">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            Date of Expense <span className="text-indigo-600 font-bold">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Calendar className="h-4 w-4" />
            </span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
        </div>

        {/* Item Row */}
        <div id="input-group-item">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            Item / Description <span className="text-indigo-600 font-bold">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Tag className="h-4 w-4" />
            </span>
            <input
              type="text"
              required
              placeholder="e.g., Office broadband subscription"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
        </div>

        {/* Amount Row */}
        <div id="input-group-amount">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            Amount (USD) <span className="text-indigo-600 font-bold">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <DollarSign className="h-4 w-4" />
            </span>
            <input
              type="number"
              step="0.01"
              required
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
        </div>

        {/* Category Row with Rich Selector */}
        <div id="input-group-category">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">
            Category <span className="text-indigo-600 font-bold">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_META.map((meta) => {
              const Icon = meta.icon;
              const isSelected = selectedCategory === meta.name;
              return (
                <button
                  key={meta.name}
                  type="button"
                  onClick={() => setSelectedCategory(meta.name)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs text-left cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? `border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold shadow-xs`
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Receipt Upload Row */}
        <div id="input-group-receipt">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            Receipt File <span className="text-slate-400 font-normal normal-case">(Optional)</span>
          </label>
          
          {!receiptFile ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-lg p-5 text-center flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 ${
                dragActive
                  ? "border-indigo-500 bg-indigo-50/30"
                  : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
              }`}
            >
              <FileUp className="h-6 w-6 text-slate-400 mb-2" />
              <p className="text-xs text-slate-700 font-medium">
                Drag-and-drop or click to browse
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Supports PDF, JPG, PNG under 10MB
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="p-2 bg-slate-200 border border-slate-300 rounded-md shrink-0">
                  <FileText className="h-4 w-4 text-slate-600" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs text-slate-800 font-medium truncate">
                    {receiptFile.name}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {(receiptFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Messaging Feedback */}
        {submitError && (
          <div id="submit-error" className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-medium">
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div id="submit-success" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2 font-medium">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>Expense logged successfully to Google Sheet DATA!</span>
          </div>
        )}

        {/* Form Action */}
        <button
          id="btn-submit-expense"
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md shadow-indigo-100 hover:shadow-lg hover:shadow-indigo-200 transition-all cursor-pointer disabled:bg-slate-300 text-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isUploading ? "Uploading receipt to Drive..." : "Appending to Sheet..."}</span>
            </>
          ) : (
            <span>Submit to Spreadsheet</span>
          )}
        </button>
      </form>
    </div>
  );
};
