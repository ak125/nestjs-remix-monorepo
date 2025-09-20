import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from '../products.service';
import { ProductsController } from '../products.controller';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: {
            findAllPieces: jest.fn(),
            findOne: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);
  });

  describe('getPiecesCatalog', () => {
    it('devrait retourner les pièces avec pagination', async () => {
      const mockResult = {
        products: [
          {
            piece_id: 1,
            piece_name: 'Test Piece',
            piece_ref: 'TEST001',
            piece_activ: true,
          },
        ],
        total: 1,
        page: 1,
        limit: 24,
        totalPages: 1,
      };

      jest.spyOn(service, 'findAllPieces').mockResolvedValue(mockResult);

      const result = await controller.getPiecesCatalog('', '1', '24');

      expect(result).toEqual(mockResult);
      expect(service.findAllPieces).toHaveBeenCalledWith({
        search: '',
        page: 1,
        limit: 24,
      });
    });

    it('devrait gérer les paramètres de recherche', async () => {
      const mockResult = {
        products: [],
        total: 0,
        page: 1,
        limit: 24,
        totalPages: 0,
      };

      jest.spyOn(service, 'findAllPieces').mockResolvedValue(mockResult);

      await controller.getPiecesCatalog('frein', '2', '12');

      expect(service.findAllPieces).toHaveBeenCalledWith({
        search: 'frein',
        page: 2,
        limit: 12,
      });
    });

    it('devrait limiter la taille de page à 100', async () => {
      const mockResult = {
        products: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 0,
      };

      jest.spyOn(service, 'findAllPieces').mockResolvedValue(mockResult);

      await controller.getPiecesCatalog('', '1', '200');

      expect(service.findAllPieces).toHaveBeenCalledWith({
        search: '',
        page: 1,
        limit: 100, // Devrait être limité à 100
      });
    });
  });

  describe('findOne', () => {
    it('devrait retourner une pièce par ID', async () => {
      const mockPiece = {
        piece_id: '123',
        piece_name: 'Test Piece',
        piece_ref: 'TEST123',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockPiece);

      const result = await controller.findOne('123');

      expect(result).toEqual(mockPiece);
      expect(service.findOne).toHaveBeenCalledWith('123');
    });
  });
});
