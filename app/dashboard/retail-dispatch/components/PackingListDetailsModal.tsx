"use client";

import { Card } from "./ui";

interface PackingListDetailsModalProps {
  list: any;
  onClose: () => void;
}

export default function PackingListDetailsModal({ list, onClose }: PackingListDetailsModalProps) {
  if (!list) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              List Details #{list.id?.slice(-6).toUpperCase()}
              <span style={{ 
                fontSize: 11, padding: "2px 10px", borderRadius: 20, 
                background: list.status === "Completed" ? "#10b98115" : "#6366f115",
                color: list.status === "Completed" ? "#10b981" : "#6366f1",
                fontWeight: 700, textTransform: "uppercase"
              }}>
                {list.status}
              </span>
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Created on {new Date(list.createdAt).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Party / Customer</label>
                <p className="text-sm font-semibold text-gray-800">{list.partyName}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned To</label>
                <p className="text-sm font-semibold text-gray-800">{list.assignedToName || "Unassigned"}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transporter / Logicstics</label>
                <p className="text-sm font-semibold text-gray-800">{list.transporter || "Pending"}</p>
              </div>
              {list.status === "Completed" && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dispatched At</label>
                  <p className="text-sm font-semibold text-gray-800">{new Date(list.dispatchedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.items?.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{item.productName}</td>
                    <td className="px-5 py-3 text-xs font-mono text-gray-500">{item.sku || "N/A"}</td>
                    <td className="px-5 py-3 text-sm text-center font-bold text-gray-900">{item.quantity}</td>
                    <td className="px-5 py-3 text-sm text-right text-gray-600">₹{item.rate || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {list.remarks && (
             <div className="mt-6 p-4 bg-yellow-50/50 border border-yellow-100 rounded-xl">
                <label className="text-[10px] font-bold text-yellow-700 uppercase tracking-widest block mb-1">Remarks</label>
                <p className="text-sm text-yellow-900">{list.remarks}</p>
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-bold text-gray-600 transition-all shadow-sm"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
