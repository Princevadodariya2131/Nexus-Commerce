import './helpers/testkit';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_STATUSES, VENDOR_SETTABLE_STATUSES, decideVendorOrderAccess } from '../policies/orderPolicy';

describe('decideVendorOrderAccess', () => {
  it('allows when every item belongs to the vendor', () => {
    assert.equal(decideVendorOrderAccess(10, [{ vendorId: 10 }, { vendorId: 10 }]), 'allowed');
  });
  it('treats an order with none of the vendor items as not found', () => {
    assert.equal(decideVendorOrderAccess(10, [{ vendorId: 11 }]), 'not_found');
    assert.equal(decideVendorOrderAccess(10, [{ vendorId: null }]), 'not_found');
    assert.equal(decideVendorOrderAccess(10, []), 'not_found');
  });
  it('restricts mixed-vendor orders to administrators', () => {
    assert.equal(decideVendorOrderAccess(10, [{ vendorId: 10 }, { vendorId: 11 }]), 'mixed_order');
    assert.equal(decideVendorOrderAccess(10, [{ vendorId: 10 }, { vendorId: null }]), 'mixed_order');
  });
});

describe('vendor-settable statuses', () => {
  it('never include refunded or pending and are all valid statuses', () => {
    assert.equal(VENDOR_SETTABLE_STATUSES.includes('refunded'), false);
    assert.equal(VENDOR_SETTABLE_STATUSES.includes('pending'), false);
    for (const status of VENDOR_SETTABLE_STATUSES) assert.ok(ORDER_STATUSES.includes(status));
  });
});
