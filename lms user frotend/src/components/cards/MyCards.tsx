/**
 * MyCards - View and manage my active/deactivated cards with Card/Table view modes
 */

import React, { useState, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import MuiTable from '@mui/material/Table';
import MuiTableBody from '@mui/material/TableBody';
import MuiTableCell from '@mui/material/TableCell';
import MuiTableContainer from '@mui/material/TableContainer';
import MuiTableHead from '@mui/material/TableHead';
import MuiTableRow from '@mui/material/TableRow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CreditCard,
  MoreVertical,
  AlertTriangle,
  Ban,
  Wifi,
  Calendar,
  RefreshCw,
  CheckCircle,
  LayoutGrid,
  Table2,
} from 'lucide-react';
import {
  userCardApi,
  UserIdCardOrder,
  CardStatus,
  PaginatedOrdersResponse,
} from '@/api/userCard.api';
import {
  cardStatusColors,
  cardStatusLabels,
  formatDate,
  formatPrice,
  getDaysUntilExpiry,
  isExpiringSoon,
} from '@/utils/cardHelpers';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/api/apiError';
import { useAuth } from '@/contexts/AuthContext';

const MyCards: React.FC = () => {
  const { selectedChild, isViewingAsParent } = useAuth();
  const forUserId = isViewingAsParent && selectedChild ? (selectedChild.userId || selectedChild.id) : undefined;
  const [cards, setCards] = useState<UserIdCardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<UserIdCardOrder | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<CardStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    return (localStorage.getItem('viewMode') as 'card' | 'table') || 'card';
  });

  // Listen for viewMode changes from Settings
  useEffect(() => {
    const handleStorageChange = () => {
      const mode = (localStorage.getItem('viewMode') as 'card' | 'table') || 'card';
      setViewMode(mode);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchCards = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await userCardApi.getMyCards({}, forceRefresh, forUserId);
      setCards(response.data || []);
    } catch (error: any) {
      console.error('Error fetching cards:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to load cards'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [forUserId]);

  const handleAction = (card: UserIdCardOrder, status: CardStatus) => {
    setSelectedCard(card);
    setActionType(status);
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedCard || !actionType) return;

    try {
      setActionLoading(true);
      await userCardApi.updateMyCardStatus(selectedCard.id, {
        status: actionType,
        notes: `Card reported as ${actionType.toLowerCase()} by user`,
      });

      toast({
        title: 'Card Status Updated',
        description: `Your card has been marked as ${actionType.toLowerCase()}.`,
      });

      fetchCards(true);
    } catch (error: any) {
      console.error('Error updating card status:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update card status'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
      setActionDialogOpen(false);
      setSelectedCard(null);
      setActionType(null);
    }
  };

  const getActionLabel = (status: CardStatus) => {
    switch (status) {
      case CardStatus.LOST:
        return 'Report Lost';
      case CardStatus.DAMAGED:
        return 'Report Damaged';
      case CardStatus.DEACTIVATED:
        return 'Deactivate';
      default:
        return 'Update';
    }
  };

  const getActionDescription = (status: CardStatus) => {
    switch (status) {
      case CardStatus.LOST:
        return 'This will deactivate your card and mark it as lost. You may need to order a replacement.';
      case CardStatus.DAMAGED:
        return 'This will mark your card as damaged. You may need to order a replacement.';
      case CardStatus.DEACTIVATED:
        return 'This will deactivate your card. You can reactivate it later by contacting support.';
      default:
        return 'Are you sure you want to update this card?';
    }
  };

  const renderActionsDropdown = (card: UserIdCardOrder) => {
    const isActive = card.status === CardStatus.ACTIVE;
    if (!isActive) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleAction(card, CardStatus.LOST)} className="text-red-600">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Lost
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction(card, CardStatus.DAMAGED)} className="text-orange-600">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Damaged
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction(card, CardStatus.DEACTIVATED)} className="text-gray-600">
            <Ban className="h-4 w-4 mr-2" />
            Deactivate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderCardView = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 justify-items-center">
          {[1, 2].map((i, index) => (
            <Card key={i} className="w-full max-w-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards" style={{ animationDelay: `${index * 100}ms` }}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (cards.length === 0) {
      return (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <CreditCard className="h-16 w-16 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No Cards Yet</h3>
              <p className="text-muted-foreground">You don't have any active or delivered cards yet.</p>
            </div>
          </div>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 justify-items-center">
        {cards.map((card, index) => {
          const daysUntilExpiry = getDaysUntilExpiry(card.cardExpiryDate);
          const expiringSoon = isExpiringSoon(card.cardExpiryDate);
          const isActive = card.status === CardStatus.ACTIVE;

          return (
            <div
              key={card.id}
              className={`relative flex w-full max-w-[320px] flex-col rounded-xl bg-card text-card-foreground shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards ${!isActive ? 'opacity-75' : ''}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Raised gradient header */}
              <div className={`relative mx-4 -mt-6 h-36 overflow-hidden rounded-xl bg-clip-border shadow-lg flex items-center justify-center ${
                isActive
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-500/40'
                  : 'bg-gradient-to-r from-gray-400 to-gray-500 shadow-gray-500/30'
              }`}>
                <CreditCard className="h-16 w-16 text-white/80" />
                <div className="absolute top-3 right-3">
                  {renderActionsDropdown(card)}
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                <h5 className="mb-1 font-sans text-lg font-semibold leading-snug tracking-normal antialiased">
                  {card.card?.cardName || 'ID Card'}
                </h5>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px]">{card.cardType}</Badge>
                  <Badge className={`${cardStatusColors[card.status]} flex items-center gap-1 text-[10px] px-1.5 py-0`}>
                    {isActive ? <CheckCircle className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                    {cardStatusLabels[card.status]}
                  </Badge>
                </div>
                {card.rfidNumber && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                    <Wifi className="h-3.5 w-3.5" />
                    <span className="font-mono">{card.rfidNumber}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className={expiringSoon ? 'text-orange-500 font-medium' : ''}>
                    Expires: {formatDate(card.cardExpiryDate)}
                    {daysUntilExpiry > 0 && daysUntilExpiry <= 30 && (
                      <span className="ml-1">({daysUntilExpiry} days)</span>
                    )}
                  </span>
                </div>
                {card.deliveredAt && (
                  <div className="text-xs text-muted-foreground">
                    Delivered: {formatDate(card.deliveredAt)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTableView = () => {
    if (loading) {
      return (
        <Paper sx={{ width: '100%', overflow: 'hidden', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}>
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </Paper>
      );
    }

    if (cards.length === 0) {
      return (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <CreditCard className="h-16 w-16 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No Cards Yet</h3>
              <p className="text-muted-foreground">You don't have any active or delivered cards yet.</p>
            </div>
          </div>
        </Card>
      );
    }

    const cellSx = { color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))' };

    return (
      <Paper sx={{ width: '100%', overflow: 'hidden', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}>
        <MuiTableContainer sx={{ maxHeight: 440, overflow: 'auto' }}>
          <MuiTable stickyHeader aria-label="cards table">
            <MuiTableHead>
              <MuiTableRow>
                {['Card Name', 'Type', 'Status', 'RFID', 'Expiry', 'Delivered', 'Actions'].map((col) => (
                  <MuiTableCell
                    key={col}
                    sx={{
                      backgroundColor: 'hsl(var(--muted))',
                      color: 'hsl(var(--foreground))',
                      fontWeight: 'bold',
                      borderBottom: '1px solid hsl(var(--border))',
                    }}
                    align={col === 'Actions' ? 'right' : 'left'}
                  >
                    {col}
                  </MuiTableCell>
                ))}
              </MuiTableRow>
            </MuiTableHead>
            <MuiTableBody>
              {cards.map((card) => {
                const isActive = card.status === CardStatus.ACTIVE;
                const expiringSoon = isExpiringSoon(card.cardExpiryDate);
                const daysUntilExpiry = getDaysUntilExpiry(card.cardExpiryDate);
                return (
                  <MuiTableRow hover key={card.id} sx={{ '&:hover': { backgroundColor: 'hsl(var(--muted) / 0.5)' }, opacity: isActive ? 1 : 0.75 }}>
                    <MuiTableCell sx={cellSx}>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{card.card?.cardName || 'ID Card'}</span>
                      </div>
                    </MuiTableCell>
                    <MuiTableCell sx={cellSx}>
                      <Badge variant="outline" className="text-xs">{card.cardType}</Badge>
                    </MuiTableCell>
                    <MuiTableCell sx={cellSx}>
                      <Badge className={`${cardStatusColors[card.status]} flex items-center gap-1 w-fit`}>
                        {isActive ? <CheckCircle className="h-3 w-3" /> : <Ban className="h-3 w-3" />}{cardStatusLabels[card.status]}
                      </Badge>
                    </MuiTableCell>
                    <MuiTableCell sx={cellSx}>
                      {card.rfidNumber ? (
                        <span className="font-mono text-xs">{card.rfidNumber}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </MuiTableCell>
                    <MuiTableCell sx={cellSx}>
                      <span className={expiringSoon ? 'text-orange-500 font-medium' : ''}>
                        {formatDate(card.cardExpiryDate)}
                        {daysUntilExpiry > 0 && daysUntilExpiry <= 30 && (
                          <span className="text-xs ml-1">({daysUntilExpiry}d)</span>
                        )}
                      </span>
                    </MuiTableCell>
                    <MuiTableCell sx={cellSx}>
                      {card.deliveredAt ? formatDate(card.deliveredAt) : '-'}
                    </MuiTableCell>
                    <MuiTableCell align="right" sx={cellSx}>
                      {renderActionsDropdown(card)}
                    </MuiTableCell>
                  </MuiTableRow>
                );
              })}
            </MuiTableBody>
          </MuiTable>
        </MuiTableContainer>
      </Paper>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Cards</h2>
          <p className="text-muted-foreground">View and manage your ID cards</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Card View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Table View"
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCards(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'card' ? renderCardView() : renderTableView()}

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType ? getActionLabel(actionType) : 'Update Card'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType ? getActionDescription(actionType) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyCards;
