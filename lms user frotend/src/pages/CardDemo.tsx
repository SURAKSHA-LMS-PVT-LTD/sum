import React from 'react';
import { ArrowLeft, Heart, Star, Zap, Users, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AnimatedCard from '@/components/ui/animated-card';
import { Button } from '@/components/ui/button';

const CardDemo: React.FC = () => {
  const navigate = useNavigate();

  const handleCardClick = (cardType: string) => {
    console.log(`${cardType} card clicked!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Animated Cards Demo</h1>
            <p className="text-muted-foreground mt-1">Beautiful, responsive cards for web and mobile</p>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
          {/* Default Card */}
          <AnimatedCard
            title="Default Card"
            description="This is the default blue variant with a warning icon and smooth animations."
            buttonText="Explore"
            onClick={() => handleCardClick('Default')}
          />

          {/* Warning Card */}
          <AnimatedCard
            title="Warning Alert"
            description="Important notifications and alerts with amber gradient styling."
            buttonText="Review"
            variant="warning"
            onClick={() => handleCardClick('Warning')}
          />

          {/* Success Card */}
          <AnimatedCard
            title="Success Story"
            description="Celebrate achievements and completed tasks with this green variant."
            buttonText="Continue"
            variant="success"
            icon={<Star className="w-20 h-20 text-white/90 transform transition-transform group-hover:scale-110 duration-300" />}
            onClick={() => handleCardClick('Success')}
          />

          {/* Info Card */}
          <AnimatedCard
            title="Information Hub"
            description="Share important updates and information with the cyan variant."
            buttonText="Learn More"
            variant="info"
            icon={<Zap className="w-20 h-20 text-white/90 transform transition-transform group-hover:scale-110 duration-300" />}
            onClick={() => handleCardClick('Info')}
          />

          {/* Custom Icon Cards */}
          <AnimatedCard
            title="Team Management"
            description="Manage your team members, roles, and permissions efficiently."
            buttonText="Manage Team"
            variant="default"
            icon={<Users className="w-20 h-20 text-white/90 transform transition-transform group-hover:scale-110 duration-300" />}
            onClick={() => handleCardClick('Team')}
          />

          <AnimatedCard
            title="Learning Center"
            description="Access educational resources, courses, and learning materials."
            buttonText="Start Learning"
            variant="success"
            icon={<BookOpen className="w-20 h-20 text-white/90 transform transition-transform group-hover:scale-110 duration-300" />}
            onClick={() => handleCardClick('Learning')}
          />

          <AnimatedCard
            title="Favorite Features"
            description="Discover and bookmark your most-used features and tools."
            buttonText="View Favorites"
            variant="warning"
            icon={<Heart className="w-20 h-20 text-white/90 transform transition-transform group-hover:scale-110 duration-300" />}
            onClick={() => handleCardClick('Favorites')}
          />

          <AnimatedCard
            title="Performance Boost"
            description="Optimize your workflow with advanced performance features."
            buttonText="Boost Now"
            variant="info"
            icon={<Zap className="w-20 h-20 text-white/90 transform transition-transform group-hover:scale-110 duration-300" />}
            onClick={() => handleCardClick('Performance')}
          />
        </div>

        {/* Mobile-specific information */}
        <div className="mt-12 p-6 rounded-xl bg-card border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4">Mobile Ready</h2>
          <p className="text-muted-foreground mb-4">
            These cards are fully responsive and optimized for mobile devices. With Capacitor integration, 
            they work seamlessly across web, iOS, and Android platforms.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-muted">
              <h3 className="font-medium text-foreground mb-2">🌐 Web Features</h3>
              <ul className="text-muted-foreground space-y-1">
                <li>• Smooth hover animations</li>
                <li>• Gradient backgrounds</li>
                <li>• Responsive grid layout</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <h3 className="font-medium text-foreground mb-2">📱 Mobile Features</h3>
              <ul className="text-muted-foreground space-y-1">
                <li>• Touch-optimized interactions</li>
                <li>• Native app integration</li>
                <li>• Adaptive layouts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDemo;