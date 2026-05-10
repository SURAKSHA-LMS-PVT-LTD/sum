/**
 * OrderDetailsDialog - View full order details
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  MapPin,
  Phone,
  FileText,
  Calendar,
  Clock,
  Truck,
  Hash,
  Wifi,
} from 'lucide-react';
import { UserIdCardOrder } from '@/api/userCard.api';
import {
  orderStatusColors,
  orderStatusLabels,
  cardStatusColors,
  cardStatusLabels,
  paymentStatusColors,
  paymentStatusLabels,
  formatDate,
  formatDateTime,
  formatPrice,
  getDaysUntilExpiry,
  isExpiringSoon,
} from '@/utils/cardHelpers';

interface OrderDetailsDialogProps {
  order: UserIdCardOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
}

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  order,
  open,
  onOpenChange,
  loading = false,
}) => {
  if (!order) return null;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Order #{order.id}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-28" />
            </div>

            <Separator />

            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const daysUntilExpiry = getDaysUntilExpiry(order.cardExpiryDate);
  const expiringSoon = isExpiringSoon(order.cardExpiryDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[93vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-tight">Order #{order.id}</p>
              <p className="text-base text-muted-foreground font-normal mt-1">Order Details</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5 pb-1">
            <Badge className={orderStatusColors[order.orderStatus]}>
              Order: {orderStatusLabels[order.orderStatus]}
            </Badge>
            <Badge className={cardStatusColors[order.status]}>
              Card: {cardStatusLabels[order.status]}
            </Badge>
            {order.payment && (
              <Badge className={paymentStatusColors[order.payment.paymentStatus]}>
                Payment: {paymentStatusLabels[order.payment.paymentStatus]}
              </Badge>
            )}
          </div>

          {/* Card Details */}
          <div className="flex items-center gap-2 pt-1">
            <p className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Card</p>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="divide-y divide-border/40">
            <div className="flex items-start gap-4 py-3.5">
              <span className="mt-0.5 text-muted-foreground/60 shrink-0"><CreditCard className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Card Name</p>
                <p className="text-base">{order.card?.cardName || 'Unknown'}</p>
              </div>
              <Badge variant="outline" className="text-xs px-2 py-0.5 shrink-0">{order.cardType}</Badge>
            </div>
            <div className="flex items-start gap-4 py-3.5">
              <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Hash className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Price</p>
                <p className="text-base font-semibold text-primary">{order.card ? formatPrice(order.card.price) : '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Validity</p>
                <p className="text-base">{order.card ? `${Math.floor(order.card.validityDays / 365)} year(s)` : '—'}</p>
              </div>
            </div>
          </div>

          {/* Order Info */}
          <div className="flex items-center gap-2 pt-1">
            <p className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Order Info</p>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="divide-y divide-border/40">
            <div className="flex items-start gap-4 py-3.5">
              <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Calendar className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Order Date</p>
                <p className="text-sm">{formatDateTime(order.orderDate)}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-3.5">
              <span className={`mt-0.5 shrink-0 ${expiringSoon ? 'text-orange-500' : 'text-muted-foreground/60'}`}><Clock className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] leading-none mb-1 ${expiringSoon ? 'text-orange-500' : 'text-muted-foreground'}`}>Card Expiry</p>
                <p className={`text-base ${expiringSoon ? 'font-medium text-orange-600 dark:text-orange-400' : ''}`}>
                  {formatDate(order.cardExpiryDate)}
                  {daysUntilExpiry > 0 && <span className="text-muted-foreground text-sm ml-1">({daysUntilExpiry}d)</span>}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-3.5">
              <span className="mt-0.5 text-muted-foreground/60 shrink-0"><MapPin className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Delivery Address</p>
                <p className="text-base">{order.deliveryAddress}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-3.5">
              <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Phone className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Contact</p>
                <p className="text-base">{order.contactPhone}</p>
              </div>
            </div>
            {order.notes && (
              <div className="flex items-start gap-4 py-3.5">
                <span className="mt-0.5 text-muted-foreground/60 shrink-0"><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Notes</p>
                  <p className="text-base">{order.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Tracking & RFID */}
          {(order.trackingNumber || order.rfidNumber) && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <p className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Tracking</p>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="divide-y divide-border/40">
                {order.trackingNumber && (
                  <div className="flex items-start gap-4 py-3.5">
                    <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Truck className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Tracking Number</p>
                      <p className="text-base font-mono">{order.trackingNumber}</p>
                    </div>
                  </div>
                )}
                {order.rfidNumber && (
                  <div className="flex items-start gap-4 py-3.5">
                    <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Wifi className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-muted-foreground leading-none mb-1.5">RFID</p>
                      <p className="text-base font-mono">{order.rfidNumber}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Payment Details */}
          {order.payment && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <p className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Payment</p>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="divide-y divide-border/40">
                <div className="flex items-start gap-4 py-3.5">
                  <span className="mt-0.5 text-muted-foreground/60 shrink-0"><CreditCard className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Type</p>
                    <p className="text-base">{order.payment.paymentType.replace('_', ' ')}</p>
                  </div>
                  <p className="text-base font-semibold text-primary shrink-0">{formatPrice(order.payment.paymentAmount)}</p>
                </div>
                {order.payment.paymentReference && (
                  <div className="flex items-start gap-4 py-3.5">
                    <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Hash className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Reference</p>
                      <p className="text-base font-mono">{order.payment.paymentReference}</p>
                    </div>
                  </div>
                )}
                {order.payment.verifiedAt && (
                  <div className="flex items-start gap-4 py-3.5">
                    <span className="mt-0.5 text-green-500/70 shrink-0"><Clock className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-green-600/80 dark:text-green-400/80 leading-none mb-1">Verified At</p>
                      <p className="text-base text-green-600 dark:text-green-400">{formatDateTime(order.payment.verifiedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
              {order.payment.rejectionReason && (
                <div className="flex items-start gap-3 py-3 px-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/40">
                  <span className="mt-0.5 text-red-500 shrink-0"><FileText className="h-5 w-5" /></span>
                  <div>
                    <p className="text-[13px] text-red-500/80 leading-none mb-1">Rejection Reason</p>
                    <p className="text-base text-red-600 dark:text-red-400">{order.payment.rejectionReason}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Alerts */}
          {order.rejectedReason && (
            <div className="flex items-start gap-3 py-3 px-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/40">
              <span className="mt-0.5 text-red-500 shrink-0"><FileText className="h-5 w-5" /></span>
              <div>
                <p className="text-[13px] text-red-500/80 leading-none mb-1">Order Rejected</p>
                <p className="text-base text-red-600 dark:text-red-400">{order.rejectedReason}</p>
              </div>
            </div>
          )}
          {order.deliveredAt && (
            <div className="flex items-start gap-3 py-3 px-4 rounded-xl bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/40">
              <span className="mt-0.5 text-green-500 shrink-0"><Truck className="h-5 w-5" /></span>
              <div>
                <p className="text-[13px] text-green-500/80 leading-none mb-1">Delivered</p>
                <p className="text-base text-green-600 dark:text-green-400">{formatDateTime(order.deliveredAt)}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;
