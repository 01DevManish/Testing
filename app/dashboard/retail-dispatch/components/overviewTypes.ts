import type { ActiveView, OrderStatus, PackingList } from "../types";

export interface RetailDispatchOverviewStats {
  todayPacking: number;
  todayDispatch: number;
  totalDispatch: number;
  pending: number;
}

export interface RetailDispatchOverviewProps {
  stats: RetailDispatchOverviewStats;
  statsDate: string;
  searchQuery: string;
  dispatches: PackingList[];
  canCreatePacking: boolean;
  canCreateDispatch: boolean;
  canViewDispatch: boolean;
  canViewBox: boolean;
  onStatsDateChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  onNavigate: (view: ActiveView) => void;
  onOrderStatusNavigate: (status: OrderStatus | "All") => void;
}
