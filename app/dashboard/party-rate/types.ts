import type { UserRole } from "../../context/AuthContext";

export interface PartyDetails {
    companyName: string;
    traderName: string;
    address: string;
    state: string;
    district: string;
    pincode: string;
    contactNo: string;
    gstNo: string;
    panNo: string;
    adharNo: string;
    email: string;
}

export interface PartyRate {
    id: string;
    partyName: string;
    billTo?: PartyDetails;
    shipTo?: Omit<PartyDetails, "gstNo" | "panNo">;
    sameAsBillTo?: boolean;
    rates: { 
        productName: string; 
        sku?: string;
        rate: number;
        packagingType?: string;
        packagingCost?: number;
        discount?: number;
        discountType?: "amount" | "percentage";
        gstRate?: number;
    }[];
    transporter?: string;
    updatedAt: number;
}
