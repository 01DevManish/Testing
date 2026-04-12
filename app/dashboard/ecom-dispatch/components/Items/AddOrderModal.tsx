import { useState } from "react";
import { Order } from "../../types";
import { api } from "../../data";

interface AddOrderModalProps {
  initialOrderId?: string;
  onClose: () => void;
  onOrderAdded: (order: Order) => void;
}

export default function AddOrderModal({ initialOrderId, onClose, onOrderAdded }: AddOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: initialOrderId || "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    paymentStatus: "Paid" as "Paid" | "COD",
  });

  const [products, setProducts] = useState([{ name: "", quantity: 1, price: 0 }]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.customerName) return alert("Order ID and Customer Name are required.");

    setLoading(true);
    try {
      const validProducts = products.filter(p => p.name.trim() !== "").map((p, i) => ({
        id: `P-${Date.now()}-${i}`,
        name: p.name,
        quantity: Number(p.quantity),
        price: Number(p.price),
        packed: false
      }));

      const newOrder = await api.createOrder({
        id: formData.id,
        customer: {
          name: formData.customerName,
          phone: formData.customerPhone,
          address: formData.customerAddress
        },
        paymentStatus: formData.paymentStatus,
        products: validProducts
      });

      onOrderAdded(newOrder);
    } catch (err) {
      console.error(err);
      alert("Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full overflow-hidden animate-fade-in-up">
        
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            📦 {initialOrderId ? `Import Scanned Order` : `Manual Dispatch Entry`}
          </h2>
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors">
            ← Back to Overview
          </button>
        </div>

        <div className="p-6">
          {initialOrderId && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm flex gap-3">
              <span className="text-xl">ℹ️</span>
              <div>
                <strong>Order Not Found in Dispatch DB</strong><br />
                We couldn't find <b>"{initialOrderId}"</b> in the current dispatch queue. Please enter its details below to manually import it into the dispatch software.
              </div>
            </div>
          )}

          <form id="add-order-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">Order Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Order ID *</label>
                  <input type="text" required value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Payment Status</label>
                  <select value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as any})} className="w-full p-2.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Paid">Paid</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">Customer Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                  <input type="text" required value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                  <input type="text" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Delivery Address</label>
                  <textarea value={formData.customerAddress} onChange={e => setFormData({...formData, customerAddress: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" rows={2}></textarea>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Products</h3>
                <button type="button" onClick={() => setProducts([...products, { name: "", quantity: 1, price: 0 }])} className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">+ Add Item</button>
              </div>
              
              <div className="space-y-3">
                {products.map((p, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input type="text" value={p.name} onChange={e => {
                      const newP = [...products]; newP[index].name = e.target.value; setProducts(newP);
                    }} className="flex-1 p-2 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500" />
                    
                    <input type="number" min="1" value={p.quantity} onChange={e => {
                      const newP = [...products]; newP[index].quantity = Number(e.target.value); setProducts(newP);
                    }} className="w-20 p-2 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500" />
                    
                    <input type="number" min="0" step="0.01" value={p.price} onChange={e => {
                      const newP = [...products]; newP[index].price = Number(e.target.value); setProducts(newP);
                    }} className="w-24 p-2 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500" />
                    
                    <button type="button" onClick={() => setProducts(products.filter((_, i) => i !== index))} className="p-2 text-gray-400 hover:text-red-500">✕</button>
                  </div>
                ))}
              </div>
            </div>

          </form>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" form="add-order-form" disabled={loading} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-100 disabled:opacity-70">
            {loading ? "Saving..." : (initialOrderId ? "Import Order" : "Create Order")}
          </button>
        </div>

      </div>
    </div>
  );
}
