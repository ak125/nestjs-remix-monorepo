import { z } from 'zod';
export const VehicleFuelTypeSchema = z.enum([
    'diesel',
    'essence',
    'hybride',
    'electrique',
    'gpl',
    'gnv',
    'e85',
    'hydrogene',
]);
export const VEHICLE_FUEL_TYPES = {
    diesel: 'Diesel',
    essence: 'Essence',
    hybride: 'Hybride',
    electrique: 'Electrique',
    gpl: 'GPL',
    gnv: 'GNV',
    e85: 'E85',
    hydrogene: 'Hydrogene',
};
export const TransmissionTypeSchema = z.enum([
    'manuelle',
    'automatique',
    'semi-automatique',
    'cvt',
    'dsg',
    'robotisee',
]);
export const TRANSMISSION_TYPES = {
    manuelle: 'Manuelle',
    automatique: 'Automatique',
    'semi-automatique': 'Semi-automatique',
    cvt: 'CVT',
    dsg: 'DSG',
    robotisee: 'Robotisee',
};
export const VehicleBodyTypeSchema = z.enum([
    'berline',
    'break',
    'coupe',
    'cabriolet',
    'suv',
    'crossover',
    'monospace',
    'pickup',
    'fourgon',
    'citadine',
    'compacte',
]);
export const VEHICLE_BODY_TYPES = {
    berline: 'Berline',
    break: 'Break',
    coupe: 'Coupe',
    cabriolet: 'Cabriolet',
    suv: 'SUV',
    crossover: 'Crossover',
    monospace: 'Monospace',
    pickup: 'Pick-up',
    fourgon: 'Fourgon',
    citadine: 'Citadine',
    compacte: 'Compacte',
};
export const VehicleDisplayStatusSchema = z.union([
    z.literal(0),
    z.literal(1),
]);
export const VehicleSelectionSourceSchema = z.enum([
    'user',
    'api',
    'cache',
    'reset',
    'url',
    'history',
]);
export const EuroEmissionStandardSchema = z.enum([
    'euro1',
    'euro2',
    'euro3',
    'euro4',
    'euro5',
    'euro6',
    'euro6c',
    'euro6d',
    'euro6d-temp',
    'euro7',
]);
export const EURO_EMISSION_STANDARDS = {
    euro1: 'Euro 1 (1992)',
    euro2: 'Euro 2 (1996)',
    euro3: 'Euro 3 (2000)',
    euro4: 'Euro 4 (2005)',
    euro5: 'Euro 5 (2009)',
    euro6: 'Euro 6 (2014)',
    euro6c: 'Euro 6c (2017)',
    euro6d: 'Euro 6d (2020)',
    'euro6d-temp': 'Euro 6d-Temp',
    euro7: 'Euro 7 (2025)',
};
export const VehicleCountrySchema = z.enum([
    'FR',
    'DE',
    'IT',
    'JP',
    'US',
    'KR',
    'GB',
    'ES',
    'SE',
    'CZ',
    'RO',
]);
export const VEHICLE_COUNTRIES = {
    FR: 'France',
    DE: 'Allemagne',
    IT: 'Italie',
    JP: 'Japon',
    US: 'Etats-Unis',
    KR: 'Coree du Sud',
    GB: 'Royaume-Uni',
    ES: 'Espagne',
    SE: 'Suede',
    CZ: 'Republique Tcheque',
    RO: 'Roumanie',
};
//# sourceMappingURL=vehicle.js.map