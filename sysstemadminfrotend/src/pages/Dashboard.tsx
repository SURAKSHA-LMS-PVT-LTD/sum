import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/shared/PageComponents";
import { Users, Building2, BookOpen, Bus, CreditCard, MessageSquare, ShieldAlert, Smartphone, GraduationCap, Users2, Wallet, ClipboardCheck, Receipt, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  totalUsers: number;
  totalInstitutes: number;
  totalSubjects: number;
  totalTransport: number;
  totalStudents: number;
  totalParents: number;
  totalDevices: number;
  smsSent: number;
  pendingPayments: number;
  totalClasses: number;
  totalOrganizations: number;
  pendingCardOrders: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalInstitutes: 0,
    totalSubjects: 0,
    totalTransport: 0,
    totalStudents: 0,
    totalParents: 0,
    totalDevices: 0,
    smsSent: 0,
    pendingPayments: 0,
    totalClasses: 0,
    totalOrganizations: 0,
    pendingCardOrders: 0,
  });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [recentCardOrders, setRecentCardOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const results = await Promise.allSettled([
          api.getUsers({ page: 1, limit: 1 }),
          api.getInstitutes(1, 1),
          api.getSubjects({ page: 1, limit: 1 }),
          api.getAllBookhires({ page: 1, limit: 1 }),
          api.getStudents({ page: 1, limit: 1 }),
          api.getParents({ page: 1, limit: 1 }),
          api.getDevices({ page: 1, limit: 1 }),
          api.getSmsStatistics(),
          api.getPaymentsFiltered({ page: 1, limit: 5, status: 'PENDING' }),
          api.getInstituteClasses({ page: 1, limit: 1 }),
          api.getOrganizations({ page: 1, limit: 1 }),
          api.getAdminCardOrders({ page: 1, limit: 5, orderStatus: 'PENDING_PAYMENT' }),
        ]);

        const pendingPaymentsData = results[8].status === "fulfilled" ? results[8].value : null;
        const pendingOrdersData = results[11].status === "fulfilled" ? results[11].value : null;

        setStats({
          totalUsers: results[0].status === "fulfilled" ? (results[0].value?.total ?? results[0].value?.meta?.total ?? 0) : 0,
          totalInstitutes: results[1].status === "fulfilled" ? (results[1].value?.total ?? results[1].value?.meta?.total ?? 0) : 0,
          totalSubjects: results[2].status === "fulfilled" ? (results[2].value?.total ?? results[2].value?.meta?.total ?? 0) : 0,
          totalTransport: results[3].status === "fulfilled" ? (results[3].value?.total ?? results[3].value?.meta?.total ?? 0) : 0,
          totalStudents: results[4].status === "fulfilled" ? (results[4].value?.total ?? results[4].value?.meta?.total ?? 0) : 0,
          totalParents: results[5].status === "fulfilled" ? (results[5].value?.total ?? results[5].value?.meta?.total ?? 0) : 0,
          totalDevices: results[6].status === "fulfilled" ? (results[6].value?.total ?? results[6].value?.meta?.total ?? 0) : 0,
          smsSent: results[7].status === "fulfilled" ? (results[7].value?.totalSent ?? results[7].value?.sent ?? 0) : 0,
          pendingPayments: pendingPaymentsData?.total ?? 0,
          totalClasses: results[9].status === "fulfilled" ? (results[9].value?.total ?? results[9].value?.meta?.total ?? 0) : 0,
          totalOrganizations: results[10].status === "fulfilled" ? (results[10].value?.total ?? results[10].value?.meta?.total ?? 0) : 0,
          pendingCardOrders: pendingOrdersData?.total ?? 0,
        });

        if (pendingPaymentsData?.payments) {
          setRecentPayments(pendingPaymentsData.payments.slice(0, 5));
        }
        if (pendingOrdersData?.orders || pendingOrdersData?.data) {
          setRecentCardOrders((pendingOrdersData.orders || pendingOrdersData.data || []).slice(0, 5));
        }
      } catch {
        // Stats stay at 0
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome to your admin panel</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Card key={i} className="shadow-soft">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome to your admin panel</p>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <StatsCard title="Total Users" value={stats.totalUsers.toLocaleString()} icon={Users} />
          <StatsCard title="Institutes" value={stats.totalInstitutes.toLocaleString()} icon={Building2} />
          <StatsCard title="Subjects" value={stats.totalSubjects.toLocaleString()} icon={BookOpen} />
          <StatsCard title="Classes" value={stats.totalClasses.toLocaleString()} icon={ClipboardCheck} />
          <StatsCard title="Students" value={stats.totalStudents.toLocaleString()} icon={GraduationCap} />
          <StatsCard title="Parents" value={stats.totalParents.toLocaleString()} icon={Users2} />
          <StatsCard title="Organizations" value={stats.totalOrganizations.toLocaleString()} icon={Building2} />
          <StatsCard title="Transport Routes" value={stats.totalTransport.toLocaleString()} icon={Bus} />
          <StatsCard title="Devices" value={stats.totalDevices.toLocaleString()} icon={Smartphone} />
          <StatsCard title="SMS Sent" value={stats.smsSent.toLocaleString()} icon={MessageSquare} />
          <StatsCard title="Pending Payments" value={stats.pendingPayments.toLocaleString()} icon={Wallet} />
          <StatsCard title="Pending Card Orders" value={stats.pendingCardOrders.toLocaleString()} icon={CreditCard} />
        </div>

        {/* Quick Action Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Pending Payments */}
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-yellow-500" />
                  Pending Payments
                </CardTitle>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  {stats.pendingPayments}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {recentPayments.length > 0 ? (
                <div className="space-y-3">
                  {recentPayments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">User: {p.userId}</p>
                        <p className="text-xs text-muted-foreground">{p.paymentMonth || new Date(p.paymentDate).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm font-semibold">Rs. {Number(p.paymentAmount).toLocaleString()}</p>
                        <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700">{p.paymentMethod}</Badge>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => navigate('/dashboard/system-payment')}
                    className="w-full text-sm text-primary hover:underline pt-2"
                  >
                    View all payments →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No pending payments</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Card Orders */}
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                  Recent Card Orders
                </CardTitle>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {stats.pendingCardOrders}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {recentCardOrders.length > 0 ? (
                <div className="space-y-3">
                  {recentCardOrders.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Order #{o.id} - User: {o.userId}</p>
                        <p className="text-xs text-muted-foreground">{o.card?.cardName || o.cardType || 'Card'}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{o.orderStatus}</Badge>
                    </div>
                  ))}
                  <button
                    onClick={() => navigate('/dashboard/card-orders')}
                    className="w-full text-sm text-primary hover:underline pt-2"
                  >
                    View all orders →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No pending card orders</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
