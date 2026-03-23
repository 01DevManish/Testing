import { pgTable, text, timestamp, json, boolean, decimal } from "drizzle-orm/pg-core";

// Users / Employees table (to map who did what)
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Firebase User ID or Custom
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("employee"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Main Orders table
export const orders = pgTable("orders", {
  id: text("id").primaryKey(), // e.g., ORD-1001
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  paymentStatus: text("payment_status").notNull(), // "Paid" | "COD"
  status: text("status").notNull().default("Pending"), // Pending, Packed, Dispatched, In Transit, Delivered
  shippingType: text("shipping_type"), // Air / Surface
  courierPartner: text("courier_partner"),
  trackingId: text("tracking_id"),
  dispatchDate: text("dispatch_date"),
  packedNotes: text("packed_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order Products table
export const orderProducts = pgTable("order_products", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productName: text("product_name").notNull(),
  quantity: decimal("quantity").notNull(),
  price: decimal("price").notNull(),
  isPacked: boolean("is_packed").default(false),
});

// Logs table to track status timeline
export const dispatchLogs = pgTable("dispatch_logs", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: text("status").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  note: text("note"),
  timestamp: timestamp("timestamp").defaultNow(),
});
