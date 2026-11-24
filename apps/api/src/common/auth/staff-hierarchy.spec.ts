// IINICIA Portal · identidad y autenticación · staff-hierarchy.spec.ts
/** Ejercita las reglas de jerarquía por separado para que los permisos de administración ordinaria y global conserven sus límites. */
import { ForbiddenException } from '@nestjs/common';
import { requireManageableAccount, requireManageableRole } from './staff-hierarchy.js';

describe('Jerarquía administrativa', () => {
  it.each(['administrador', 'superadministrador'])('reserva el rol %s a superadministración', (role) => {
    expect(() => requireManageableRole(['administrador'], role)).toThrow(ForbiddenException);
    expect(() => requireManageableRole(['superadministrador'], role)).not.toThrow();
  });

  it.each(['coordinador', 'soporte'])('permite al administrador asignar %s', (role) => {
    expect(() => requireManageableRole(['administrador'], role)).not.toThrow();
  });

  it('impide al administrador modificar una cuenta privilegiada', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(),
    };
    // La selección filtra primero por usuario y luego pide roles activos.
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({
      data: [{ roles: { slug: 'superadministrador' }, expires_at: null }],
      error: null,
    });
    const client = { from: () => query } as unknown as Parameters<typeof requireManageableAccount>[0];
    await expect(requireManageableAccount(client, ['administrador'], 'target'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
