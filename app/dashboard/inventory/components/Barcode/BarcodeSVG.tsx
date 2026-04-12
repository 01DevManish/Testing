"use client";

import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function BarcodeSVG({ value, height = 40, width = 2, fontSize = 20, showValue = false, displayHeight }: { value: string; height?: number; width?: number; fontSize?: number; showValue?: boolean; displayHeight?: string | number }) {
    const svgRef = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: "CODE128",
                    width: width,
                    height: height,
                    displayValue: showValue,
                    fontSize: fontSize,
                    margin: 0,
                    background: "#ffffff",
                    lineColor: "#000000"
                });
            } catch (e) {
                console.error("Barcode Generation Error", e);
            }
        }
    }, [value, height, width, fontSize, showValue]);

    return <svg ref={svgRef} style={{ height: displayHeight || "auto", maxWidth: "100%" }} />;
}
