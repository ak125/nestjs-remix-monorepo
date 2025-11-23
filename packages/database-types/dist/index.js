export * from './types';
export * from './constants';
export * from './schemas';
import { TABLES, COLUMNS, DEFAULT_VALUES } from './constants';
import { PiecesSchemas, AutoSchemas, AllSchemas, } from './schemas';
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