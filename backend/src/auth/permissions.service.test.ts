import { Test } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import type { PermissionAction } from './dto/user-permissions.dto';

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsService],
    }).compile();
    service = moduleRef.get(PermissionsService);
  });

  describe('getPermissions', () => {
    it('returns BASE_USER for level 0', () => {
      const p = service.getPermissions(0);
      expect(p.canCancel).toBe(false);
      expect(p.showActionButtons).toBe(false);
    });

    it('returns COMMERCIAL for level 3', () => {
      const p = service.getPermissions(3);
      expect(p.canCancel).toBe(true);
      expect(p.canShip).toBe(true);
      expect(p.canDeliver).toBe(true);
      expect(p.canMarkPaid).toBe(true);
      expect(p.canRefund).toBe(false);
      expect(p.canCreateOrders).toBe(false);
    });

    it('returns MANAGER for level 5', () => {
      const p = service.getPermissions(5);
      expect(p.canCancel).toBe(false);
      expect(p.canExport).toBe(true);
      expect(p.canSeeFinancials).toBe(true);
    });

    it('returns ADMIN for level 7', () => {
      const p = service.getPermissions(7);
      expect(p.canCancel).toBe(true);
      expect(p.canRefund).toBe(true);
      expect(p.canCreateOrders).toBe(true);
    });

    it('returns SUPER_ADMIN for level 9', () => {
      const p = service.getPermissions(9);
      expect(p.canRefund).toBe(true);
      expect(p.canCreateOrders).toBe(true);
    });
  });

  describe('hasPermission', () => {
    const cases: Array<[number, PermissionAction, boolean]> = [
      [3, 'canValidate', true],
      [3, 'canShip', true],
      [3, 'canDeliver', true],
      [3, 'canCancel', true],
      [3, 'canReturn', false],
      [3, 'canRefund', false],
      [3, 'canSendEmails', true],
      [3, 'canCreateOrders', false],
      [3, 'canExport', true],
      [3, 'canMarkPaid', true],
      [3, 'canSeeFullStats', false],
      [3, 'canSeeFinancials', false],
      [3, 'canSeeCustomerDetails', true],
      [3, 'showAdvancedFilters', true],
      [3, 'showActionButtons', true],
      [5, 'canCancel', false],
      [5, 'canShip', false],
      [5, 'canDeliver', false],
      [5, 'canMarkPaid', false],
      [5, 'canExport', true],
      [5, 'canSeeFinancials', true],
      [7, 'canCancel', true],
      [7, 'canRefund', true],
      [7, 'canReturn', true],
      [7, 'canCreateOrders', true],
      [1, 'canCancel', false],
      [1, 'canExport', false],
      [0, 'canCancel', false],
      [-1, 'canCancel', false],
    ];

    it.each(cases)('level %i / %s -> %s', (level, action, expected) => {
      expect(service.hasPermission(level, action)).toBe(expected);
    });
  });
});
