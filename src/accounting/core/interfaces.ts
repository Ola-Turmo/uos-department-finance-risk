/**
 * Database Repository Interface — abstracts storage so any DB can be plugged in.
 * Default implementation: InMemoryRepository (dev/test)
 * Swap for: SqliteRepository, PostgresRepository, MySqlRepository, etc.
 */

export interface Repository<T extends object> {
  findById(id: string): Promise<T | null>;
  findAll(filters?: Partial<T>): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
  count(filters?: Partial<T>): Promise<number>;
}

export interface UnitOfWork {
  start(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getRepository<T extends object>(name: string): Repository<T>;
}

export interface DbConfig {
  type: 'inmemory' | 'sqlite' | 'postgres' | 'mysql';
  connectionString?: string;
  database?: string;
}

export class RepositoryFactory {
  private repos = new Map<string, Repository<any>>();
  private unitOfWork: UnitOfWork | null = null;

  constructor(private dbConfig: DbConfig) {}

  getRepository<T extends object>(name: string): Repository<T> {
    if (this.unitOfWork) return this.unitOfWork.getRepository<T>(name);
    if (!this.repos.has(name)) {
      this.repos.set(name, new InMemoryRepository<T>());
    }
    return this.repos.get(name)!;
  }

  setUnitOfWork(uow: UnitOfWork): void {
    this.unitOfWork = uow;
  }
}

export class InMemoryRepository<T extends object> implements Repository<T> {
  protected storage = new Map<string, T>();

  async findById(id: string): Promise<T | null> {
    return this.storage.get(id) || null;
  }

  async findAll(filters?: Partial<T>): Promise<T[]> {
    let items = Array.from(this.storage.values());
    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        items = items.filter(item => (item as any)[key] === val);
      }
    }
    return items;
  }

  async save(entity: T): Promise<T> {
    const id = (entity as any).id as string;
    this.storage.set(id, entity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    this.storage.delete(id);
  }

  async count(filters?: Partial<T>): Promise<number> {
    return (await this.findAll(filters)).length;
  }

  // ─── Internal helpers (not in Repository interface) ────────────────────────
  async insert(entity: T): Promise<void> {
    const id = (entity as any).id ?? (entity as any).accountKey ?? (entity as any).entityKey ?? crypto.randomUUID();
    this.storage.set(id, entity);
  }

  async update(entity: T): Promise<void> {
    const id = (entity as any).id ?? (entity as any).accountKey ?? (entity as any).entityKey;
    if (id && this.storage.has(id)) this.storage.set(id, entity);
  }

  _clear(): void { this.storage.clear(); }
  _getAll(): T[] { return Array.from(this.storage.values()); }
}
