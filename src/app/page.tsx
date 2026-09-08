"use client";

import { useState, useRef, useMemo } from "react";
import { Check, AlertTriangle, Plus, Trash2, ArrowRight, Camera } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --------------------------------------------------------
// Types
// --------------------------------------------------------

type Confidence = {
  name: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type Item = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  confidence: Confidence;
};

type ValueWithConfidence = {
  value: number;
  confidence: number;
};

type ExtractedBill = {
  items: Item[];
  subtotal: ValueWithConfidence;
  gst: ValueWithConfidence;
  serviceCharge: ValueWithConfidence;
  discount: ValueWithConfidence;
  printedTotal: ValueWithConfidence;
};

type Person = {
  id: string;
  name: string;
};

type ItemAssignment = {
  itemId: string;
  personIds: string[]; // empty means unassigned
};

type Step = "UPLOAD" | "REVIEW" | "ASSIGN" | "RESULT";

// --------------------------------------------------------
// Main Component
// --------------------------------------------------------

export default function SplitBillApp() {
  const [step, setStep] = useState<Step>("UPLOAD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bill state
  const [bill, setBill] = useState<ExtractedBill | null>(null);

  // Assignment state
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);

  // --------------------------------------------------------
  // Step 1: Upload
  // --------------------------------------------------------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to analyze bill");
      }

      const data: ExtractedBill = await res.json();
      setBill(data);
      // Initialize assignments
      setAssignments(
        data.items.map((item) => ({ itemId: item.id, personIds: [] }))
      );
      setStep("REVIEW");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------
  // Step 2: Review
  // --------------------------------------------------------

  const calculatedTotal = useMemo(() => {
    if (!bill) return 0;
    return (
      bill.subtotal.value +
      bill.gst.value +
      bill.serviceCharge.value -
      bill.discount.value
    );
  }, [bill]);

  const billMismatch = useMemo(() => {
    if (!bill) return false;
    return Math.abs(calculatedTotal - bill.printedTotal.value) > 0.01;
  }, [calculatedTotal, bill]);

  const updateItem = (index: number, field: keyof Item, val: string | number) => {
    if (!bill) return;
    const newItems = [...bill.items];
    newItems[index] = { ...newItems[index], [field]: val };
    setBill({ ...bill, items: newItems });
  };

  const deleteItem = (index: number) => {
    if (!bill) return;
    const itemToDelete = bill.items[index];
    const newItems = bill.items.filter((_, i) => i !== index);
    setBill({ ...bill, items: newItems });
    setAssignments((prev) => prev.filter((a) => a.itemId !== itemToDelete.id));
  };

  const addManualItem = () => {
    if (!bill) return;
    const newItem: Item = {
      id: Math.random().toString(36).substring(7),
      name: "New Item",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      confidence: { name: 1, quantity: 1, unitPrice: 1, totalPrice: 1 },
    };
    setBill({ ...bill, items: [...bill.items, newItem] });
    setAssignments((prev) => [...prev, { itemId: newItem.id, personIds: [] }]);
  };

  const renderConfidence = (conf: number) => {
    if (conf >= 0.9) return <span className="text-green-500 text-xs">High</span>;
    if (conf >= 0.75) return <span className="text-yellow-500 text-xs">Med</span>;
    return <span className="text-red-500 text-xs font-bold flex items-center gap-1"><AlertTriangle size={12}/> Verify</span>;
  };

  // --------------------------------------------------------
  // Step 3: Assign
  // --------------------------------------------------------

  const [newPersonName, setNewPersonName] = useState("");

  const addPerson = () => {
    const trimmed = newPersonName.trim();
    if (trimmed) {
      setPeople([...people, { id: Math.random().toString(36).substring(7), name: trimmed }]);
      setNewPersonName("");
    }
  };

  const removePerson = (id: string) => {
    setPeople(people.filter((p) => p.id !== id));
    setAssignments((prev) =>
      prev.map((a) => ({
        ...a,
        personIds: a.personIds.filter((pid) => pid !== id),
      }))
    );
  };

  const toggleAssignment = (itemId: string, personId: string) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.itemId !== itemId) return a;
        const has = a.personIds.includes(personId);
        return {
          ...a,
          personIds: has
            ? a.personIds.filter((id) => id !== personId)
            : [...a.personIds, personId],
        };
      })
    );
  };

  const assignEveryone = (itemId: string) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.itemId !== itemId) return a;
        return { ...a, personIds: people.map((p) => p.id) };
      })
    );
  };

  // --------------------------------------------------------
  // Step 4: Result (Calculation Engine)
  // --------------------------------------------------------

  const calculateResult = () => {
    if (!bill || people.length === 0) return [];

    let totalAssignedFood = 0;
    const personFoodTotals: Record<string, number> = {};
    people.forEach((p) => (personFoodTotals[p.id] = 0));

    // Calculate food shares
    bill.items.forEach((item) => {
      const assignment = assignments.find((a) => a.itemId === item.id);
      if (assignment && assignment.personIds.length > 0) {
        const splitAmount = item.totalPrice / assignment.personIds.length;
        assignment.personIds.forEach((pid) => {
          if (personFoodTotals[pid] !== undefined) {
            personFoodTotals[pid] += splitAmount;
            totalAssignedFood += splitAmount;
          }
        });
      }
    });

    // Subtotal from items might differ from bill.subtotal if user edited items but not subtotal,
    // but tax/service is based on bill subtotal/discount.
    // For fair distribution, we use the proportion of totalAssignedFood.
    
    // Allocate proportional taxes
    const totalGST = bill.gst.value;
    const totalSC = bill.serviceCharge.value;
    const totalDiscount = bill.discount.value;

    let totalDistributedGST = 0;
    let totalDistributedSC = 0;
    let totalDistributedDiscount = 0;
    let totalDistributedFood = 0;

    const results = people.map((p) => {
      const food = personFoodTotals[p.id];
      const ratio = totalAssignedFood > 0 ? food / totalAssignedFood : 0;
      
      const gst = parseFloat((totalGST * ratio).toFixed(2));
      const sc = parseFloat((totalSC * ratio).toFixed(2));
      const discount = parseFloat((totalDiscount * ratio).toFixed(2));
      const foodRounded = parseFloat(food.toFixed(2));
      
      totalDistributedGST += gst;
      totalDistributedSC += sc;
      totalDistributedDiscount += discount;
      totalDistributedFood += foodRounded;

      return {
        person: p,
        food: foodRounded,
        gst,
        serviceCharge: sc,
        discount,
        finalAmount: foodRounded + gst + sc - discount,
      };
    });

    // Handle rounding errors by applying differences to the first person who has a share
    if (results.length > 0 && totalAssignedFood > 0) {
      const diffGST = totalGST - totalDistributedGST;
      const diffSC = totalSC - totalDistributedSC;
      const diffDiscount = totalDiscount - totalDistributedDiscount;
      const diffFood = totalAssignedFood - totalDistributedFood;

      const firstPerson = results.find(r => r.food > 0) || results[0];
      
      firstPerson.gst = parseFloat((firstPerson.gst + diffGST).toFixed(2));
      firstPerson.serviceCharge = parseFloat((firstPerson.serviceCharge + diffSC).toFixed(2));
      firstPerson.discount = parseFloat((firstPerson.discount + diffDiscount).toFixed(2));
      firstPerson.food = parseFloat((firstPerson.food + diffFood).toFixed(2));
      
      firstPerson.finalAmount = firstPerson.food + firstPerson.gst + firstPerson.serviceCharge - firstPerson.discount;
    }

    return results;
  };

  const results = calculateResult();

  const splitTotal = results.reduce((acc, r) => acc + r.finalAmount, 0);
  const splitMismatch = Math.abs(splitTotal - calculatedTotal) > 0.01;

  // --------------------------------------------------------
  // Renderers
  // --------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SplitBill AI</h1>
        <p className="text-gray-500 mt-2">Split your bill without the math.</p>
        
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mt-6 text-sm font-medium">
          {(["UPLOAD", "REVIEW", "ASSIGN", "RESULT"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn("px-2 py-1 rounded-full", step === s ? "bg-blue-100 text-blue-700" : "text-gray-400")}>
                {i + 1}. {s}
              </span>
              {i < 3 && <ArrowRight size={14} className="text-gray-300" />}
            </div>
          ))}
        </div>
      </header>

      {/* Main Content Card */}
      <main className="bg-white rounded-2xl shadow-sm border p-6 min-h-[400px]">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3">
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === "UPLOAD" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className={cn(
                "w-full max-w-md border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                imagePreview ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
              />
              
              {imagePreview ? (
                <img src={imagePreview} alt="Bill Preview" className="max-h-64 mx-auto rounded-lg shadow-sm" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                    <Camera size={24} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Tap to upload a photo</p>
                    <p className="text-sm text-gray-400 mt-1">JPG, PNG or WEBP</p>
                  </div>
                </div>
              )}
            </div>
            
            <button
              disabled={!imageFile || loading}
              onClick={handleAnalyze}
              className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Reading your bill...
                </>
              ) : (
                "Analyze Bill"
              )}
            </button>
          </div>
        )}

        {/* STEP 2: REVIEW */}
        {step === "REVIEW" && bill && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Review Extracted Items</h2>
            
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium w-20">Qty</th>
                    <th className="px-4 py-3 font-medium w-28">Price</th>
                    <th className="px-4 py-3 font-medium w-28">Total</th>
                    <th className="px-4 py-3 font-medium w-20">Conf</th>
                    <th className="px-4 py-3 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bill.items.map((item, i) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(i, "name", e.target.value)}
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.totalPrice}
                          onChange={(e) => updateItem(i, "totalPrice", parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none font-medium"
                        />
                      </td>
                      <td className="px-4 py-2">{renderConfidence(item.confidence.totalPrice)}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => deleteItem(i)} className="text-gray-400 hover:text-red-500 p-1 rounded">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={addManualItem} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline">
              <Plus size={16} /> Add Item Manually
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
              <div className="space-y-4 max-w-xs">
                {([
                  { label: "Subtotal", key: "subtotal" as const },
                  { label: "GST", key: "gst" as const },
                  { label: "Service Charge", key: "serviceCharge" as const },
                  { label: "Discount", key: "discount" as const },
                  { label: "Printed Total", key: "printedTotal" as const },
                ]).map((field) => (
                  <div key={field.key} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 flex items-center gap-2">
                      {field.label}
                      {renderConfidence(bill[field.key].confidence)}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">₹</span>
                      <input
                        type="number"
                        value={bill[field.key].value}
                        onChange={(e) => setBill({
                          ...bill,
                          [field.key]: { ...bill[field.key], value: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-24 text-right bg-transparent border-b border-gray-200 focus:border-blue-500 focus:outline-none font-medium"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3 self-start">
                <div className="flex justify-between font-medium">
                  <span>Calculated Total:</span>
                  <span>₹{calculatedTotal.toFixed(2)}</span>
                </div>
                {billMismatch && (
                  <div className="text-amber-600 text-sm flex items-start gap-2 bg-amber-50 p-2 rounded">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <p>
                      <strong>Bill total mismatch.</strong><br/>
                      Calculated: ₹{calculatedTotal.toFixed(2)}<br/>
                      Printed: ₹{bill.printedTotal.value.toFixed(2)}<br/>
                      Difference: ₹{Math.abs(calculatedTotal - bill.printedTotal.value).toFixed(2)}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setStep("ASSIGN")}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Continue to Split
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: ASSIGN */}
        {step === "ASSIGN" && bill && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Who was there?</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {people.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-full text-sm font-medium border border-blue-100">
                    {p.name}
                    <button onClick={() => removePerson(p.id)} className="hover:text-red-500 focus:outline-none">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 max-w-xs">
                <input
                  type="text"
                  placeholder="Enter name..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPerson()}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button onClick={addPerson} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
                  Add
                </button>
              </div>
              {people.length === 0 && <p className="text-sm text-red-500 mt-2">Add at least one person to continue.</p>}
            </div>

            {people.length > 0 && (
              <div className="border-t pt-6">
                <h2 className="text-xl font-semibold mb-4">Assign Items</h2>
                <div className="space-y-3">
                  {bill.items.map((item) => {
                    const assignment = assignments.find((a) => a.itemId === item.id);
                    const selected = assignment?.personIds || [];
                    return (
                      <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl gap-4">
                        <div className="flex-shrink-0 min-w-[200px]">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">₹{item.totalPrice.toFixed(2)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => assignEveryone(item.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                              selected.length === people.length ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            Everyone
                          </button>
                          {people.map((p) => {
                            const isSelected = selected.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => toggleAssignment(item.id, p.id)}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                                  isSelected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"
                                )}
                              >
                                {p.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {assignments.some(a => a.personIds.length === 0) && (
                  <p className="text-sm text-amber-600 mt-4 flex items-center gap-1">
                    <AlertTriangle size={14}/> Some items are unassigned. They won&apos;t be included in the split.
                  </p>
                )}

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setStep("RESULT")}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    Calculate Split
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: RESULT */}
        {step === "RESULT" && bill && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-center">Everyone&apos;s Share</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((r) => (
                <div key={r.person.id} className="border rounded-xl p-5 bg-white shadow-sm flex flex-col h-full">
                  <h3 className="font-semibold text-lg border-b pb-3 mb-3">{r.person.name}</h3>
                  <div className="space-y-2 text-sm text-gray-600 flex-1">
                    <div className="flex justify-between"><span>Food</span><span>₹{r.food.toFixed(2)}</span></div>
                    {r.gst > 0 && <div className="flex justify-between"><span>GST</span><span>₹{r.gst.toFixed(2)}</span></div>}
                    {r.serviceCharge > 0 && <div className="flex justify-between"><span>Service</span><span>₹{r.serviceCharge.toFixed(2)}</span></div>}
                    {r.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{r.discount.toFixed(2)}</span></div>}
                  </div>
                  <div className="border-t pt-3 mt-4 flex justify-between font-bold text-gray-900 text-lg">
                    <span>Total</span>
                    <span>₹{r.finalAmount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between gap-8"><span>Subtotal:</span><span className="font-medium text-gray-900">₹{bill.subtotal.value.toFixed(2)}</span></div>
                <div className="flex justify-between gap-8"><span>GST:</span><span className="font-medium text-gray-900">₹{bill.gst.value.toFixed(2)}</span></div>
                <div className="flex justify-between gap-8"><span>Service Charge:</span><span className="font-medium text-gray-900">₹{bill.serviceCharge.value.toFixed(2)}</span></div>
                <div className="flex justify-between gap-8"><span>Discount:</span><span className="font-medium text-gray-900">₹{bill.discount.value.toFixed(2)}</span></div>
              </div>
              
              <div className="text-right border-l pl-6">
                <p className="text-sm text-gray-500 mb-1">Calculated Bill Total</p>
                <p className="text-2xl font-bold">₹{calculatedTotal.toFixed(2)}</p>
                
                {splitMismatch ? (
                   <p className="text-amber-600 text-xs font-medium flex items-center justify-end gap-1 mt-2">
                     <AlertTriangle size={12}/> Split total doesn&apos;t match
                   </p>
                ) : (
                   <p className="text-green-600 text-xs font-medium flex items-center justify-end gap-1 mt-2">
                     <Check size={12}/> Split matches bill
                   </p>
                )}
              </div>
            </div>

            <div className="flex justify-center mt-8 gap-4">
              <button
                onClick={() => setStep("ASSIGN")}
                className="px-6 py-2 border rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to Assign
              </button>
              <button
                onClick={() => {
                  setStep("UPLOAD");
                  setBill(null);
                  setImageFile(null);
                  setImagePreview(null);
                  setPeople([]);
                  setAssignments([]);
                }}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
