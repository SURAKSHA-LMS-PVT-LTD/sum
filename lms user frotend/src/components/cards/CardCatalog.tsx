/**
 * CardCatalog - Browse and order ID cards
 */

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, CreditCard, Package, Search, ShoppingCart } from 'lucide-react';
import { Card as CardType, CardType as CardTypeEnum, userCardApi } from '@/api/userCard.api';
import { toast } from '@/hooks/use-toast';
import { formatPrice } from '@/utils/cardHelpers';
import OrderCardDialog from './OrderCardDialog';
import { getErrorMessage } from '@/api/apiError';

const CardCatalog: React.FC = () => {
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cardTypeFilter, setCardTypeFilter] = useState<string>('all');
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (cardTypeFilter !== 'all') params.cardType = cardTypeFilter;

      const response = await userCardApi.getCards(params);
      setCards(response.data || []);
    } catch (error: any) {
      console.error('Error fetching cards:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to load cards'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [cardTypeFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCards();
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const handleOrderClick = (card: CardType) => {
    setSelectedCard(card);
    setOrderDialogOpen(true);
  };

  const getCardTypeBadgeClass = (type: CardTypeEnum) => {
    // Use only semantic tokens (no hard-coded colors)
    switch (type) {
      case CardTypeEnum.NFC:
        return 'bg-accent text-accent-foreground border border-border';
      case CardTypeEnum.PVC:
        return 'bg-secondary text-secondary-foreground border border-border';
      case CardTypeEnum.TEMPORARY:
        return 'bg-muted text-muted-foreground border border-border';
      default:
        return 'bg-muted text-foreground border border-border';
    }
  };

  const formatValidity = (validityDays: number) => {
    const years = Math.floor(validityDays / 365);
    if (years <= 0) return `${validityDays} day${validityDays === 1 ? '' : 's'}`;
    return `${years} year${years >= 2 ? 's' : ''}`;
  };

  return (
    <div className="space-y-8">
      {/* Header with Filters Below */}
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-foreground">ID Cards</h2>
          <p className="text-muted-foreground">Browse and order your ID cards</p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Card Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value={CardTypeEnum.NFC}>NFC Cards</SelectItem>
              <SelectItem value={CardTypeEnum.PVC}>PVC Cards</SelectItem>
              <SelectItem value={CardTypeEnum.TEMPORARY}>Temporary Cards</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-10 justify-items-center md:pt-8">
          {[1, 2, 3].map((i, index) => (
            <div
              key={i}
              className="relative flex w-full md:w-72 md:min-h-[360px] flex-row md:flex-col rounded-xl bg-card text-card-foreground shadow-sm md:shadow-md border border-border/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="relative w-24 md:w-auto md:mx-4 md:-mt-6 shrink-0 md:h-32 overflow-hidden md:rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
                <Skeleton className="h-full w-full" />
              </div>
              <div className="p-3 md:p-5 flex-1 space-y-2.5 flex flex-col justify-center">
                <Skeleton className="h-4 md:h-5 w-3/4" />
                <Skeleton className="h-3 md:h-3.5 w-full" />
                <Skeleton className="hidden md:block h-3.5 w-5/6" />
                <div className="pt-2 md:pt-3 space-y-2">
                  <Skeleton className="h-3 md:h-3.5 w-full" />
                  <Skeleton className="h-3 md:h-3.5 w-full" />
                </div>
              </div>
              <div className="hidden md:block p-5 pt-0">
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Card className="p-12 text-center mt-6">
          <div className="flex flex-col items-center gap-4">
            <CreditCard className="h-16 w-16 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No Cards Available</h3>
              <p className="text-muted-foreground">There are no cards available at the moment.</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-10 justify-items-center md:pt-8">
          {cards.map((card, index) => (
            <div
              key={card.id}
              className="relative flex w-full md:w-72 md:min-h-[360px] flex-row md:flex-col rounded-xl bg-card text-card-foreground shadow-sm md:shadow-md border border-border/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Image / top header */}
              <div className="relative w-24 md:w-auto md:mx-4 md:-mt-6 shrink-0 md:h-32 overflow-hidden md:rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground md:shadow-lg md:shadow-primary/20">
                {card.cardImageUrl ? (
                  <img
                    src={card.cardImageUrl}
                    alt={card.cardName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <CreditCard className="h-8 w-8 md:h-12 md:w-12 text-primary-foreground/70" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-3 md:p-5 flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1 md:mb-2">
                    <h3 className="text-base md:text-lg font-semibold leading-tight truncate md:whitespace-normal">
                      {card.cardName}
                    </h3>
                    <Badge className={`shrink-0 text-[10px] md:text-xs px-1.5 py-0 md:py-0.5 ${getCardTypeBadgeClass(card.cardType)}`}>
                      {card.cardType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 md:line-clamp-3 mb-2 md:mb-0">
                    {card.description || 'No description available'}
                  </p>
                </div>

                <div className="mt-auto md:mt-3 space-y-1 md:space-y-2 text-xs md:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="hidden md:inline">Validity</span>
                    </span>
                    <span className="font-medium">{formatValidity(card.validityDays)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Package className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="hidden md:inline">Available</span>
                    </span>
                    <span className="font-medium">{card.quantityAvailable}</span>
                  </div>

                  <div className="pt-2 md:pt-3 md:border-t border-border flex items-center justify-between md:block">
                    <span className="text-sm md:text-xl font-bold text-primary">{formatPrice(card.price)}</span>
                    <Button
                      size="sm"
                      className="md:hidden h-8 px-3"
                      onClick={() => handleOrderClick(card)}
                      disabled={card.quantityAvailable <= 0}
                    >
                      {card.quantityAvailable > 0 ? 'Order' : 'Out'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="hidden md:block p-5 pt-0">
                <Button
                  className="w-full"
                  onClick={() => handleOrderClick(card)}
                  disabled={card.quantityAvailable <= 0}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {card.quantityAvailable > 0 ? 'Order Now' : 'Out of Stock'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Dialog */}
      <OrderCardDialog
        card={selectedCard}
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        onSuccess={() => {
          setOrderDialogOpen(false);
          fetchCards();
        }}
      />
    </div>
  );
};

export default CardCatalog;

