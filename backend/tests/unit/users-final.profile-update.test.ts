/**
 * Mise à jour de profil — PUT /api/users/profile (client) et PUT /api/users/:id (admin).
 *
 * Deux défauts, une même cause : le schéma de mise à jour dérivait de
 * `UserSchema` par `.partial()`.
 *  - Côté client, il acceptait tous les champs du compte, y compris ceux que
 *    seul le personnel doit pouvoir changer (niveau, statut, drapeaux).
 *  - Zod 4 applique un `.default()` même sous `.partial()` : toute mise à jour,
 *    client comme admin, réécrivait pays / pro / société / actif / niveau avec
 *    leurs valeurs de création.
 *
 * Ce test verrouille : le client ne peut changer que prénom, nom et téléphone
 * (toute autre clé → 400, service jamais appelé) ; une mise à jour admin
 * n'écrit que les champs envoyés ; un corps vide est refusé (400) des deux côtés.
 *
 * @see backend/src/modules/users/dto/user.dto.ts (UpdateOwnProfileSchema, UpdateUserSchema)
 * @see backend/src/modules/users/users-final.controller.ts (updateProfile, updateUser)
 */

import 'reflect-metadata';
import { UsersFinalController } from '../../src/modules/users/users-final.controller';
import {
  mapUserToSupabase,
  UpdateOwnProfileSchema,
  UpdateUserSchema,
  UserSchema,
} from '../../src/modules/users/dto/user.dto';

const USER_ID = 'u-1';

function makeController() {
  const usersService = {
    updateUser: jest
      .fn()
      .mockImplementation((id: string, updates: object) =>
        Promise.resolve({ id, ...updates }),
      ),
  };
  const controller = new UsersFinalController(usersService as never);
  return { controller, usersService };
}

function req(userId?: string) {
  return {
    user: userId ? { id: userId, email: 'someone@test.invalid' } : undefined,
  } as never;
}

// Seuls champs que le client peut changer lui-même.
const SELF_EDITABLE_FIELDS = ['firstName', 'lastName', 'phone'];

// Tous les autres champs du compte, dérivés de `UserSchema` : un champ ajouté
// plus tard au compte est refusé d'office. S'y ajoute `password`, qui a son
// propre parcours (comme l'e-mail).
const FORBIDDEN_SELF_FIELDS = [
  ...Object.keys(UserSchema.shape).filter(
    (field) => !SELF_EDITABLE_FIELDS.includes(field),
  ),
  'password',
];

describe('UpdateOwnProfileSchema (self-service)', () => {
  it('accepts first name, last name and phone', () => {
    expect(
      UpdateOwnProfileSchema.parse({
        firstName: 'Jean',
        lastName: 'Martin',
        phone: '06 12 34 56 78',
      }),
    ).toEqual({
      firstName: 'Jean',
      lastName: 'Martin',
      phone: '06 12 34 56 78',
    });
  });

  it('returns only the fields sent (no default injected)', () => {
    expect(UpdateOwnProfileSchema.parse({ firstName: 'Jean' })).toEqual({
      firstName: 'Jean',
    });
  });

  it('rejects an empty body', () => {
    expect(UpdateOwnProfileSchema.safeParse({}).success).toBe(false);
  });

  it('allows exactly first name, last name and phone', () => {
    expect(Object.keys(UpdateOwnProfileSchema.shape).sort()).toEqual(
      [...SELF_EDITABLE_FIELDS].sort(),
    );
  });

  it('covers the staff-only account fields', () => {
    expect(FORBIDDEN_SELF_FIELDS).toEqual(
      expect.arrayContaining([
        'level',
        'isActive',
        'isPro',
        'isCompany',
        'email',
        'id',
        'password',
      ]),
    );
  });

  // La valeur envoyée importe peu : la clé elle-même est refusée.
  it.each(FORBIDDEN_SELF_FIELDS)('rejects %s as an unknown key', (field) => {
    const result = UpdateOwnProfileSchema.safeParse({
      firstName: 'Jean',
      [field]: 'x',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ code: 'unrecognized_keys', keys: [field] }),
    );
  });

  it('maps to the three customer columns only', () => {
    const parsed = UpdateOwnProfileSchema.parse({
      firstName: 'Jean',
      lastName: 'Martin',
      phone: '0612345678',
    });
    expect(Object.keys(mapUserToSupabase(parsed)).sort()).toEqual([
      'cst_fname',
      'cst_name',
      'cst_tel',
    ]);
  });
});

describe('UpdateUserSchema (admin)', () => {
  it('returns only the fields sent (no default injected)', () => {
    expect(UpdateUserSchema.parse({ isActive: false })).toEqual({
      isActive: false,
    });
    expect(UpdateUserSchema.parse({ firstName: 'Jean' })).toEqual({
      firstName: 'Jean',
    });
  });

  it('writes only the columns of the fields sent', () => {
    expect(
      mapUserToSupabase(UpdateUserSchema.parse({ isActive: false })),
    ).toEqual({ cst_activ: '0' });
  });

  it('rejects an empty body', () => {
    expect(UpdateUserSchema.safeParse({}).success).toBe(false);
  });

  it('still validates the level range', () => {
    expect(UpdateUserSchema.parse({ level: 7 })).toEqual({ level: 7 });
    expect(UpdateUserSchema.safeParse({ level: 11 }).success).toBe(false);
    expect(UpdateUserSchema.safeParse({ level: 0 }).success).toBe(false);
  });
});

describe('PUT /api/users/profile — updateProfile', () => {
  it('passes only the allowed fields to the service, for the session user', async () => {
    const { controller, usersService } = makeController();
    await controller.updateProfile(req(USER_ID), {
      firstName: 'Jean',
      phone: '0612345678',
    });
    expect(usersService.updateUser).toHaveBeenCalledTimes(1);
    expect(usersService.updateUser).toHaveBeenCalledWith(USER_ID, {
      firstName: 'Jean',
      phone: '0612345678',
    });
  });

  it.each(FORBIDDEN_SELF_FIELDS)(
    'refuses a body carrying %s and writes nothing',
    async (field) => {
      const { controller, usersService } = makeController();
      await expect(
        controller.updateProfile(req(USER_ID), {
          firstName: 'Jean',
          [field]: 'x',
        }),
      ).rejects.toMatchObject({
        status: 400,
        // Refusé parce que la clé est interdite, pas à cause de la valeur.
        message: expect.stringMatching(
          new RegExp(`unrecognized_keys[\\s\\S]*"${field}"`),
        ),
      });
      expect(usersService.updateUser).not.toHaveBeenCalled();
    },
  );

  it('refuses an empty body and writes nothing', async () => {
    const { controller, usersService } = makeController();
    await expect(
      controller.updateProfile(req(USER_ID), {}),
    ).rejects.toMatchObject({ status: 400 });
    expect(usersService.updateUser).not.toHaveBeenCalled();
  });

  it('refuses an anonymous call', async () => {
    const { controller, usersService } = makeController();
    await expect(
      controller.updateProfile(req(), { firstName: 'Jean' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(usersService.updateUser).not.toHaveBeenCalled();
  });
});

describe('PUT /api/users/:id — updateUser (admin)', () => {
  it('deactivating a user writes the status only', async () => {
    const { controller, usersService } = makeController();
    await controller.updateUser('u-2', { isActive: false });
    expect(usersService.updateUser).toHaveBeenCalledWith('u-2', {
      isActive: false,
    });
  });
});
