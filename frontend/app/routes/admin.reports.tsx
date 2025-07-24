/**
 * Page Rapports - Analyses et rapports
 */

import  { type LoaderFunction , json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { BarChart3, TrendingUp, Download, Eye, Calendar, PieChart } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export const loader: LoaderFunction = async () => {
  // Simulation de données rapports
  const reports = [
    { 
      id: 1, 
      name: "Ventes Mensuelles", 
      type: "sales", 
      period: "Janvier 2025", 
      status: "ready", 
      generated: "2025-01-21",
      size: "2.3 MB",
      format: "PDF"
    },
    { 
      id: 2, 
      name: "Analyse Utilisateurs", 
      type: "users", 
      period: "Décembre 2024", 
      status: "generating", 
      generated: "En cours...",
      size: "~1.8 MB",
      format: "Excel"
    },
    { 
      id: 3, 
      name: "Performance Paiements", 
      type: "payments", 
      period: "Q4 2024", 
      status: "ready", 
      generated: "2025-01-20",
      size: "4.1 MB",
      format: "PDF"
    },
    { 
      id: 4, 
      name: "Rapport d'Activité", 
      type: "activity", 
      period: "2024", 
      status: "scheduled", 
      generated: "31 Jan 2025",
      size: "~5.2 MB",
      format: "PDF"
    },
  ];

  const analytics = {
    totalReports: reports.length,
    readyReports: reports.filter(r => r.status === 'ready').length,
    generatingReports: reports.filter(r => r.status === 'generating').length,
    scheduledReports: reports.filter(r => r.status === 'scheduled').length,
  };
  
  return json({ reports, analytics });
};

export default function AdminReports() {
  const { reports, analytics } = useLoaderData<typeof loader>();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'default';
      case 'generating': return 'secondary';
      case 'scheduled': return 'outline';
      default: return 'secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sales': return <TrendingUp className="h-4 w-4" />;
      case 'users': return <Eye className="h-4 w-4" />;
      case 'payments': return <BarChart3 className="h-4 w-4" />;
      case 'activity': return <PieChart className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Analyses & Rapports
          </h1>
          <p className="text-muted-foreground">
            Générez et consultez vos rapports d'analyse détaillés
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Nouveau Rapport
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rapports</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalReports}</div>
            <p className="text-xs text-muted-foreground">Tous types confondus</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prêts</CardTitle>
            <div className="h-2 w-2 bg-green-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.readyReports}</div>
            <p className="text-xs text-muted-foreground">Disponibles au téléchargement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Cours</CardTitle>
            <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.generatingReports}</div>
            <p className="text-xs text-muted-foreground">Génération en cours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programmés</CardTitle>
            <div className="h-2 w-2 bg-blue-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.scheduledReports}</div>
            <p className="text-xs text-muted-foreground">À venir</p>
          </CardContent>
        </Card>
      </div>

      {/* Types de rapports disponibles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="text-center">
            <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <CardTitle className="text-lg">Ventes</CardTitle>
            <CardDescription>Analyse des revenus et tendances</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="text-center">
            <Eye className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <CardTitle className="text-lg">Utilisateurs</CardTitle>
            <CardDescription>Comportement et engagement</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="text-center">
            <BarChart3 className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <CardTitle className="text-lg">Paiements</CardTitle>
            <CardDescription>Performance financière</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="text-center">
            <PieChart className="h-8 w-8 text-orange-500 mx-auto mb-2" />
            <CardTitle className="text-lg">Activité</CardTitle>
            <CardDescription>Usage de la plateforme</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Liste des rapports */}
      <Card>
        <CardHeader>
          <CardTitle>Rapports Récents</CardTitle>
          <CardDescription>
            Historique et statut des rapports générés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report: any) => (
              <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {getTypeIcon(report.type)}
                  </div>
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <p className="text-sm text-muted-foreground">{report.period}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{report.size}</p>
                    <p className="text-xs text-muted-foreground">{report.format}</p>
                  </div>
                  <Badge variant={getStatusColor(report.status)}>
                    {report.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground w-20">
                    {report.generated}
                  </p>
                  {report.status === 'ready' ? (
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      Télécharger
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      {report.status === 'generating' ? 'En cours...' : 'Programmé'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
