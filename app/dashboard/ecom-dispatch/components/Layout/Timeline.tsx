import { OrderStatus, DispatchLog } from "../../types";

interface TimelineProps {
  currentStatus: OrderStatus;
  logs: DispatchLog[];
}

const statusOrder: OrderStatus[] = ["Pending", "Packed", "Dispatched", "In Transit", "Delivered"];

export default function Timeline({ currentStatus, logs }: TimelineProps) {
  const currentIndex = statusOrder.indexOf(currentStatus);

  const getLogForStatus = (status: OrderStatus) => {
    // Return the latest log for this status
    return [...logs].reverse().find(log => log.status === status);
  };

  return (
    <div className="py-6 w-full">
      <div className="flex items-center justify-between w-full relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 z-0 rounded-full"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-green-500 z-0 rounded-full transition-all duration-500"
          style={{ width: `${(currentIndex / (statusOrder.length - 1)) * 100}%` }}
        ></div>

        {statusOrder.map((status, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const log = getLogForStatus(status);

          return (
            <div key={status} className="relative z-10 flex flex-col items-center group">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-colors duration-300 ${
                  isCompleted 
                    ? "bg-green-500 border-green-100 text-white shadow-sm" 
                    : "bg-white border-gray-200 text-gray-400"
                } ${isCurrent ? "ring-4 ring-green-100 ring-opacity-50 scale-110" : ""}`}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
                )}
              </div>
              
              <div className="mt-3 text-center absolute top-full w-32 -ml-12">
                <div className={`text-xs font-bold leading-tight ${isCurrent ? "text-gray-900" : isCompleted ? "text-gray-700" : "text-gray-400"}`}>
                  {status}
                </div>
                {log && (
                  <div className="text-[10px] text-gray-500 mt-1 leading-tight hidden md:block">
                    {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    <br />
                    by {log.user}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
