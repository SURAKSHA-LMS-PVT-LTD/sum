import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageComponents";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, CreditCard } from "lucide-react";
import { CreateCardForm } from "@/components/forms/CreateCardForm";
import { UpdateCardForm } from "@/components/forms/UpdateCardForm";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { CardType } from "@/lib/enums";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Card {
  id: number;
  cardName: string;
  cardType: string;
  cardImageUrl: string | null;
  cardVideoUrl: string | null;
  description: string | null;
  price: number;
  quantityAvailable: number;
  validityDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CardManagementPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    cardType: "",
    isActive: "all",
    search: "",
  });

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (filters.cardType && filters.cardType !== "all") {
        params.cardType = filters.cardType;
      }
      if (filters.isActive !== "all") {
        params.isActive = filters.isActive === "true";
      }
      if (filters.search) {
        params.search = filters.search;
      }

      const response = await api.getAdminCards(params);
      setCards(response.data || []);
      if (response.meta) {
        setPagination((prev) => ({
          ...prev,
          total: response.meta.total,
          totalPages: response.meta.totalPages,
        }));
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch cards");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters.cardType, filters.isActive, filters.search]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleView = (card: Card) => {
    setSelectedCard(card);
    setShowViewDialog(true);
  };

  const handleEdit = (card: Card) => {
    setSelectedCard(card);
    setShowUpdateForm(true);
  };

  const handleDelete = async (card: Card) => {
    if (!confirm(`Are you sure you want to delete "${card.cardName}"?`)) return;
    try {
      await api.deleteCard(card.id);
      toast.success("Card deleted successfully");
      fetchCards();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete card");
    }
  };

  const columns: Column[] = [
    { key: "cardImageUrl", label: "Image", type: "image" },
    { key: "id", label: "ID" },
    { key: "cardName", label: "Card Name" },
    { key: "cardType", label: "Type", type: "badge" },
    { key: "price", label: "Price", type: "currency" },
    { key: "quantityAvailable", label: "Quantity" },
    { key: "validityDays", label: "Validity (Days)" },
    {
      key: "isActive",
      label: "Status",
      type: "badge",
      render: (value: boolean) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            value
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}
        >
          {value ? "Active" : "Inactive"}
        </span>
      ),
    },
    { key: "createdAt", label: "Created", type: "date" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
        title="Card Management"
        description="Manage NFC, PVC, and Temporary ID cards"
        icon={CreditCard}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchCards}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search cards..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <Select
          value={filters.cardType || "all"}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, cardType: value }))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Card Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.values(CardType).map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.isActive}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, isActive: value }))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={cards}
        isLoading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        onLimitChange={(limit) => setPagination((prev) => ({ ...prev, limit, page: 1 }))}
      />

      <CreateCardForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onSuccess={fetchCards}
      />

      {selectedCard && (
        <>
          <UpdateCardForm
            open={showUpdateForm}
            onOpenChange={setShowUpdateForm}
            onSuccess={fetchCards}
            card={selectedCard}
          />
          <ViewDetailsDialog
            open={showViewDialog}
            onOpenChange={setShowViewDialog}
            title="Card Details"
            data={selectedCard}
            imageKey="cardImageUrl"
          />
        </>
      )}
      </div>
    </DashboardLayout>
  );
}
