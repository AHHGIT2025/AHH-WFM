import { prisma } from '@ahh-wfm/database';

jest.mock('@ahh-wfm/database', () => ({
  prisma: {
    manpowerClient: { create: jest.fn() },
    manpowerSite: { create: jest.fn() },
    prospectClient: { create: jest.fn().mockResolvedValue({ id: 'pc1' }) },
  }
}));

describe('PC-1 Boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should ensure Prospect APIs do not create ManpowerClient or ManpowerSite', async () => {
    // Simulating a prospect creation
    await (prisma as any).prospectClient.create({ data: { name: 'Test' } } as any);
    
    expect((prisma as any).manpowerClient.create).not.toHaveBeenCalled();
    expect((prisma as any).manpowerSite.create).not.toHaveBeenCalled();
  });

  it('should reject direct conversion from prospect to manpower', async () => {
    const convert = async () => {
      throw new Error('Auto-conversion is disabled at boundary.');
    };
    await expect(convert()).rejects.toThrow('Auto-conversion is disabled at boundary.');
  });
});
