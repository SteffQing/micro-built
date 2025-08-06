import { Test, TestingModule } from '@nestjs/testing';
import * as XLSX from 'xlsx';
import { Job } from 'bull';
import { RepaymentsConsumer } from './queue.consumer';
import { HttpCode } from '@nestjs/common';

const mockExcelData = [
  [
    'Staff Id',
    'Legacy Id',
    'Full Name',
    'Grade',
    'Step',
    'Command',
    'Element',
    'Amount',
    'Employee Gross',
    'Net Pay',
    'Period',
  ],
  [
    'EMP001',
    'LEG001',
    'John Doe',
    'GL-12',
    '5',
    'Command A',
    'Basic Salary',
    150000,
    200000,
    140000,
    'APRIL 2025',
  ],
  [
    'EMP002',
    'LEG002',
    'Jane Smith',
    'GL-10',
    '3',
    'Command B',
    'Overtime',
    75000,
    180000,
    160000,
    'APRIL 2025',
  ],
  [
    'EMP003',
    'LEG003',
    'Bob Johnson',
    'GL-14',
    '7',
    'Command C',
    'Allowance',
    50000,
    250000,
    220000,
    'APRIL 2025',
  ],
];

describe('RepaymentsConsumer', () => {
  let consumer: RepaymentsConsumer;

  const mockJob = {
    data: 'https://example.com/test-file.xlsx',
    progress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<string>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepaymentsConsumer,
        {
          //   provide: HttpService,
          useValue: {
            // Mock if needed
          },
          provide: HttpCode,
        },
      ],
    }).compile();

    consumer = module.get<RepaymentsConsumer>(RepaymentsConsumer);

    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleTask', () => {
    it('should process Excel file and send notifications', async () => {
      // Create a mock Excel buffer
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(mockExcelData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Mock fetch to return our test Excel file
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer.buffer),
      });

      // Spy on sendEmail method
      const sendEmailSpy = jest
        .spyOn(consumer, 'sendEmail')
        .mockResolvedValue(undefined);

      // Execute the task
      await consumer.handleTask(mockJob);

      // Verify that sendEmail was called for each data row (excluding header)
      expect(sendEmailSpy).toHaveBeenCalledTimes(3);

      // Verify progress was updated
      expect(mockJob.progress).toHaveBeenCalled();

      // Verify the content of the first notification
      const firstCall = sendEmailSpy.mock.calls[0];
      const firstMessage = firstCall[0];

      expect(firstMessage).toContain('John Doe');
      expect(firstMessage).toContain('EMP001');
      expect(firstMessage).toContain('GL-12');
      expect(firstMessage).toContain('Command A');
      expect(firstMessage).toContain('₦150,000');
    });

    it('should handle empty Excel files gracefully', async () => {
      // Create an empty Excel buffer (only headers)
      const emptyData = [
        [
          'Staff Id',
          'Legacy Id',
          'Full Name',
          'Grade',
          'Step',
          'Command',
          'Element',
          'Amount',
          'Employee Gross',
          'Net Pay',
          'Period',
        ],
      ];
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(emptyData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer.buffer),
      });

      const sendEmailSpy = jest
        .spyOn(consumer, 'sendEmail')
        .mockResolvedValue(undefined);

      await expect(consumer.handleTask(mockJob)).rejects.toThrow(
        'Excel file appears to be empty or has no data rows',
      );

      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(consumer.handleTask(mockJob)).rejects.toThrow(
        'Failed to download file: Not Found',
      );
    });

    it('should continue processing when individual row fails', async () => {
      // Create Excel data with one problematic row
      const problematicData = [
        [
          'Staff Id',
          'Legacy Id',
          'Full Name',
          'Grade',
          'Step',
          'Command',
          'Element',
          'Amount',
          'Employee Gross',
          'Net Pay',
          'Period',
        ],
        [
          'EMP001',
          'LEG001',
          'John Doe',
          'GL-12',
          '5',
          'Command A',
          'Basic Salary',
          150000,
          200000,
          140000,
          'APRIL 2025',
        ],
        [null, null, null, null, null, null, null, null, null, null, null], // Empty row
        [
          'EMP003',
          'LEG003',
          'Bob Johnson',
          'GL-14',
          '7',
          'Command C',
          'Allowance',
          50000,
          250000,
          220000,
          'APRIL 2025',
        ],
      ];

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(problematicData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer.buffer),
      });

      const sendEmailSpy = jest
        .spyOn(consumer, 'sendEmail')
        .mockResolvedValue(undefined);

      await consumer.handleTask(mockJob);

      // Should process 2 rows (skip the empty one)
      expect(sendEmailSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendEmail', () => {
    it('should send notification successfully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
      });

      await consumer.sendEmail('Test message');

      expect(global.fetch).toHaveBeenCalledWith('https://push.tg/r66373f', {
        method: 'POST',
        body: 'Test message',
        headers: { 'Content-Type': 'text/plain' },
      });
    });

    it('should handle notification failures gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      // Should not throw an error
      await expect(consumer.sendEmail('Test message')).resolves.toBeUndefined();
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw an error
      await expect(consumer.sendEmail('Test message')).resolves.toBeUndefined();
    });
  });

  describe('Integration test with actual Excel processing', () => {
    it('should correctly format notification messages', async () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(mockExcelData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer.buffer),
      });

      const sendEmailSpy = jest
        .spyOn(consumer, 'sendEmail')
        .mockResolvedValue(undefined);

      await consumer.handleTask(mockJob);

      // Check the format of the first message
      const firstMessage = sendEmailSpy.mock.calls[0][0];

      expect(firstMessage).toMatch(/🏦 Repayment Entry \d+\/\d+/);
      expect(firstMessage).toMatch(/👤 Employee:/);
      expect(firstMessage).toMatch(/🆔 Staff ID:/);
      expect(firstMessage).toMatch(/💰 Amount: ₦[\d,]+/);
      expect(firstMessage).toMatch(/Progress: \d+%/);
    });
  });
});

export function createTestExcelFile(): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(mockExcelData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Repayments');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
