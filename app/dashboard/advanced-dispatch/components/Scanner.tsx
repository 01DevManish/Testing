import { useState, useRef, useEffect } from "react";

interface ScannerProps {
  onScan: (code: string) => void;
}

export default function Scanner({ onScan }: ScannerProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the hidden input to catch physical barcode scanner inputs
  useEffect(() => {
    const focusInput = () => {
      if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        inputRef.current?.focus();
      }
    };
    document.addEventListener("click", focusInput);
    focusInput(); // Initial focus
    return () => document.removeEventListener("click", focusInput);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onScan(inputValue.trim());
      setInputValue("");
    }
  };

  const handleSimulateCamera = () => {
    // Simulate a camera scan resolving after 1s
    const mockOrderIds = ["ORD-1001", "ORD-1002", "ORD-1003", "INVALID-999"];
    const randomCode = mockOrderIds[Math.floor(Math.random() * mockOrderIds.length)];
    onScan(randomCode);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-6 items-center w-full">
      <div className="flex-1 w-full">
        <h3 className="text-lg font-bold text-gray-800 mb-2">Scan Order Barcode</h3>
        <p className="text-sm text-gray-500 mb-4">
          Use a physical barcode scanner or enter the Order ID manually below.
        </p>
        
        <form onSubmit={handleSubmit} className="flex gap-2 w-full">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400 text-lg">🔍</span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g., ORD-1001"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
            />
          </div>
          <button 
            type="submit"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            Find Order
          </button>
        </form>
      </div>

      <div className="hidden md:block w-px h-24 bg-gray-100"></div>

      <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 w-full md:w-64">
        <div className="text-3xl mb-2">📱</div>
        <p className="text-sm font-medium text-gray-700 mb-3 text-center">Device Camera Scanner</p>
        <button 
          onClick={handleSimulateCamera}
          className="px-4 py-2 bg-white border border-gray-300 hover:border-blue-500 text-gray-700 hover:text-blue-600 text-sm font-semibold rounded-lg shadow-sm transition-all flex justify-center items-center gap-2"
        >
          <span>📷</span> Open Camera
        </button>
      </div>
    </div>
  );
}
