import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { parentsApi, ParentChildrenResponse, ChildData } from '@/api/parents.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Users, RefreshCw, ChevronRight, Heart, Mail, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import PageContainer from '@/components/layout/PageContainer';
import AppLayout from '@/components/layout/AppLayout';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { EmptyState } from '@/components/ui/EmptyState';

const MyChildren = () => {
  const [childrenData, setChildrenData] = useState<ParentChildrenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, setSelectedChild } = useAuth();

  // Auto-load children on mount — use cache on first load
  useEffect(() => {
    if (user?.id && !childrenData) {
      handleLoadChildren(false);
    }
  }, [user?.id]);

  const handleLoadChildren = async (forceRefresh = false) => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User not logged in',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    try {
      const data = await (await import('@/api/enhancedCachedClient')).enhancedCachedClient.get<any>(
        `/parents/${user.id}/children`,
        {},
        { ttl: 60, forceRefresh, userId: user.id, role: 'Parent' }
      );
      setChildrenData(data);
    } catch (error: any) {
      console.error('Error loading children:', error);
      toast({
        title: 'Error',
        description: 'Failed to load children data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChild = (child: ChildData) => {
    // Set child with viewAsParent = true to enable view-only mode
    setSelectedChild({
      id: child.id,
      name: child.name,
      user: {
        firstName: child.name.split(' ')[0] || child.name,
        lastName: child.name.split(' ').slice(1).join(' ') || '',
        phoneNumber: child.phoneNumber
      }
    } as any, true); // viewAsParent = true
    
    // Navigate to child's institute selection page
    navigate(`/child/${child.id}/select-institute`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRelationshipColor = (relationship: string) => {
    switch (relationship.toLowerCase()) {
      case 'father':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'mother':
        return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';
      case 'guardian':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getRelationshipIcon = (relationship: string) => {
    return relationship.charAt(0).toUpperCase() + relationship.slice(1);
  };

  return (
    <AppLayout currentPage="my-children">
      <PageContainer>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">My Children</h1>
              <p className="text-muted-foreground text-sm">
                View and manage your children's information
              </p>
            </div>
            <Button 
              onClick={() => handleLoadChildren(true)} 
              disabled={loading}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {/* Parent Info */}
          {childrenData && (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                  {getInitials(childrenData.parentName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{childrenData.parentName}</span>
              <Badge variant="secondary" className="text-xs">Parent</Badge>
            </div>
          )}

          {/* Loading State */}
          {loading && !childrenData && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 rounded-2xl bg-muted" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-muted rounded w-3/4" />
                        <div className="h-4 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && childrenData?.children.length === 0 && (
            <EmptyState
              icon={Users}
              title="No Children Found"
              description="No children are linked to your account yet."
            />
          )}

          {/* Children Grid */}
          {childrenData && childrenData.children.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {childrenData.children.map((child, index) => (
                <Card 
                  key={`${child.id}-${child.relationship}-${index}`} 
                  className="group relative overflow-hidden border border-blue-400/50 bg-gradient-to-br from-card to-card/80 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Decorative gradient */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors" />
                  
                  <CardContent className="p-6 relative">
                    {/* Header with Avatar and Relationship Badge */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="h-20 w-20 rounded-full ring-4 ring-primary/10 group-hover:ring-primary/20 transition-all overflow-hidden flex-shrink-0">
                        {child.imageUrl || (child as any)?.user?.imageUrl ? (
                          <img 
                            src={getImageUrl(child.imageUrl || (child as any)?.user?.imageUrl)} 
                            alt={child.name} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-xl">
                            {getInitials(child.name)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <Badge variant="outline" className={`mb-2 text-xs font-medium ${getRelationshipColor(child.relationship)}`}>
                          <Heart className="h-3 w-3 mr-1" />
                          {getRelationshipIcon(child.relationship)}
                        </Badge>
                        <h3 className="text-lg font-bold text-foreground truncate">{child.name}</h3>
                      </div>
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-3 mb-5">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-foreground font-medium">{child.phoneNumber || 'No phone number'}</span>
                      </div>
                      {child.email && (
                        <div className="flex items-center gap-3 text-sm">
                          <div className="p-2 rounded-lg bg-muted/50">
                            <Mail className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-muted-foreground truncate">{child.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-muted-foreground">Child ID: {child.id.slice(0, 8)}...</span>
                      </div>
                    </div>

                    {/* Select Child Button */}
                    <Button 
                      onClick={() => handleSelectChild(child)}
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      size="lg"
                    >
                      <Sparkles className="h-4 w-4" />
                      Select Child
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
};

export default MyChildren;