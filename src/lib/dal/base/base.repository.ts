import type { ListParams, ModelDelegate, WhereId } from './base.repository.types';

export abstract class BaseRepository<
  TModel extends { id: string },
  TCreate = Record<string, unknown>,
  TUpdate = Record<string, unknown>,
> {
  protected constructor(protected readonly delegate: ModelDelegate<TModel>) {}

  async findById(id: string): Promise<TModel | null> {
    return this.delegate.findUnique({ where: { id } as WhereId });
  }

  async findFirst(where: Record<string, unknown>): Promise<TModel | null> {
    return this.delegate.findUnique({ where } as { where: Record<string, unknown> });
  }

  async findMany(params: ListParams = {}): Promise<TModel[]> {
    return this.delegate.findMany(params);
  }

  async create(data: TCreate): Promise<TModel> {
    return this.delegate.create({ data } as { data: TCreate });
  }

  async update(id: string, data: Partial<TUpdate>): Promise<TModel> {
    return this.delegate.update({ where: { id } as WhereId, data } as {
      where: WhereId;
      data: Partial<TUpdate>;
    });
  }

  async updateMany(where: Record<string, unknown>, data: Partial<TUpdate>): Promise<number> {
    const result = await this.delegate.updateMany({ where, data });
    return result.count;
  }

  async hardDelete(id: string): Promise<TModel> {
    return this.delegate.delete({ where: { id } as WhereId });
  }

  async hardDeleteMany(where: Record<string, unknown>): Promise<number> {
    const result = await this.delegate.deleteMany({ where });
    return result.count;
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return this.delegate.count(where ? { where } : undefined);
  }
}
