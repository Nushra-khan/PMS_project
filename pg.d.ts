declare module "pg" {
  export type QueryResultRow = Record<string, unknown>;

  export interface QueryResult<R extends QueryResultRow = QueryResultRow> {
    rows: R[];
  }

  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    connectionTimeoutMillis?: number;
    idleTimeoutMillis?: number;
  }

  export class PoolClient {
    query<R extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[]
    ): Promise<QueryResult<R>>;
    release(): void;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
  }
}
