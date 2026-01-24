import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PolicyService } from './policy.service';
import { Policy } from './entities/policy.entity';
import { PolicyStateMachineService } from './services/policy-state-machine.service';
import { PolicyAuditService } from './services/policy-audit.service';
import { PolicyStatus } from './enums/policy-status.enum';

describe('PolicyService', () => {
  let service: PolicyService;
  let repositoryMock: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyService,
        PolicyStateMachineService,
        PolicyAuditService,
        {
          provide: getRepositoryToken(Policy),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { 
            del: jest.fn(),
            get: jest.fn(),
            set: jest.fn() 
          },
        },
      ],
    }).compile();

    service = module.get<PolicyService>(PolicyService);
    repositoryMock = module.get(getRepositoryToken(Policy));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ... your other tests
});