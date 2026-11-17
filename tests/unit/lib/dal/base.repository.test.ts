import { describe, expect, it, vi } from 'vitest';
import { BaseRepository } from '@/lib/dal/base/base.repository';
import type { ModelDelegate } from '@/lib/dal/base/base.repository.types';

type Item = { id: string; name: string; createdAt: Date; updatedAt: Date };

const makeDelegate = (overrides: Partial<ModelDelegate<Item>> = {}): ModelDelegate<Item> => ({
  findUnique: vi.fn(async () => null),
  findMany: vi.fn(async () => []),
  create: vi.fn(async ({ data }: { data: Item }) => data),
  update: vi.fn(async ({ data }: { data: Item }) => data),
  updateMany: vi.fn(async () => ({ count: 0 })),
  delete: vi.fn(async () => ({ id: '' }) as Item),
  deleteMany: vi.fn(async () => ({ count: 0 })),
  count: vi.fn(async () => 0),
  ...overrides,
});

class TestRepo extends BaseRepository<Item> {
  constructor(delegate: ModelDelegate<Item>) {
    super(delegate);
  }
}

describe('BaseRepository', () => {
  it('findById delegates a unique lookup with the id', async () => {
    const delegate = makeDelegate({ findUnique: vi.fn(async () => ({ id: 'x' } as Item)) });
    const repo = new TestRepo(delegate);

    const item = await repo.findById('x');

    expect(delegate.findUnique).toHaveBeenCalledWith({ where: { id: 'x' } });
    expect(item).toEqual({ id: 'x' });
  });

  it('create forwards the data payload', async () => {
    const delegate = makeDelegate();
    const repo = new TestRepo(delegate);
    const data = { id: 'n1', name: 'A' } as Item;

    await repo.create(data);

    expect(delegate.create).toHaveBeenCalledWith({ data });
  });

  it('updateMany returns the affected count', async () => {
    const delegate = makeDelegate({ updateMany: vi.fn(async () => ({ count: 4 })) });
    const repo = new TestRepo(delegate);

    const count = await repo.updateMany({ status: 'X' }, { name: 'Y' });

    expect(delegate.updateMany).toHaveBeenCalledWith({ where: { status: 'X' }, data: { name: 'Y' } });
    expect(count).toBe(4);
  });

  it('count forwards a where filter', async () => {
    const delegate = makeDelegate({ count: vi.fn(async () => 2) });
    const repo = new TestRepo(delegate);

    const count = await repo.count({ active: true });

    expect(delegate.count).toHaveBeenCalledWith({ where: { active: true } });
    expect(count).toBe(2);
  });
});
