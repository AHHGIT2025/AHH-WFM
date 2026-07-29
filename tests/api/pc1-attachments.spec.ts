import { AttachmentService } from '../../apps/web/lib/attachment-service';
import { prisma } from '@ahh-wfm/database';
import fs from 'fs/promises';

jest.mock('@ahh-wfm/database', () => ({
  prisma: {
    systemAttachment: {
      create: jest.fn(),
      findUnique: jest.fn(),
    }
  }
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
}));

describe('PC-1 Attachments: AttachmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('should reject unsupported MIME types', async () => {
      const buffer = Buffer.from('test');
      await expect(AttachmentService.upload(buffer, 'test.exe', 'application/x-msdownload', 'u1'))
        .rejects.toThrow('Unsupported MIME type: application/x-msdownload');
    });

    it('should reject files over 10MB', async () => {
      const buffer = Buffer.alloc(11 * 1024 * 1024);
      await expect(AttachmentService.upload(buffer, 'test.pdf', 'application/pdf', 'u1'))
        .rejects.toThrow('File exceeds size limit of 10MB.');
    });

    it('should successfully upload and hash valid files', async () => {
      const buffer = Buffer.from('valid data');
      (prisma.systemAttachment.create as jest.Mock).mockResolvedValue({ id: 'a1', sha256: 'somehash' });
      
      const result = await AttachmentService.upload(buffer, 'doc.pdf', 'application/pdf', 'u1');
      
      expect(fs.writeFile).toHaveBeenCalled();
      expect(prisma.systemAttachment.create).toHaveBeenCalled();
      expect(result.id).toBe('a1');
    });
  });
});
