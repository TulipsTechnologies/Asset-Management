import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * The Location Explorer's wire contract.
 *
 * The regression these guard is not "the request fails" but "the request quietly means
 * something else": `IncludeChildren=false` is the ONE parameter whose absence and whose
 * `false` are different answers (absent binds true server-side), so a truthiness-stripping
 * serializer would turn "only what is directly here" into "everything below here" with
 * nothing to notice. The same trap applies to `IncludeAggregates=false`, which is what
 * keeps a page turn from re-running two aggregate scans.
 */

const requests: string[] = [];

vi.mock('../httpService', () => ({
  requestApi: (options: { apiEndpoint: string }) => {
    requests.push(options.apiEndpoint);
    return Promise.resolve({ success: true, data: null });
  },
}));

const loadService = async () => await import('../reports.service');

beforeEach(() => {
  requests.length = 0;
});

describe('assets-by-location query serialization', () => {
  it('omits IncludeChildren when the subtree is wanted, and sends it when it is not', async () => {
    const { runReport } = await loadService();

    await runReport('assets-by-location', { locationId: 'loc-1', includeChildren: true });
    expect(requests[0]).toContain('LocationId=loc-1');
    // Absent means true on the server; sending it would be noise, but sending the WRONG
    // value would be a lie — so the only requirement is that it is not sent as false.
    expect(requests[0]).not.toContain('IncludeChildren=false');

    await runReport('assets-by-location', { locationId: 'loc-1', includeChildren: false });
    expect(requests[1]).toContain('IncludeChildren=false');
  });

  it('sends IncludeAggregates=false so the explorer does not pay for chips it already has', async () => {
    const { runReport } = await loadService();

    await runReport('assets-by-location', { includeAggregates: false });
    expect(requests[0]).toContain('IncludeAggregates=false');

    await runReport('assets-by-location', {});
    expect(requests[1]).not.toContain('IncludeAggregates');
  });

  it('passes the asset filters through verbatim', async () => {
    const { runReport } = await loadService();

    await runReport('assets-by-location', {
      locationId: 'loc-9',
      search: 'sofa',
      categoryId: 'cat-3',
      availability: 'Under Maintenance',
      pageNumber: 2,
      pageSize: 50,
    });

    const query = requests[0];
    expect(query).toContain('Search=sofa');
    expect(query).toContain('CategoryId=cat-3');
    // Spaces must survive as encoding, not be dropped — the label has to match the
    // chip it came from exactly or the server refuses it.
    expect(query).toContain('Availability=Under%20Maintenance');
    expect(query).toContain('PageNumber=2');
    expect(query).toContain('PageSize=50');
  });

  it('selects the unlocated bucket only when asked', async () => {
    const { runReport } = await loadService();

    await runReport('assets-by-location', { unlocated: true });
    expect(requests[0]).toContain('Unlocated=true');

    await runReport('assets-by-location', { unlocated: false });
    expect(requests[1]).not.toContain('Unlocated');
  });

  it('keys the summary call on location and include-children only', async () => {
    const { fetchLocationSummary } = await loadService();

    await fetchLocationSummary('loc-1', true, true);
    expect(requests[0]).toContain('/AssetReports/assets-by-location/summary');
    expect(requests[0]).toContain('LocationId=loc-1');
    expect(requests[0]).toContain('WithDescendants=true');
    expect(requests[0]).not.toContain('IncludeChildren=false');

    await fetchLocationSummary(null, false, false);
    // Root scope sends no id at all — the whole register, not a location named "null".
    expect(requests[1]).not.toContain('LocationId');
    expect(requests[1]).toContain('IncludeChildren=false');
  });
});
