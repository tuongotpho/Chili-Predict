'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Store, Flame, Calendar, TrendingUp, AlertCircle, Loader2, LogOut, LogIn, Edit2, Trash2, Check, X as CloseIcon, Menu, Lightbulb, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { GoogleGenAI, Type } from '@google/genai';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Chatbot from './Chatbot';
import { Modal } from './Modal';

import { auth, db } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';

type Purchase = {
  id: string;
  date: string;
  quantity: number;
};

type Prediction = {
  nextPurchaseDate: string;
  expectedQuantity: number;
  reasoning: string;
  trendAnalysis: string;
  intervalAnalysis: string;
  recommendation: string;
};

type Customer = {
  id: string;
  userId: string;
  name: string;
  purchases: Purchase[];
  prediction?: Prediction | null;
  createdAt?: any;
};

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPredicting, setIsPredicting] = useState(false);

  const [newPurchaseDate, setNewPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newPurchaseQuantity, setNewPurchaseQuantity] = useState('');

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editPurchaseQuantity, setEditPurchaseQuantity] = useState('');

  // Modal states
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');

  const [isDeleteCustomerModalOpen, setIsDeleteCustomerModalOpen] = useState(false);

  const [isDeletePurchaseModalOpen, setIsDeletePurchaseModalOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch customers from Firestore
  useEffect(() => {
    if (!user) {
      setCustomers([]);
      setSelectedCustomerId(null);
      return;
    }

    const q = query(
      collection(db, 'chili_customers'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCustomers: Customer[] = [];
      snapshot.forEach((doc) => {
        fetchedCustomers.push({ id: doc.id, ...doc.data() } as Customer);
      });
      
      // Sort in memory to avoid composite index requirement
      fetchedCustomers.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      setCustomers(fetchedCustomers);
      
      // Auto-select first customer if none selected
      if (fetchedCustomers.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(fetchedCustomers[0].id);
      } else if (fetchedCustomers.length === 0) {
        setSelectedCustomerId(null);
      }
    }, (error) => {
      console.error("Firestore error:", error);
      if (error.code === 'failed-precondition') {
        alert("Lỗi Firestore: Truy vấn này yêu cầu một index. Vui lòng kiểm tra Firebase Console để tạo index composite cho 'chili_customers' với các trường 'userId' (Ascending) và 'createdAt' (Descending).");
      } else if (error.code === 'permission-denied') {
        alert("Lỗi quyền truy cập: Bạn không có quyền đọc dữ liệu này. Hãy đảm bảo bạn đã cập nhật Firestore Rules đúng như hướng dẫn.");
      } else {
        alert("Lỗi tải dữ liệu: " + error.message);
      }
    });

    return () => unsubscribe();
  }, [user, selectedCustomerId]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
      alert('Đăng nhập thất bại. Vui lòng thử lại.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCustomerName.trim()) return;
    try {
      await addDoc(collection(db, 'chili_customers'), {
        userId: user.uid,
        name: newCustomerName.trim(),
        purchases: [],
        createdAt: serverTimestamp(),
      });
      setNewCustomerName('');
      setIsAddCustomerModalOpen(false);
      setIsMobileMenuOpen(false);
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Có lỗi xảy ra khi thêm khách hàng.');
    }
  };

  const openEditCustomerModal = () => {
    if (selectedCustomer) {
      setEditCustomerName(selectedCustomer.name);
      setIsEditCustomerModalOpen(true);
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !editCustomerName.trim() || editCustomerName === selectedCustomer.name) return;
    try {
      const customerRef = doc(db, 'chili_customers', selectedCustomer.id);
      await updateDoc(customerRef, {
        name: editCustomerName.trim(),
      });
      setIsEditCustomerModalOpen(false);
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Có lỗi xảy ra khi cập nhật tên khách hàng.');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'chili_customers', selectedCustomer.id));
      setSelectedCustomerId(null);
      setIsDeleteCustomerModalOpen(false);
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Có lỗi xảy ra khi xóa khách hàng.');
    }
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !newPurchaseDate || !newPurchaseQuantity) return;

    const newPurchase: Purchase = {
      id: crypto.randomUUID(),
      date: newPurchaseDate,
      quantity: parseInt(newPurchaseQuantity, 10),
    };

    const updatedPurchases = [...selectedCustomer.purchases, newPurchase].sort((a, b) => a.date.localeCompare(b.date));

    try {
      const customerRef = doc(db, 'chili_customers', selectedCustomer.id);
      await updateDoc(customerRef, {
        purchases: updatedPurchases,
        prediction: null, // Clear old prediction
      });
      setNewPurchaseQuantity('');
    } catch (error) {
      console.error('Error adding purchase:', error);
      alert('Có lỗi xảy ra khi thêm lần mua.');
    }
  };

  const handleStartEditPurchase = (purchase: Purchase) => {
    setEditingPurchaseId(purchase.id);
    setEditPurchaseDate(purchase.date);
    setEditPurchaseQuantity(purchase.quantity.toString());
  };

  const handleSaveEditPurchase = async () => {
    if (!selectedCustomer || !editingPurchaseId) return;

    const updatedPurchases = selectedCustomer.purchases.map(p => {
      if (p.id === editingPurchaseId) {
        return {
          ...p,
          date: editPurchaseDate,
          quantity: parseInt(editPurchaseQuantity, 10)
        };
      }
      return p;
    }).sort((a, b) => a.date.localeCompare(b.date));

    try {
      const customerRef = doc(db, 'chili_customers', selectedCustomer.id);
      await updateDoc(customerRef, {
        purchases: updatedPurchases,
        prediction: null,
      });
      setEditingPurchaseId(null);
    } catch (error) {
      console.error('Error updating purchase:', error);
      alert('Có lỗi xảy ra khi cập nhật lần mua.');
    }
  };

  const confirmDeletePurchase = (purchaseId: string) => {
    setPurchaseToDelete(purchaseId);
    setIsDeletePurchaseModalOpen(true);
  };

  const handleDeletePurchase = async () => {
    if (!selectedCustomer || !purchaseToDelete) return;
    const updatedPurchases = selectedCustomer.purchases.filter(p => p.id !== purchaseToDelete);
    try {
      const customerRef = doc(db, 'chili_customers', selectedCustomer.id);
      await updateDoc(customerRef, {
        purchases: updatedPurchases,
        prediction: null,
      });
      setIsDeletePurchaseModalOpen(false);
      setPurchaseToDelete(null);
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Có lỗi xảy ra khi xóa lần mua.');
    }
  };

  const handlePredict = async () => {
    if (!selectedCustomer || selectedCustomer.purchases.length === 0) return;

    setIsPredicting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      
      const prompt = `
        Tôi là một người kinh doanh tương ớt bán buôn. Dưới đây là lịch sử mua hàng của khách hàng "${selectedCustomer.name}":
        ${selectedCustomer.purchases.map(p => `- Ngày: ${p.date}, Số lượng: ${p.quantity} lít/chai`).join('\n')}
        
        Dựa vào dữ liệu trên, hãy đóng vai một chuyên gia phân tích dữ liệu kinh doanh và cung cấp các thông tin sau bằng tiếng Việt:
        1. "nextPurchaseDate": Ngày khách hàng này có khả năng sẽ mua hàng tiếp theo (định dạng YYYY-MM-DD).
        2. "expectedQuantity": Số lượng dự kiến họ sẽ mua (số).
        3. "reasoning": Lý do ngắn gọn cho dự đoán ngày và số lượng trên.
        4. "intervalAnalysis": Nhận xét chi tiết về các thời điểm mua hàng (các đợt mua cách nhau bao lâu, có đều đặn không, có dấu hiệu bất thường không).
        5. "trendAnalysis": Đánh giá tình hình kinh doanh của khách hàng dựa trên số lượng và tần suất mua (quán có đang bán chạy hơn không, lượng tiêu thụ tương ớt đang tăng hay giảm, tốc độ tiêu thụ trung bình).
        6. "recommendation": Đề xuất hành động thông minh cho tôi (người bán buôn) (ví dụ: thời điểm vàng để gọi điện chăm sóc, nên up-sell/cross-sell gì, có cần cảnh báo nguy cơ mất khách không).
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview', // Nâng cấp lên model Pro để phân tích sâu hơn
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nextPurchaseDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
              expectedQuantity: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
              intervalAnalysis: { type: Type.STRING },
              trendAnalysis: { type: Type.STRING },
              recommendation: { type: Type.STRING },
            },
            required: ['nextPurchaseDate', 'expectedQuantity', 'reasoning', 'intervalAnalysis', 'trendAnalysis', 'recommendation'],
          },
        },
      });

      const predictionData = JSON.parse(response.text || '{}') as Prediction;

      const customerRef = doc(db, 'chili_customers', selectedCustomer.id);
      await updateDoc(customerRef, {
        prediction: predictionData,
      });

    } catch (error) {
      console.error('Lỗi khi dự đoán:', error);
      alert('Có lỗi xảy ra khi dự đoán. Vui lòng thử lại.');
    } finally {
      setIsPredicting(false);
    }
  };

  const chartData = selectedCustomer?.purchases.map(p => ({
    date: format(parseISO(p.date), 'dd/MM/yyyy'),
    quantity: p.quantity
  })) || [];

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Flame className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">ChiliPredict</h1>
          <p className="text-stone-500 mb-8">Đăng nhập để quản lý khách hàng và dự đoán tồn kho tương ớt của bạn.</p>
          <button
            onClick={handleLogin}
            className="w-full py-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            Đăng nhập bằng Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-stone-50 text-stone-900 font-sans overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-stone-200">
        <div className="flex items-center gap-2 text-red-600">
          <Flame className="w-6 h-6 fill-current" />
          <h1 className="font-bold text-xl tracking-tight">ChiliPredict</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-stone-600">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed md:static inset-y-0 left-0 z-50 w-80 bg-white border-r border-stone-200 flex flex-col transform transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600">
            <Flame className="w-6 h-6 fill-current" />
            <h1 className="font-bold text-xl tracking-tight hidden md:block">ChiliPredict</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors" title="Đăng xuất">
              <LogOut className="w-4 h-4" />
            </button>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="p-4 border-b border-stone-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Tìm khách hàng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredCustomers.length === 0 ? (
            <div className="text-center p-4 text-sm text-stone-500">
              Chưa có khách hàng nào. Hãy thêm mới!
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => {
                  setSelectedCustomerId(customer.id);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors",
                  selectedCustomerId === customer.id
                    ? "bg-gradient-to-r from-red-50 to-orange-50 text-red-900 border border-red-100"
                    : "hover:bg-stone-100 text-stone-700 border border-transparent"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  selectedCustomerId === customer.id ? "bg-red-100 text-red-600" : "bg-stone-200 text-stone-500"
                )}>
                  <Store className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{customer.name}</div>
                  <div className="text-xs opacity-70 truncate">
                    {customer.purchases.length} lần mua
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-stone-200">
          <button
            onClick={() => setIsAddCustomerModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg hover:from-red-700 hover:to-orange-600 transition-all shadow-md shadow-red-200 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Thêm khách hàng
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {selectedCustomer ? (
          <>
            <div className="p-8 border-b border-stone-200 bg-white flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-stone-900 mb-2">
                  {selectedCustomer.name}
                </h2>
                <p className="text-stone-500 flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Quản lý lịch sử mua hàng và dự đoán tồn kho
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={openEditCustomerModal}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                  title="Sửa tên khách hàng"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsDeleteCustomerModalOpen(true)}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Xóa khách hàng"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: History & Input */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Chart */}
                  {selectedCustomer.purchases.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-stone-400" />
                        Biểu đồ mua hàng
                      </h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              dx={-10}
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="quantity" 
                              stroke="#dc2626" 
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#dc2626', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, fill: '#dc2626', strokeWidth: 0 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* History List */}
                  <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-stone-200 flex justify-between items-center">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-stone-400" />
                        Lịch sử mua hàng
                      </h3>
                    </div>
                    <div className="divide-y divide-stone-100">
                      {selectedCustomer.purchases.length === 0 ? (
                        <div className="p-8 text-center text-stone-500">
                          Chưa có dữ liệu mua hàng.
                        </div>
                      ) : (
                        selectedCustomer.purchases.map((purchase) => (
                          <div key={purchase.id} className="p-4 px-6 flex justify-between items-center hover:bg-stone-50 transition-colors group">
                            {editingPurchaseId === purchase.id ? (
                              <div className="flex flex-1 gap-4 items-center">
                                <input
                                  type="date"
                                  value={editPurchaseDate}
                                  onChange={(e) => setEditPurchaseDate(e.target.value)}
                                  className="px-2 py-1 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={editPurchaseQuantity}
                                    onChange={(e) => setEditPurchaseQuantity(e.target.value)}
                                    className="w-20 px-2 py-1 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                                  />
                                  <span className="text-xs text-stone-500">lít</span>
                                </div>
                                <div className="ml-auto flex gap-1">
                                  <button
                                    onClick={handleSaveEditPurchase}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingPurchaseId(null)}
                                    className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-md transition-colors"
                                  >
                                    <CloseIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="font-medium text-stone-900">
                                  {format(parseISO(purchase.date), 'dd/MM/yyyy')}
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-stone-600 font-mono bg-stone-100 px-3 py-1 rounded-md">
                                    {purchase.quantity} lít
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => handleStartEditPurchase(purchase)}
                                      className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-md transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => confirmDeletePurchase(purchase.id)}
                                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Actions & Prediction */}
                <div className="space-y-8">
                  {/* Add Purchase Form */}
                  <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Thêm lần mua mới</h3>
                    <form onSubmit={handleAddPurchase} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">Ngày mua</label>
                        <input
                          type="date"
                          required
                          value={newPurchaseDate}
                          onChange={(e) => setNewPurchaseDate(e.target.value)}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">Số lượng (lít/chai)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={newPurchaseQuantity}
                          onChange={(e) => setNewPurchaseQuantity(e.target.value)}
                          placeholder="VD: 50"
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg hover:from-red-700 hover:to-orange-600 transition-all font-medium shadow-md shadow-red-200"
                      >
                        Lưu thông tin
                      </button>
                    </form>
                  </div>

                  {/* Prediction Card */}
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Flame className="w-24 h-24 text-red-600" />
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-4 text-red-900 relative z-10">
                      Phân tích & Dự báo AI (Pro)
                    </h3>
                    
                    {selectedCustomer.purchases.length < 2 ? (
                      <div className="text-sm text-red-700/80 relative z-10 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>Cần ít nhất 2 lần mua hàng để AI có thể phân tích xu hướng và dự đoán chính xác.</p>
                      </div>
                    ) : (
                      <div className="relative z-10 space-y-4">
                        {selectedCustomer.prediction ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-red-200/50">
                                <div className="text-sm text-red-800 mb-1">Ngày mua dự kiến</div>
                                <div className="text-xl font-bold text-red-900">
                                  {format(parseISO(selectedCustomer.prediction.nextPurchaseDate), 'dd/MM/yyyy')}
                                </div>
                              </div>
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-red-200/50">
                                <div className="text-sm text-red-800 mb-1">Số lượng dự kiến</div>
                                <div className="text-xl font-bold text-red-900 font-mono">
                                  {selectedCustomer.prediction.expectedQuantity} <span className="text-base font-normal">lít</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-red-200/50">
                                <h4 className="font-semibold text-red-900 mb-1 flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" /> Đánh giá kinh doanh
                                </h4>
                                <p className="text-sm text-red-800 leading-relaxed">{selectedCustomer.prediction.trendAnalysis}</p>
                              </div>
                              
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-red-200/50">
                                <h4 className="font-semibold text-red-900 mb-1 flex items-center gap-2">
                                  <Clock className="w-4 h-4" /> Nhịp độ mua hàng
                                </h4>
                                <p className="text-sm text-red-800 leading-relaxed">{selectedCustomer.prediction.intervalAnalysis}</p>
                              </div>

                              <div className="bg-red-100/50 rounded-xl p-4 border border-red-200/50">
                                <h4 className="font-semibold text-red-900 mb-1 flex items-center gap-2">
                                  <Lightbulb className="w-4 h-4 text-amber-600" /> Đề xuất hành động
                                </h4>
                                <p className="text-sm text-red-800 leading-relaxed">{selectedCustomer.prediction.recommendation}</p>
                              </div>
                            </div>

                            <button
                              onClick={handlePredict}
                              disabled={isPredicting}
                              className="w-full py-2.5 bg-white text-red-700 border border-red-200 rounded-xl hover:bg-red-50 transition-colors font-medium text-sm flex items-center justify-center gap-2 mt-2 shadow-sm"
                            >
                              {isPredicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                              Cập nhật phân tích
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handlePredict}
                            disabled={isPredicting}
                            className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl hover:from-red-700 hover:to-orange-600 transition-all font-medium shadow-md shadow-red-200 flex items-center justify-center gap-2"
                          >
                            {isPredicting ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Đang phân tích dữ liệu...
                              </>
                            ) : (
                              <>
                                <Flame className="w-5 h-5" />
                                Phân tích & Dự báo ngay
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
            <Store className="w-16 h-16 mb-4 opacity-20" />
            <p>Chọn một khách hàng để xem chi tiết</p>
          </div>
        )}
      </div>

      <Chatbot />

      {/* Modals */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        title="Thêm khách hàng mới"
      >
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Tên khách hàng</label>
            <input
              type="text"
              required
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="VD: Nhà hàng Phở Lý Quốc Sư"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddCustomerModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg hover:from-red-700 hover:to-orange-600 transition-all shadow-md shadow-red-200"
            >
              Thêm mới
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditCustomerModalOpen}
        onClose={() => setIsEditCustomerModalOpen(false)}
        title="Sửa tên khách hàng"
      >
        <form onSubmit={handleEditCustomer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Tên khách hàng</label>
            <input
              type="text"
              required
              value={editCustomerName}
              onChange={(e) => setEditCustomerName(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditCustomerModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg hover:from-red-700 hover:to-orange-600 transition-all shadow-md shadow-red-200"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteCustomerModalOpen}
        onClose={() => setIsDeleteCustomerModalOpen(false)}
        title="Xóa khách hàng"
      >
        <div className="space-y-4">
          <p className="text-stone-600">
            Bạn có chắc chắn muốn xóa khách hàng <span className="font-semibold text-stone-900">&quot;{selectedCustomer?.name}&quot;</span> và toàn bộ lịch sử mua hàng không? Hành động này không thể hoàn tác.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsDeleteCustomerModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleDeleteCustomer}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md shadow-red-200"
            >
              Xóa vĩnh viễn
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeletePurchaseModalOpen}
        onClose={() => setIsDeletePurchaseModalOpen(false)}
        title="Xóa lần mua hàng"
      >
        <div className="space-y-4">
          <p className="text-stone-600">
            Bạn có chắc chắn muốn xóa lần mua này không?
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsDeletePurchaseModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleDeletePurchase}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md shadow-red-200"
            >
              Xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
