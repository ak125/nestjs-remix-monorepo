export * from './types.js';
export * from './constants.js';
export * from './schemas.js';
export * from './api/index.js';
export * from './enums/index.js';
export * from './helpers/index.js';
export * from './vehicle.js';
import { TABLES, COLUMNS, DEFAULT_VALUES } from './constants.js';
import { PiecesSchemas, AutoSchemas, AllSchemas, } from './schemas.js';
export const DatabaseTypes = {
    Pieces: {},
    PiecesPrice: {},
    PiecesMarque: {},
    PiecesMediaImg: {},
    PiecesCriteria: {},
    PiecesCriteriaLink: {},
    AutoMarque: {},
    AutoModele: {},
    AutoType: {},
};
export const DatabaseConstants = {
    TABLES,
    COLUMNS,
    DEFAULT_VALUES,
};
export const DatabaseSchemas = {
    Pieces: PiecesSchemas,
    Auto: AutoSchemas,
    All: AllSchemas,
};
//# sourceMappingURL=index.js.map