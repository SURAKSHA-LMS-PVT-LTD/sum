import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageComponents";
import { DataTable, Column, CustomAction } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShoppingCart, ClipboardEdit, CreditCard, Tag } from "lucide-react";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { UpdateOrderStatusDialog } from "@/components/forms/UpdateOrderStatusDialog";
import { AssignOrderRfidDialog } from "@/components/forms/AssignOrderRfidDialog";
import { UpdateCardStatusDialog } from "@/components/forms/UpdateCardStatusDialog";
import { OrderStatus, CardStatus, CardType } from "@/lib/enums";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CardOrder {
  id: number;
  userId: number;
  cardId: number;
  cardType: string;
  paymentId: number | null;
  cardExpiryDate: string;
  status: string;
  orderStatus: string;
  rejectedReason: string | null;
  orderDate: string;
  deliveryAddress: string;
  contactPhone: string;
  notes: string | null;
  trackingNumber: string | null;
  rfidNumber: string | null;
  deliveredAt: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  card?: { id: number; cardName: string; cardType: string; price: number; };
  payment?: { id: number; paymentStatus: string; paymentAmount: number; };
}

interface OrderStatistics {
  totalOrders: number;
  pendingPayment: number;
  verified: number;
  delivered: number;
  activeCards: number;
  rejected: number;
}

const orderStatusColors: Record<string, string> = {
  PENDING_PAYMENT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  PAYMENT_RECEIVED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  VERIFYING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  VERIFIED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PREPARING: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  PRINTING: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  DELIVERING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ON_THE_WAY: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const cardStatusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  INACTIVE: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  DEACTIVATED: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  LOST: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  DAMAGED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  REPLACED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export default function CardOrdersPage() {
  const [orders, setOrders] = useState<CardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showRfidDialog, setShowRfidDialog] = useState(false);
  const [showCardStatusDialog, setShowCardStatusDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CardOrder | null>(null);
  const [statistics, setStatistics] = useState<OrderStatistics | null>(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [filters, setFilters] = useState({ orderStatus: "", cardStatus: "", cardType: "", search: "" });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (filters.orderStatus && filters.orderStatus !== "all") params.orderStatus = filters.orderStatus;
      if (filters.cardStatus && filters.cardStatus !== "all") params.cardStatus = filters.cardStatus;
      if (filters.cardType && filters.cardType !== "all") params.cardType = filters.cardType;
      if (filters.search) params.search = filters.search;

      const response = await api.getAdminCardOrders(params);
      setOrders(response.data || []);
      if (response.meta) {
        setPagination((prev) => ({ ...prev, total: response.meta.total, totalPages: response.meta.totalPages }));
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters.orderStatus, filters.cardStatus, filters.cardType, filters.search]);

  const fetchStatistics = async () => {
    try {
      const stats = await api.getOrderStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error("Failed to fetch statistics");
    }
  };

  useEffect(() => { fetchOrders(); fetchStatistics(); }, [fetchOrders]);

  const columns: Column[] = [
    { key: "id", label: "Order ID" },
    { key: "userId", label: "User ID" },
    { key: "card", label: "Card", render: (card: CardOrder["card"]) => card?.cardName || "-" },
    { key: "cardType", label: "Type", type: "badge" },
    { key: "orderStatus", label: "Order Status", render: (value: string) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${orderStatusColors[value] || ""}`}>{value?.replace(/_/g, " ")}</span>
    )},
    { key: "status", label: "Card Status", render: (value: string) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cardStatusColors[value] || ""}`}>{value}</span>
    )},
    { key: "rfidNumber", label: "RFID" },
    { key: "orderDate", label: "Order Date", type: "date" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Card Orders" description="Manage user ID card orders" icon={ShoppingCart}
        actions={<Button variant="outline" size="sm" onClick={() => { fetchOrders(); fetchStatistics(); }}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>}
      />

      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{statistics.totalOrders}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Payment</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{statistics.pendingPayment}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{statistics.verified}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{statistics.delivered}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Cards</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{statistics.activeCards}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{statistics.rejected}</div></CardContent></Card>
        </div>
      )}

      <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border">
        <div className="flex-1 min-w-[200px]"><Input placeholder="Search..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} /></div>
        <Select value={filters.orderStatus || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, orderStatus: value }))}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Order Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Order Status</SelectItem>{Object.values(OrderStatus).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.cardType || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, cardType: value }))}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Card Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem>{Object.values(CardType).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <DataTable 
        columns={columns} 
        data={orders} 
        isLoading={loading} 
        onView={(row) => { setSelectedOrder(row); setShowViewDialog(true); }}
        pagination={pagination} 
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))} 
        onLimitChange={(limit) => setPagination((prev) => ({ ...prev, limit, page: 1 }))}
        customActions={[
          {
            label: "Update Order Status",
            icon: <ClipboardEdit className="h-4 w-4" />,
            onClick: (row) => { setSelectedOrder(row); setShowStatusDialog(true); },
            show: () => true,
          },
          {
            label: "Assign RFID",
            icon: <Tag className="h-4 w-4" />,
            onClick: (row) => { setSelectedOrder(row); setShowRfidDialog(true); },
            // Always show actions for every order (do not depend on order status)
            show: () => true,
          },
          {
            label: "Update Card Status",
            icon: <CreditCard className="h-4 w-4" />,
            onClick: (row) => { setSelectedOrder(row); setShowCardStatusDialog(true); },
            // Always show actions for every order (do not depend on RFID presence)
            show: () => true,
          },
        ]}
      />

      {selectedOrder && (
        <>
          <ViewDetailsDialog open={showViewDialog} onOpenChange={setShowViewDialog} title="Order Details" data={selectedOrder} />
          <UpdateOrderStatusDialog open={showStatusDialog} onOpenChange={setShowStatusDialog} onSuccess={() => { fetchOrders(); fetchStatistics(); }} order={selectedOrder} />
          <AssignOrderRfidDialog open={showRfidDialog} onOpenChange={setShowRfidDialog} onSuccess={() => { fetchOrders(); fetchStatistics(); }} order={selectedOrder} />
          <UpdateCardStatusDialog open={showCardStatusDialog} onOpenChange={setShowCardStatusDialog} onSuccess={() => { fetchOrders(); fetchStatistics(); }} order={selectedOrder} />
        </>
      )}
      </div>
    </DashboardLayout>
  );
}
