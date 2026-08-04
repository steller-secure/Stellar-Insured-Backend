import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { UserController } from './user/user.controller';
import { InsuranceController } from '../insurance/insurance.controller';

describe('API routing configuration', () => {
  it('keeps controller paths resource-scoped so the global api prefix is not duplicated', () => {
    const userPath = Reflect.getMetadata(PATH_METADATA, UserController);
    const insurancePath = Reflect.getMetadata(PATH_METADATA, InsuranceController);

    expect(userPath).toBe('user');
    expect(insurancePath).toBe('insurance');
    expect(userPath.startsWith('api/')).toBe(false);
    expect(insurancePath.startsWith('api/')).toBe(false);
  });

  it('uses version metadata instead of embedding the version in controller paths', () => {
    expect(Reflect.getMetadata(VERSION_METADATA, UserController)).toBe('1');
    expect(Reflect.getMetadata(VERSION_METADATA, InsuranceController)).toBe('1');
  });
});
