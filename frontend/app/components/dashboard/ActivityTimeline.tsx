import { Clock, User, ShoppingBag, Package, CheckCircle } from "lucide-react";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface Activity {
  id: string;
  type: 'order' | 'message' | 'profile' | 'shipping' | 'payment';
  title: string;
  description: string;
  timestamp: string;
  status?: 'success' | 'pending' | 'error';
}

interface ActivityTimelineProps {
  activities: Activity[];
  enhanced?: boolean;
}

const ActivityIcon = ({ type, status }: { type: Activity['type']; status?: Activity['status'] }) => {
  const iconMap = {
    order: ShoppingBag,
    message: User,
    profile: User,
    shipping: Package,
    payment: CheckCircle
  };

  const IconComponent = iconMap[type];
  
  return (
    <div className={cn(
      "flex h-8 w-8 items-center justify-center rounded-full",
      status === 'success' && "bg-green-100 text-green-600",
      status === 'pending' && "bg-yellow-100 text-yellow-600",
      status === 'error' && "bg-red-100 text-red-600",
      !status && "bg-gray-100 text-gray-600"
    )}>
      <IconComponent className="h-4 w-4" />
    </div>
  );
};

const ActivityItem = ({ activity, enhanced = false }: { activity: Activity; enhanced?: boolean }) => (
  <div className="flex gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
    <ActivityIcon type={activity.type} status={activity.status} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900 truncate">
          {activity.title}
        </p>
        {enhanced && activity.status && (
          <Badge 
            variant={
              activity.status === 'success' ? 'default' : 
              activity.status === 'pending' ? 'secondary' : 
              'destructive'
            }
            className="text-xs"
          >
            {activity.status}
          </Badge>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {activity.description}
      </p>
      <div className="flex items-center text-xs text-gray-400 mt-1">
        <Clock className="h-3 w-3 mr-1" />
        {activity.timestamp}
      </div>
    </div>
  </div>
);

export function ActivityTimeline({ activities, enhanced = false }: ActivityTimelineProps) {
  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune activité récente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          Activité récente
          {enhanced && (
            <Badge variant="secondary" className="ml-2">
              {activities.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className={cn(
          "divide-y divide-gray-100",
          enhanced && "max-h-96 overflow-y-auto"
        )}>
          {activities.map((activity) => (
            <ActivityItem 
              key={activity.id} 
              activity={activity} 
              enhanced={enhanced}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
