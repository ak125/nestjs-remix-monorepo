export function formatProductionDate(monthFrom, yearFrom, monthTo, yearTo) {
    if (!yearFrom)
        return '';
    if (!yearTo) {
        if (monthFrom) {
            return `depuis ${monthFrom}/${yearFrom}`;
        }
        return `depuis ${yearFrom}`;
    }
    return `de ${yearFrom} a ${yearTo}`;
}
export function formatProductionDateDetailed(monthFrom, yearFrom, monthTo, yearTo) {
    if (!yearFrom)
        return '';
    const dateDebut = monthFrom ? `${monthFrom}/${yearFrom}` : yearFrom;
    if (!yearTo) {
        return `depuis ${dateDebut}`;
    }
    const dateFin = monthTo ? `${monthTo}/${yearTo}` : yearTo;
    return `${dateDebut} -> ${dateFin}`;
}
export function formatPower(powerPs, powerKw) {
    const ps = typeof powerPs === 'string' ? parseInt(powerPs, 10) : powerPs;
    let kw = typeof powerKw === 'string' ? parseInt(powerKw, 10) : powerKw;
    if (!ps && !kw)
        return '';
    if (ps && !kw) {
        kw = Math.round(ps * 0.7355);
    }
    if (ps && kw) {
        return `${ps} ch / ${kw} kW`;
    }
    if (ps)
        return `${ps} ch`;
    if (kw)
        return `${kw} kW`;
    return '';
}
export function psToKw(ps) {
    return Math.round(ps * 0.7355);
}
export function kwToPs(kw) {
    return Math.round(kw / 0.7355);
}
export function literToCm3(liter) {
    if (!liter)
        return undefined;
    const liters = parseFloat(liter);
    if (isNaN(liters))
        return undefined;
    return Math.round(liters * 1000);
}
export function cm3ToLiter(cm3) {
    return (cm3 / 1000).toFixed(1);
}
export function formatCylinder(liter) {
    if (!liter)
        return '';
    const cm3 = literToCm3(liter);
    if (!cm3)
        return '';
    return `${cm3} cm3 (${liter} L)`;
}
export function formatCodes(codes) {
    if (!codes || codes.length === 0)
        return '';
    return codes.filter(Boolean).join(', ');
}
export function parseCodes(codesString) {
    if (!codesString)
        return [];
    return codesString
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean);
}
export function generateVehicleUrl(vehicle) {
    return `/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`;
}
export function generateProductVehicleUrl(params) {
    return `/pieces/${params.gamme_alias}-${params.gamme_id}/${params.marque_alias}-${params.marque_id}/${params.modele_alias}-${params.modele_id}/${params.type_alias}-${params.type_id}.html`;
}
export function generateBrandUrl(brand) {
    return `/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`;
}
export function generateModelUrl(model) {
    return `/constructeurs/${model.marque_alias}-${model.marque_id}/${model.modele_alias}-${model.modele_id}.html`;
}
export function generateSlug(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
export function formatVehicleFullName(vehicle) {
    return [vehicle.marque, vehicle.modele, vehicle.type]
        .filter(Boolean)
        .join(' ');
}
export function formatVehicleShortName(vehicle) {
    return [vehicle.marque, vehicle.modele].filter(Boolean).join(' ');
}
export function isYearInRange(year, yearFrom, yearTo) {
    const from = yearFrom ? parseInt(String(yearFrom), 10) : 1900;
    const to = yearTo ? parseInt(String(yearTo), 10) : new Date().getFullYear();
    return year >= from && year <= to;
}
export function getAvailableYears(yearFrom, yearTo) {
    const from = yearFrom ? parseInt(String(yearFrom), 10) : 1980;
    const to = yearTo ? parseInt(String(yearTo), 10) : new Date().getFullYear();
    const years = [];
    for (let year = to; year >= from; year--) {
        years.push(year);
    }
    return years;
}
//# sourceMappingURL=vehicle.js.map