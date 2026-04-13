import { ManagedBox } from "../../types";
import { renderBarcodeToBase64 } from "@/app/lib/barcodeUtils";
import { resolveS3Url } from "@/app/dashboard/inventory/components/Products/imageService";

/**
 * Generates and triggers printing for a Managed Box label.
 * Includes barcode, timestamp, and a collage of SKU images.
 */
export const printBoxLabel = (box: ManagedBox, allProducts: any[]) => {
  const barcodeBase64 = renderBarcodeToBase64(box.barcode);
  const printDate = new Date().toLocaleString();
  
  // Find images for the SKUs
  const itemsWithImages = box.items.map(item => {
    const product = allProducts.find(p => p.id === item.productId);
    const rawUrl = product?.imageUrl || "https://via.placeholder.com/150?text=No+Image";
    return {
      ...item,
      imageUrl: resolveS3Url(rawUrl)
    };
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to print labels.");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Box Label - ${box.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; color: #1e293b; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .box-id { font-size: 48px; font-weight: 800; margin: 0; color: #000; }
          .timestamp { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 4px; }
          .barcode-container { display: flex; flex-direction: column; align-items: center; text-align: center; }
          .barcode-img { height: 75px; display: block; }
          .barcode-text { font-family: monospace; font-size: 18px; font-weight: 800; letter-spacing: 4px; margin-top: 4px; width: 100%; }
          
          .collage-title { font-size: 18px; font-weight: 800; text-transform: uppercase; color: #1e293b; margin-bottom: 25px; letter-spacing: 2px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; text-align: center; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
          .grid-item { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; text-align: center; background: #fff; page-break-inside: avoid; }
          .sku-img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; margin-bottom: 8px; background: #f8fafc; }
          .sku-code { font-size: 11px; font-weight: 700; color: #1e293b; font-family: monospace; word-break: break-all; }
          
          @media print {
            body { padding: 0; }
            .header { margin-bottom: 20px; }
            .grid { gap: 15px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="box-id">${box.id}</h1>
            <div class="timestamp">Printed On: ${printDate}</div>
          </div>
          <div class="barcode-container">
            <img src="${barcodeBase64}" class="barcode-img" />
            <div class="barcode-text">${box.barcode}</div>
          </div>
        </div>

        <div class="collage-title">Box Collection</div>
        <div class="grid">
          ${itemsWithImages.map(item => `
            <div class="grid-item">
              <img src="${item.imageUrl}" class="sku-img" />
              <div class="sku-code">${item.sku}</div>
            </div>
          `).join('')}
        </div>

        <script>
          window.onload = () => {
             setTimeout(() => {
                window.print();
                printWindow.onafterprint = () => {
                   printWindow.close();
                };
             }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
