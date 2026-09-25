import { ValidationError } from '../../../shared/errors/domain-errors';
import { assertKeepsAnOwner, assertNotLockingSelfOut } from './user-rules';

describe('regras de usuário', () => {
  it('ninguém se desativa', () => {
    expect(() => assertNotLockingSelfOut('u1', 'u1', { role: 'ADMIN' }, { active: false })).toThrow(ValidationError);
    expect(() => assertNotLockingSelfOut('u2', 'u1', { role: 'ADMIN' }, { active: false })).not.toThrow();
  });

  it('proprietário não rebaixa a si mesmo', () => {
    expect(() => assertNotLockingSelfOut('u1', 'u1', { role: 'OWNER' }, { role: 'ADMIN' })).toThrow(ValidationError);
  });

  it('sempre sobra um proprietário ativo', () => {
    expect(() => assertKeepsAnOwner({ role: 'OWNER', active: true }, { active: false }, 0)).toThrow(ValidationError);
    expect(() => assertKeepsAnOwner({ role: 'OWNER', active: true }, { archived: true }, 0)).toThrow(ValidationError);
    expect(() => assertKeepsAnOwner({ role: 'OWNER', active: true }, { active: false }, 1)).not.toThrow();
    expect(() => assertKeepsAnOwner({ role: 'ADMIN', active: true }, { active: false }, 0)).not.toThrow();
  });
});
