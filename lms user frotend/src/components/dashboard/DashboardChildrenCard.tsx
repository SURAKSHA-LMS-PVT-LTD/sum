import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import type { ChildData } from '@/api/parents.api';
import { Users, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { getImageUrl } from '@/utils/imageUrlHelper';

const DashboardChildrenCard = () => {
  const { user, setSelectedChild } = useAuth();
  const navigate = useNavigate();
  const userRole = useInstituteRole();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = async (forceRefresh = false) => {
    if (!user?.id) return;
    try {
      const data = await enhancedCachedClient.get<any>(
        `/parents/${user.id}/children`,
        {},
        { ttl: CACHE_TTL.STUDENTS, forceRefresh, userId: user.id, role: userRole || 'Parent' }
      );
      setChildren(data?.children || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(false); }, [user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (error || (!loading && children.length === 0)) return null;

  const handleSelectChild = (child: ChildData) => {
    setSelectedChild({
      id: child.id,
      name: child.name,
      user: {
        firstName: child.name.split(' ')[0] || child.name,
        lastName: child.name.split(' ').slice(1).join(' ') || '',
        phoneNumber: child.phoneNumber,
      },
    } as any, true);
    navigate(`/child/${child.id}/select-institute`);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">My Children</h3>
            <p className="text-xs text-muted-foreground">{children.length} linked</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/my-children')}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View All <ChevronRight className="h-3 w-3" />
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Refresh children"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {children.slice(0, 4).map((child, index) => (
            <button
              key={`${child.id}-${index}`}
              onClick={() => handleSelectChild(child)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-accent/50 hover:border-primary/20 transition-all text-left active:scale-[0.98]"
            >
              <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-background">
                {child.imageUrl ? (
                  <img
                    src={getImageUrl(child.imageUrl)}
                    alt={child.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-sm">
                    {getInitials(child.name)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{child.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{child.relationship}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardChildrenCard;
