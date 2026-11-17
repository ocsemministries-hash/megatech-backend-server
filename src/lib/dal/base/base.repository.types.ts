/** Minimum surface a Prisma model delegate must expose for the BaseRepository. */
export interface ModelDelegate<TModel> {
  findUnique(args: unknown): Promise<TModel | null>;
  findMany(args: unknown): Promise<TModel[]>;
  create(args: unknown): Promise<TModel>;
  update(args: unknown): Promise<TModel>;
  updateMany(args: unknown): Promise<{ count: number }>;
  delete(args: unknown): Promise<TModel>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
}

export interface ListParams {
  where?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Record<string, unknown>[];
  take?: number;
  skip?: number;
}

export interface WhereId {
  id: string;
}

export type WithTimestamps = {
  createdAt: Date;
  updatedAt: Date;
};
