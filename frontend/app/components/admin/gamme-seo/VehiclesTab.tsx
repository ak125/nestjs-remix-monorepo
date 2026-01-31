/**
 * Vehicles Tab Content for Admin Gamme SEO Detail page
 * Handles vehicle compatibility display by level with search and CSV export
 */

import { Search, Download } from "lucide-react";
import { useState } from "react";
import { type GammeDetail, type VehicleEntry } from "./types";
import {
  filterAndSortVehicles,
  exportVehiclesToCSV,
  getFuelBadgeClass,
} from "./utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";

interface VehiclesTabProps {
  detail: GammeDetail;
}

export function VehiclesTab({ detail }: VehiclesTabProps) {
  const [vehicleSearch, setVehicleSearch] = useState("");

  const filterVehicles = (vehicles: VehicleEntry[]) =>
    filterAndSortVehicles(vehicles, vehicleSearch);

  const handleExportCSV = (vehicles: VehicleEntry[], filename: string) => {
    exportVehiclesToCSV(filterVehicles(vehicles), filename);
  };

  const totalVehicles =
    detail.vehicles.level1.length +
    detail.vehicles.level2.length +
    detail.vehicles.level5.length;

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un vehicule..."
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <span className="text-sm text-gray-500">
            Total: {totalVehicles} vehicules
          </span>
        </div>
      </div>

      {/* Level 1 - Featured */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Niveau 1 - Vedettes</CardTitle>
            <CardDescription>
              Vehicules affiches en grille sur la page gamme (
              {filterVehicles(detail.vehicles.level1).length} vehicules)
            </CardDescription>
          </div>
          {detail.vehicles.level1.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handleExportCSV(
                  detail.vehicles.level1,
                  `vehicules-niveau1-${detail.gamme.pg_alias}.csv`,
                )
              }
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {filterVehicles(detail.vehicles.level1).length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              {vehicleSearch
                ? "Aucun vehicule trouve"
                : "Aucun vehicule vedette"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filterVehicles(detail.vehicles.level1).map((v) => (
                <Badge
                  key={v.cgc_id}
                  variant="secondary"
                  className={`text-sm ${getFuelBadgeClass(v.fuel)}`}
                >
                  {v.marque_name} {v.modele_name} {v.type_name}
                  {v.power_ps && ` ${v.power_ps}ch`}
                  {v.year_from && v.year_to && ` (${v.year_from}-${v.year_to})`}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Level 2 - Secondary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Niveau 2 - Secondaires</CardTitle>
            <CardDescription>
              Vehicules secondaires associes a cette gamme (
              {filterVehicles(detail.vehicles.level2).length} vehicules)
            </CardDescription>
          </div>
          {detail.vehicles.level2.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handleExportCSV(
                  detail.vehicles.level2,
                  `vehicules-niveau2-${detail.gamme.pg_alias}.csv`,
                )
              }
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {filterVehicles(detail.vehicles.level2).length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              {vehicleSearch
                ? "Aucun vehicule trouve"
                : "Aucun vehicule secondaire"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filterVehicles(detail.vehicles.level2).map((v) => (
                <Badge
                  key={v.cgc_id}
                  variant="outline"
                  className={`text-sm ${getFuelBadgeClass(v.fuel)}`}
                >
                  {v.marque_name} {v.modele_name} {v.type_name}
                  {v.power_ps && ` ${v.power_ps}ch`}
                  {v.year_from && v.year_to && ` (${v.year_from}-${v.year_to})`}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Level 5 - Blog */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Niveau 5 - Blog</CardTitle>
            <CardDescription>
              Vehicules cites dans les articles blog (
              {filterVehicles(detail.vehicles.level5).length} vehicules)
            </CardDescription>
          </div>
          {detail.vehicles.level5.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handleExportCSV(
                  detail.vehicles.level5,
                  `vehicules-niveau5-${detail.gamme.pg_alias}.csv`,
                )
              }
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {filterVehicles(detail.vehicles.level5).length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              {vehicleSearch ? "Aucun vehicule trouve" : "Aucun vehicule blog"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filterVehicles(detail.vehicles.level5).map((v) => (
                <Badge
                  key={v.cgc_id}
                  variant="outline"
                  className={`text-sm ${getFuelBadgeClass(v.fuel)}`}
                >
                  {v.marque_name} {v.modele_name} {v.type_name}
                  {v.power_ps && ` ${v.power_ps}ch`}
                  {v.year_from && v.year_to && ` (${v.year_from}-${v.year_to})`}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
