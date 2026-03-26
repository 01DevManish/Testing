import { useState } from "react";
import { Order, OrderStatus } from "../types";
import Timeline from "./Timeline";
import { api } from "../data";
import { BtnPrimary, BtnGhost, Input, Select, Badge } from "./ui";

interface OrderDetailsModalProps {
  order: Order;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: Order) => void;
  onDeleteOrder?: (id: string) => void;
  user: { uid: string; name: string; role: string };
}

export default function OrderDetailsModal({ order, onClose, onOrderUpdated, onDeleteOrder, user }: OrderDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [packingNotes, setPackingNotes] = useState(order.packedNotes || "");
  
  const [dispatchData, setDispatchData] = useState({
    courierPartner: order.courierPartner || "FedEx",
    trackingId: order.trackingId || "",
    shippingType: order.shippingType || "Air" as "Air" | "Surface",
    dispatchDate: order.dispatchDate || new Date().toISOString().split('T')[0]
  });

  const allPacked = order.products.every(p => p.packed);

  const handleTogglePacked = async (productId: string, packed: boolean) => {
    try {
      const updated = await api.markItemPacked(order.id, productId, packed);
      onOrderUpdated(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAsPacked = async () => {
    setLoading(true);
    try {
      const updated = await api.updateOrderStatus(order.id, "Packed", user.name, { packedNotes: packingNotes }, user);
      onOrderUpdated(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!dispatchData.trackingId) return alert("Please enter Tracking ID");
    setLoading(true);
    try {
      const updated = await api.updateOrderStatus(order.id, "Dispatched", user.name, {
        courierPartner: dispatchData.courierPartner,
        trackingId: dispatchData.trackingId,
        shippingType: dispatchData.shippingType,
        dispatchDate: dispatchData.dispatchDate
      }, user);
      onOrderUpdated(updated);
      
      // Simulate Notification API
      console.log("SENDING SMS/EMAIL to: ", updated.customer.phone);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDevMarkDelivered = async () => {
    setLoading(true);
    try {
      const updated = await api.updateOrderStatus(order.id, "Delivered", "Courier Sync");
      onOrderUpdated(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              Order {order.id}
              <span className="text-sm px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold border border-blue-200">
                {order.paymentStatus}
              </span>
            </h2>
            <p className="text-sm text-gray-500 font-medium">Placed on {new Date(order.logs[0]?.timestamp).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2">
            <button className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
              onClick={() => alert("Simulating Label Generation...")}>
              🏷️ Print Label
            </button>
            <button className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
              onClick={() => alert("Simulating PDF Generation...")}>
              📄 Invoice PDF
            </button>
            <button className="p-2 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg text-red-600 font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
              onClick={() => { if(confirm("Delete this dispatch record permanently?")) onDeleteOrder?.(order.id); }}>
              🗑️ Delete
            </button>
            <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-lg transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
          
          <div className="mb-10 px-4 md:px-12">
            <Timeline currentStatus={order.status} logs={order.logs} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Customer & Logs */}
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-50 pb-2">Customer Details</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">👤</span>
                    <div>
                      <p className="font-semibold text-gray-900">{order.customer.name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="text-gray-700">{order.customer.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📍</span>
                    <div>
                      <p className="text-gray-700 text-sm">{order.customer.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-50 pb-2">Tracking Logs</h3>
                <div className="space-y-4">
                  {[...order.logs].reverse().map((log, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-50 mt-1"></div>
                        {i !== order.logs.length - 1 && <div className="w-px h-full bg-gray-100 my-1"></div>}
                      </div>
                      <div className="pb-1">
                        <p className="font-semibold text-sm text-gray-800">{log.status} <span className="text-xs font-normal text-gray-500 ml-1">by {log.user}</span></p>
                        <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</p>
                        {log.note && <p className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded-md">{log.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Items & Dispatch actions */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Product Packing Module */}
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-50 pb-2 flex justify-between">
                  <span>Items & Packing Module</span>
                  <span className="text-blue-500 font-semibold lowercase">
                    {order.products.filter(p => p.packed).length}/{order.products.length} Packed
                  </span>
                </h3>
                
                <div className="space-y-3 mb-6">
                  {order.products.map(p => (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${p.packed ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                      <div className="flex items-center gap-4">
                        <input 
                          type="checkbox" 
                          checked={p.packed} 
                          disabled={order.status !== "Pending"}
                          onChange={(e) => handleTogglePacked(p.id, e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div>
                          <p className={`font-semibold ${p.packed ? "text-green-800" : "text-gray-800"}`}>{p.name}</p>
                          <p className="text-xs text-gray-500">Qty: {p.quantity} × ${p.price}</p>
                        </div>
                      </div>
                      <div className="font-bold text-gray-700">${(p.quantity * p.price).toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                {order.status === "Pending" && (
                  <div className="bg-yellow-50/50 p-4 rounded-lg border border-yellow-100">
                    <label className="block text-xs font-bold text-yellow-800 mb-2 uppercase tracking-wide">Packing Notes (Optional)</label>
                    <textarea 
                      value={packingNotes}
                      onChange={e => setPackingNotes(e.target.value)}
                      className="w-full text-sm p-3 border border-yellow-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      rows={2}
                    />
                    
                    {/* Add File Upload for Packing Proof */}
                    <div className="mt-3 flex items-center gap-3">
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-50">
                        <span>📸</span> Upload Packing Proof
                        <input type="file" className="hidden" accept="image/*" />
                      </label>
                      <span className="text-xs text-gray-400">0 images attached</span>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <BtnPrimary 
                        onClick={handleMarkAsPacked}
                        disabled={!allPacked || loading}
                        loading={loading}
                      >
                        Mark as Packed
                      </BtnPrimary>
                    </div>
                  </div>
                )}
              </div>

              {/* Dispatch Module */}
              {(order.status === "Packed" || order.status === "Dispatched") && (
                <div className={`p-5 rounded-xl border shadow-sm transition-all ${order.status === "Packed" ? "bg-white border-blue-200 ring-2 ring-blue-50" : "bg-gray-50 border-gray-200 opacity-90"}`}>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Dispatch Module</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Courier Partner *</label>
                      <select 
                        value={dispatchData.courierPartner}
                        onChange={e => setDispatchData({...dispatchData, courierPartner: e.target.value})}
                        className="w-full p-2.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="FedEx">FedEx</option>
                        <option value="DHL">DHL Express</option>
                        <option value="Delhivery">Delhivery</option>
                        <option value="BlueDart">BlueDart</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Shipping Type *</label>
                      <select 
                        value={dispatchData.shippingType}
                        onChange={e => setDispatchData({...dispatchData, shippingType: e.target.value as any})}
                        className="w-full p-2.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Air">Air (Express)</option>
                        <option value="Surface">Surface (Standard)</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tracking ID (AWB) *</label>
                      <input 
                        type="text" 
                        value={dispatchData.trackingId}
                        onChange={e => setDispatchData({...dispatchData, trackingId: e.target.value})}
                        className="w-full p-2.5 border border-gray-300 rounded-md text-sm font-mono bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Dispatch Date</label>
                      <input 
                        type="date" 
                        value={dispatchData.dispatchDate}
                        onChange={e => setDispatchData({...dispatchData, dispatchDate: e.target.value})}
                        className="w-full p-2.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {order.status === "Packed" && (
                    <div className="flex justify-between items-center mt-6">
                       <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-50">
                        <span>📄</span> Upload Courier Manifest
                        <input type="file" className="hidden" accept=".pdf,image/*" />
                      </label>
                      
                      <BtnPrimary 
                        onClick={handleDispatch}
                        disabled={loading}
                        loading={loading}
                        style={{ padding: "10px 32px" }}
                      >
                        🚀 Dispatch Order
                      </BtnPrimary>
                    </div>
                  )}

                  {/* Dev Action: Mark Delivered for testing */}
                  {order.status === "Dispatched" && (
                     <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50/50 flex justify-between items-center">
                       <span className="text-xs text-gray-500">Waiting for courier tracking API webhook to update delivered status...</span>
                       <button onClick={handleDevMarkDelivered} className="px-4 py-2 bg-white border border-gray-300 rounded text-xs font-bold hover:bg-gray-100">
                         Simulate Webhook: Delivered
                       </button>
                     </div>
                  )}

                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
