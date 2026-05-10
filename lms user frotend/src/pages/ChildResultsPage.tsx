import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Clock } from 'lucide-react';

const ChildResultsPage = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Exam Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">This Feature Coming Soon</h3>
          <p className="text-muted-foreground max-w-sm">
            We're working hard to bring you this feature. Please check back later.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChildResultsPage;
