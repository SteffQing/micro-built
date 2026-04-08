import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';

describe('RepaymentsController', () => {
  let controller: RepaymentsController;
  let service: { validateDocument: jest.Mock };

  beforeEach(async () => {
    service = { validateDocument: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepaymentsController],
      providers: [{ provide: RepaymentsService, useValue: service }],
    }).compile();

    controller = module.get<RepaymentsController>(RepaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('validateFile', () => {
    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        controller.validateFile(undefined as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns clean message when document is fully valid', async () => {
      service.validateDocument.mockResolvedValue({
        headers: { valid: true, missing: [] },
        rows: { valid: true, totalRows: 10, invalidRows: [] },
      });

      const result = await controller.validateFile({
        buffer: Buffer.from(''),
      } as any);

      expect(result.message).toBe('Document is valid and ready to upload');
      expect(result.data.headers.valid).toBe(true);
    });

    it('returns issues message when document has row errors', async () => {
      service.validateDocument.mockResolvedValue({
        headers: { valid: true, missing: [] },
        rows: {
          valid: false,
          totalRows: 10,
          invalidRows: [{ row: 3, staffId: 'EMP003', issues: ['staffid is empty'] }],
        },
      });

      const result = await controller.validateFile({
        buffer: Buffer.from(''),
      } as any);

      expect(result.message).toBe(
        'Document has validation issues — see report for details',
      );
      expect(result.data.rows!.invalidRows).toHaveLength(1);
    });

    it('returns issues message when headers are invalid', async () => {
      service.validateDocument.mockResolvedValue({
        headers: { valid: false, missing: ['staffid', 'amount'] },
        rows: null,
      });

      const result = await controller.validateFile({
        buffer: Buffer.from(''),
      } as any);

      expect(result.message).toBe(
        'Document has validation issues — see report for details',
      );
      expect(result.data.rows).toBeNull();
    });
  });
});
