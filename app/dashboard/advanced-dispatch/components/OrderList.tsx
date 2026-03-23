import { Order, OrderStatus } from "../types";

interface OrderListProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: OrderStatus | "All";
  setFilterStatus: (s: OrderStatus | "All") => void;
}

const statusColors: Record<OrderStatus, string> = {
  "Pending": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Packed": "bg-blue-100 text-blue-800 border-blue-200",
  "Dispatched": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "In Transit": "bg-purple-100 text-purple-800 border-purple-200",
  "Delivered": "bg-green-100 text-green-800 border-green-200",
};

export default function OrderList({ orders, onSelectOrder, searchQuery, setSearchQuery, filterStatus, setFilterStatus }: OrderListProps) {
  
  const filtered = orders.filter(o => {
    const matchSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        o.customer.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === "All" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">Recent Orders</h2>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <input 
            type="text" 
            placeholder="Search ID or Name..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Packed">Packed</option>
            <option value="Dispatched">Dispatched</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">Order ID</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">Customer</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">Items</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">Status</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">
                  <div className="text-4xl mb-3">📦</div>
                  <p>No orders found matching your criteria.</p>
                </td>
              </tr>
            ) : filtered.map(order => (
              <tr 
                key={order.id} 
                className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                onClick={() => onSelectOrder(order)}
              >
                <td className="py-4 px-4 font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{order.id}</td>
                <td className="py-4 px-4">
                  <div className="font-medium text-gray-800">{order.customer.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{order.customer.phone}</div>
                </td>
                <td className="py-4 px-4 text-gray-600 font-medium">
                  {order.products.reduce((acc, p) => acc + p.quantity, 0)} items
                </td>
                <td className="py-4 px-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusColors[order.status]}`}>
                    {order.status}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <button 
                    className="text-blue-600 hover:text-blue-800 font-semibold text-sm bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
