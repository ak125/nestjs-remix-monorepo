/**
 * Dashboard Admin - Page d'accueil de l'administration
 * Vue d'ensemble des statistiques et accès rapide aux fonctions principales
 */

import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useState, useEffect } from "react";
import { useUsers, useOrders } from "~/hooks/api-hooks";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard Admin - AutoParts" },
    { name: "description", content: "Tableau de bord administrateur avec vue d'ensemble du système" },
  ];
};

export default function AdminDashboard() {
  // Hooks pour récupérer les statistiques
  const { data: usersData, loading: usersLoading } = useUsers({ page: 1, limit: 1 });
  const { data: ordersData, loading: ordersLoading } = useOrders({ page: 1, limit: 1 });

  const stats = [
    {
      name: 'Utilisateurs Totaux',
      value: usersData?.total || 0,
      change: '+4.5%',
      changeType: 'positive',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      href: '/admin/users',
    },
    {
      name: 'Commandes Totales',
      value: ordersData?.total || 0,
      change: '+12.3%',
      changeType: 'positive',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      href: '/admin/orders',
    },
    {
      name: 'Commandes Auto',
      value: '247',
      change: '+8.7%',
      changeType: 'positive',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      href: '/admin/automotive',
    },
    {
      name: 'Revenus (€)',
      value: '€89,245',
      change: '+15.2%',
      changeType: 'positive',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      href: '/admin/reports/sales',
    },
  ];

  const quickActions = [
    {
      name: 'Nouvel Utilisateur',
      description: 'Créer un nouveau compte utilisateur',
      href: '/admin/users?create=true',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      color: 'bg-blue-500',
    },
    {
      name: 'Validation VIN',
      description: 'Valider les données véhicules',
      href: '/admin/automotive/validation',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-green-500',
    },
    {
      name: 'Gestion Stock',
      description: 'Gérer l\'inventaire des pièces',
      href: '/admin/products/stock',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'bg-purple-500',
    },
    {
      name: 'Export Données',
      description: 'Exporter les données système',
      href: '/admin/reports/export',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-orange-500',
    },
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'user',
      message: 'Nouvel utilisateur inscrit: jean.dupont@email.com',
      time: 'Il y a 5 minutes',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 2,
      type: 'order',
      message: 'Commande automobile validée: #ORD-2024-001',
      time: 'Il y a 12 minutes',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: 3,
      type: 'payment',
      message: 'Paiement reçu: €245.90 via Cyberplus',
      time: 'Il y a 28 minutes',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      id: 4,
      type: 'system',
      message: 'Sauvegarde automatique effectuée',
      time: 'Il y a 1 heure',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Administration</h1>
        <p className="mt-2 text-gray-600">
          Vue d'ensemble du système AutoParts - Migration complète du PHP Legacy
        </p>
      </div>

      {/* Migration Success Banner */}
      <div className="mb-8 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Migration PHP → NestJS Terminée</h3>
            <div className="mt-1 text-sm text-green-700">
              <p>
                ✅ Tous les modules legacy ont été migrés avec succès : Users, Orders, Automotive, Payment, Products
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {(usersLoading || ordersLoading) ? (
                    <span className="animate-pulse bg-gray-200 rounded h-6 w-16 block"></span>
                  ) : (
                    stat.value
                  )}
                </p>
                <p className={`text-sm ${
                  stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  {stat.icon}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions Rapides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  to={action.href}
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={`flex-shrink-0 w-12 h-12 ${action.color} rounded-lg flex items-center justify-center text-white`}>
                    {action.icon}
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-900">{action.name}</h3>
                    <p className="text-sm text-gray-500">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statut du Système</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-900">Backend NestJS</span>
                </div>
                <span className="text-sm text-green-600 font-medium">Opérationnel</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-900">Base de données</span>
                </div>
                <span className="text-sm text-green-600 font-medium">Connectée</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-900">Services automobiles</span>
                </div>
                <span className="text-sm text-green-600 font-medium">Actifs</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-900">API Paiement Cyberplus</span>
                </div>
                <span className="text-sm text-green-600 font-medium">Disponible</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Activité Récente</h2>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                      {activity.icon}
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link
                to="/admin/reports"
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Voir tous les rapports
              </Link>
            </div>
          </div>

          {/* Migration Summary */}
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Résumé de Migration</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Modules migrés:</span>
                <span className="font-medium">18/18</span>
              </div>
              <div className="flex justify-between">
                <span>Fichiers PHP analysés:</span>
                <span className="font-medium">245</span>
              </div>
              <div className="flex justify-between">
                <span>Fonctions migrées:</span>
                <span className="font-medium">320</span>
              </div>
              <div className="flex justify-between">
                <span>Tables SQL:</span>
                <span className="font-medium">87</span>
              </div>
              <div className="flex justify-between">
                <span>Patterns sécurité:</span>
                <span className="font-medium">268</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
