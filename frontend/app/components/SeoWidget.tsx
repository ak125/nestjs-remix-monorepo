// app/components/SeoWidget.tsx
import { Link } from "@remix-run/react";
import { Search, Globe, FileText, BarChart3, AlertTriangle, CheckCircle, Zap, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface SeoStats {
  totalPages: number;
  pagesWithSeo: number;
  sitemapEntries: number;
  completionRate: number;
}

interface SeoWidgetProps {
  stats?: SeoStats;
  className?: string;
}

export function SeoWidget({ stats, className = "" }: SeoWidgetProps) {
  const seoData = stats || {
    totalPages: 714000,
    pagesWithSeo: 680000,
    sitemapEntries: 714336,
    completionRate: 95.2
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 95) return "text-green-600 bg-green-50 border-green-200";
    if (rate >= 80) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getStatusIcon = (rate: number) => {
    if (rate >= 95) return <CheckCircle className="h-4 w-4" />;
    if (rate >= 80) return <AlertTriangle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getStatusText = (rate: number) => {
    if (rate >= 95) return "🚀 Excellent";
    if (rate >= 80) return "⚡ Bon";
    return "🔧 À améliorer";
  };

  return (
    <Card className={`${className} border-green-200 bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 hover:shadow-lg transition-all duration-300`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-800">
          <div className="p-1 bg-green-100 rounded-lg">
            <Search className="h-5 w-5" />
          </div>
          Module SEO Enterprise
          <div className={`px-3 py-1 rounded-full text-xs font-bold ml-auto flex items-center gap-1 ${getStatusColor(seoData.completionRate)}`}>
            {getStatusIcon(seoData.completionRate)}
            {seoData.completionRate.toFixed(1)}%
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métriques principales */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-4 bg-white/70 rounded-xl border border-green-100 hover:bg-white/90 transition-colors group">
            <div className="text-2xl font-bold text-green-700 group-hover:scale-110 transition-transform">
              {seoData.sitemapEntries.toLocaleString()}
            </div>
            <div className="text-xs text-green-600 flex items-center justify-center gap-1 mt-1">
              <Globe className="h-3 w-3" />
              Pages indexées
            </div>
          </div>
          
          <div className="text-center p-4 bg-white/70 rounded-xl border border-blue-100 hover:bg-white/90 transition-colors group">
            <div className="text-2xl font-bold text-blue-700 group-hover:scale-110 transition-transform">
              {seoData.pagesWithSeo.toLocaleString()}
            </div>
            <div className="text-xs text-blue-600 flex items-center justify-center gap-1 mt-1">
              <FileText className="h-3 w-3" />
              Optimisées SEO
            </div>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-gray-600" />
              <span className="font-medium text-gray-700">Performance Globale</span>
            </div>
            <span className="font-bold text-gray-800">
              {getStatusText(seoData.completionRate)}
            </span>
          </div>
          
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
              <div 
                className="bg-gradient-to-r from-green-500 via-teal-500 to-blue-500 h-3 rounded-full transition-all duration-1000 shadow-sm relative overflow-hidden"
                style={{ width: `${seoData.completionRate}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-sm">
              {seoData.completionRate.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-2 gap-2">
          <Link 
            to="/admin/seo?tab=analytics" 
            className="flex items-center gap-2 p-3 bg-white/80 hover:bg-white transition-all duration-200 rounded-xl border border-green-100 text-xs font-medium text-green-700 hover:text-green-800 hover:shadow-md group"
          >
            <BarChart3 className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Analytics</span>
          </Link>
          
          <Link 
            to="/admin/seo?tab=batch" 
            className="flex items-center gap-2 p-3 bg-white/80 hover:bg-white transition-all duration-200 rounded-xl border border-blue-100 text-xs font-medium text-blue-700 hover:text-blue-800 hover:shadow-md group"
          >
            <Zap className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Optimiser</span>
          </Link>
        </div>

        {/* Indicateur de statut */}
        <div className={`p-3 rounded-xl border-2 ${getStatusColor(seoData.completionRate)} transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(seoData.completionRate)}
              <span className="text-sm font-semibold">
                {getStatusText(seoData.completionRate)}
              </span>
            </div>
            <Link 
              to="/admin/seo" 
              className="text-xs font-medium hover:underline"
            >
              Détails →
            </Link>
          </div>
          
          {seoData.completionRate < 95 && (
            <div className="mt-2 text-xs opacity-90">
              💡 {(seoData.totalPages - seoData.pagesWithSeo).toLocaleString()} pages nécessitent une optimisation
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
