import { Logger } from '@nestjs/common';
import { SupplierTruthEventSink } from './supplier-truth-event-sink';

describe('SupplierTruthEventSink', () => {
  it('is NOT a noop — *failed* events log at ERROR, others at WARN (observable in prod)', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    const sink = new SupplierTruthEventSink();
    sink.emit('supplier.truth.degraded', { piece_id: 1 });
    sink.emit('supplier.sync.connector_failed', { supplierId: '71' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('supplier.truth.degraded');
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('connector_failed');

    warn.mockRestore();
    error.mockRestore();
  });
});
