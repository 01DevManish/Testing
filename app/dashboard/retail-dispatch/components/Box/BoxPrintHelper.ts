import { ManagedBox } from "../../types";
import { renderBarcodeToBase64 } from "@/app/lib/barcodeUtils";

/**
 * Thermal-friendly managed box labels.
 * Left: D1 / D2 ... Right: 1/60, 2/60 ...
 */
export const printBoxLabel = (box: ManagedBox) => {
  const barcodeBase64 = renderBarcodeToBase64(box.barcode);
  const totalBoxes = Math.max(1, Number(box.totalBoxes) || 1);

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to print labels.");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Thermal Box Label - ${box.id}</title>
        <style>
          @page {
            size: 100mm 150mm; /* Standard 4x6 thermal */
            margin: 0;
          }

          body {
            margin: 0;
            font-family: Arial, sans-serif;
            color: #000;
          }

          .sheet {
            width: 100mm;
            height: 150mm;
            box-sizing: border-box;
            padding: 6mm;
            page-break-after: always;
            display: flex;
            align-items: stretch;
          }

          .label {
            width: 100%;
            border: 1px solid #000;
            border-radius: 2mm;
            padding: 5mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .left-id {
            font-size: 26pt;
            font-weight: 800;
            line-height: 1;
          }

          .right-ratio {
            font-size: 20pt;
            font-weight: 800;
            line-height: 1;
          }

          .barcode-wrap {
            text-align: center;
            margin-top: 4mm;
          }

          .barcode-img {
            width: 100%;
            height: auto;
            max-height: 28mm;
            object-fit: contain;
          }

          .barcode-text {
            font-family: monospace;
            font-size: 13pt;
            font-weight: 800;
            letter-spacing: 1px;
            margin-top: 2mm;
          }
        </style>
      </head>
      <body>
        ${Array.from({ length: totalBoxes }, (_, idx) => {
          const pageNo = idx + 1;
          return `
          <div class="sheet">
            <div class="label">
              <div class="head">
                <div class="left-id">${box.id}</div>
                <div class="right-ratio">${pageNo}/${totalBoxes}</div>
              </div>

              <div class="barcode-wrap">
                <img src="${barcodeBase64}" class="barcode-img" />
                <div class="barcode-text">${box.barcode}</div>
              </div>
            </div>
          </div>`;
        }).join("")}

        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              window.onafterprint = () => window.close();
            }, 250);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
