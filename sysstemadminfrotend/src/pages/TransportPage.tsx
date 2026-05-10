import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { Bus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TransportPage() {
  const { toast } = useToast();
  const [bookhires, setBookhires] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBookhire, setSelectedBookhire] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState("");

  useEffect(() => {
    fetchBookhires();
  }, [page, limit]);

  const fetchBookhires = async () => {
    try {
      setIsLoading(true);
      const response = await api.getAllBookhires({ page, limit });
      setBookhires(response.data || []);
      if (response.meta) {
        setPagination({
          page: response.meta.page,
          limit: response.meta.limit,
          total: response.meta.total,
          totalPages: response.meta.totalPages,
          hasNextPage: response.meta.hasNextPage,
          hasPreviousPage: response.meta.hasPreviousPage,
        });
      }
    } catch (error) {
      console.error("Failed to fetch bookhires:", error);
      toast({ title: "Error", description: "Failed to load transport services", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (bookhire: any) => {
    setSelectedBookhire(bookhire);
    setViewDialogOpen(true);
  };

  const handleVehicleSearch = async () => {
    if (!vehicleSearch.trim()) return;
    try {
      const res = await api.getBookhireByVehicle(vehicleSearch.trim());
      if (res) {
        setSelectedBookhire(res);
        setViewDialogOpen(true);
      }
    } catch {
      toast({ title: "Not Found", description: "No bookhire found for that vehicle number", variant: "destructive" });
    }
  };

  const columns: Column[] = [
    { key: "id", label: "ID" },
    { key: "vehicleNumber", label: "Vehicle Number" },
    { key: "ownerName", label: "Owner" },
    { key: "route", label: "Route", render: (val: any) => val || "-" },
    { key: "capacity", label: "Capacity", render: (val: any) => val ?? "-" },
    {
      key: "status",
      label: "Status",
      type: "badge",
      render: (val: string) => {
        const colors: Record<string, string> = {
          APPROVED: "bg-green-100 text-green-800",
          PENDING: "bg-yellow-100 text-yellow-800",
          REJECTED: "bg-red-100 text-red-800",
          ACTIVE: "bg-green-100 text-green-800",
        };
        return <Badge className={colors[val] || "bg-muted"}>{val || "UNKNOWN"}</Badge>;
      },
    },
    { key: "createdAt", label: "Created", render: (val: string) => val ? new Date(val).toLocaleDateString() : "-" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Transport"
        description="Manage private transport (bookhire) services"
        icon={Bus}
      />

      {/* Vehicle Search */}
      <Card className="shadow-soft mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-4 h-4" />
            Search by Vehicle Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter vehicle number..."
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVehicleSearch()}
              className="max-w-sm"
            />
            <Button onClick={handleVehicleSearch} variant="outline">Search</Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={bookhires}
        isLoading={isLoading}
        onView={handleView}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      {selectedBookhire && (
        <ViewDetailsDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          title="Transport Service Details"
          data={selectedBookhire}
        />
      )}
    </DashboardLayout>
  );
}
