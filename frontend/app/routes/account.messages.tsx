import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Mail, Clock, AlertCircle, MessageCircle, Bell, Archive, Search, Send
} from "lucide-react";
import { requireUserWithRedirect } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";
import { formatRelativeTime } from "../utils/date";

export const meta: MetaFunction = () => [
  { title: 'Ma messagerie | AutoMecanik' },
  { name: 'robots', content: 'noindex, nofollow' },
  { tagName: "link", rel: "canonical", href: "https://www.automecanik.com/account/messages" },
];

// Interface pour les messages (basée sur l'API backend)
interface Message {
  id: string;
  customer_id: number;
  type: 'system' | 'support' | 'notification';
  title: string;
  content: string;
  msg_open: boolean;  // true = ouvert, false = fermé
  msg_close: boolean; // true = lu, false = non lu
  created_at: string;
  updated_at: string;
}

interface MessageStats {
  total: number;
  open: number;
  closed: number;
  unread: number;
}

interface LoaderData {
  messages: Message[];
  stats: MessageStats;
  user: any;
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await requireUserWithRedirect({ request, context });
  
  const url = new URL(request.url);
  const filters = {
    status: url.searchParams.get("status") || "all",
    search: url.searchParams.get("search") || "",
    page: parseInt(url.searchParams.get("page") || "1"),
  };

  try {
    // Récupérer les messages de l'utilisateur via l'API
    const messagesResponse = await fetch(`http://localhost:3000/api/messages?customer=${user.id}&page=${filters.page}&status=${filters.status}`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    // Récupérer les statistiques via l'API
    const statsResponse = await fetch(`http://localhost:3000/api/messages/stats/overview?customer=${user.id}`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    const messagesResult = messagesResponse.ok ? await messagesResponse.json() : { success: false, data: [] };
    const statsResult = statsResponse.ok ? await statsResponse.json() : { success: false, data: { total: 0, open: 0, closed: 0, unread: 0 } };

    return json<LoaderData>({
      messages: messagesResult.success ? messagesResult.data : [],
      stats: statsResult.success ? statsResult.data : { total: 0, open: 0, closed: 0, unread: 0 },
      user,
    });
  } catch (error) {
    console.error('Erreur API messages:', error);
    
    return json<LoaderData>({
      messages: [],
      stats: { total: 0, open: 0, closed: 0, unread: 0 },
      user,
    });
  }
};

function MessageCard({ message }: { message: Message }) {
  const isUnread = !message.msg_close;
  const isSystem = message.type === 'system';
  
  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      isUnread ? 'bg-primary/5 border-blue-200' : 'bg-white'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className={`font-medium truncate ${
                isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'
              }`}>
                {message.title}
              </h3>
              {isUnread && (
                <Badge className="bg-info/20 text-info">
                  Nouveau
                </Badge>
              )}
              {isSystem && (
                <Badge className="bg-destructive/20 text-destructive">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Système
                </Badge>
              )}
              {message.type === 'support' && (
                <Badge className="bg-success/20 text-success">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  Support
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              Type: <span className="font-medium capitalize">{message.type}</span>
            </p>
            
            <p className={`text-sm text-gray-600 line-clamp-2 ${
              isUnread ? 'font-medium' : ''
            }`}>
              {message.content.length > 150 
                ? `${message.content.substring(0, 150)}...` 
                : message.content
              }
            </p>
            
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(message.created_at)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              {isUnread ? 'Marquer lu' : 'Voir'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SidebarItem({ 
  icon, 
  label, 
  count, 
  active, 
  href 
}: { 
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      to={href}
      className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
        active 
          ? 'bg-primary/10 text-primary' 
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center">
        {icon}
        <span className="ml-3 text-sm font-medium">{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <Badge className={active ? 'bg-info/20 text-info' : 'bg-gray-100 text-gray-600'}>
          {count}
        </Badge>
      )}
    </Link>
  );
}

export default function AccountMessages() {
  const { messages, stats, user } = useLoaderData<LoaderData>();

  const urgentMessages = messages.filter(m => m.type === 'system' && !m.msg_close);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="absolute top-4 left-4 z-10">
        <PublicBreadcrumb items={[
          { label: "Mon Compte", href: "/account" },
          { label: "Messagerie" }
        ]} />
      </div>
      
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Messagerie</h2>
              <p className="text-sm text-gray-600">Bonjour {user.email}</p>
            </div>
            <Link to="/account/messages/compose">
              <Button className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Nouveau message
              </Button>
            </Link>
          </div>
        </div>

        <nav className="space-y-1">
          <SidebarItem
            icon={<Mail className="w-4 h-4" />}
            label="Tous les messages"
            count={stats.total}
            active={true}
            href="/account/messages"
          />
          <SidebarItem
            icon={<Bell className="w-4 h-4" />}
            label="Non lus"
            count={stats.unread}
            active={false}
            href="/account/messages?status=unread"
          />
          <SidebarItem
            icon={<AlertCircle className="w-4 h-4" />}
            label="Système"
            count={messages.filter(m => m.type === 'system').length}
            active={false}
            href="/account/messages?status=system"
          />
          <SidebarItem
            icon={<MessageCircle className="w-4 h-4" />}
            label="Support"
            count={messages.filter(m => m.type === 'support').length}
            active={false}
            href="/account/messages?status=support"
          />
          <SidebarItem
            icon={<Archive className="w-4 h-4" />}
            label="Fermés"
            count={stats.closed}
            active={false}
            href="/account/messages?status=closed"
          />
        </nav>

        {/* Statistiques */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="font-medium">{stats.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Non lus:</span>
              <span className="font-medium text-blue-600">{stats.unread}</span>
            </div>
            <div className="flex justify-between">
              <span>Ouverts:</span>
              <span className="font-medium text-green-600">{stats.open}</span>
            </div>
            <div className="flex justify-between">
              <span>Fermés:</span>
              <span className="font-medium text-gray-600">{stats.closed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header avec recherche */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Mes Messages</h1>
            
            <div className="flex items-center space-x-4">
              <form method="get" className="flex items-center">
                <Input
                  name="search"
                  placeholder="Rechercher dans mes messages..."
                  className="w-64"
                />
                <Button type="submit" variant="outline" size="sm" className="ml-2">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Messages urgents */}
        {urgentMessages.length > 0 && (
          <div className="p-4">
            <Card className="border-destructive bg-destructive/10">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Messages Urgents ({urgentMessages.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {urgentMessages.slice(0, 2).map((message) => (
                  <div key={message.id} className="bg-white p-3 rounded-lg border border-red-200">
                    <h4 className="font-medium text-red-900">{message.title}</h4>
                    <p className="text-sm text-red-700 mt-1">
                      {message.content.substring(0, 100)}...
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Liste des messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucun message
                  </h3>
                  <p className="text-gray-600">
                    Vous n'avez encore reçu aucun message.
                  </p>
                </CardContent>
              </Card>
            ) : (
              messages.map((message) => (
                <MessageCard key={message.id} message={message} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
