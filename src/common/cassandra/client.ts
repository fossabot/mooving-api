import { Client as CassandraClient, types, QueryOptions } from 'cassandra-driver';
import Logger from '../lib/Logger';

export default class Client {
  private static client: CassandraClient;
  public static keyspace: string = process.env.CASSANDRA_KEYSPACE || 'vehicle_rider';
  public static options = {
    contactPoints: (process.env.CASSANDRA_ENDPOINTS || 'localhost').split(','),
    keyspace: Client.keyspace,
    pooling: {
      coreConnectionsPerHost: {
        [types.distance.local]: 2,
        [types.distance.remote]: 1,
      },
    },
  };

  private static isCassandraHostNotAvailable(error: any) {
    if (!!error && !!error.name && error.name === 'NoHostAvailableError') {
      return true;
    } else {
      return false;
    }
  }

  private static handleError(err: any) {
    if (Client.isCassandraHostNotAvailable(err)) {
      Logger.log(`FATAL ${JSON.stringify(err)}`);
      process.exit(0);
    }
  }

  public static init(): void {
    Client.client = new CassandraClient(Client.options);
  }

  public static getClient(): CassandraClient {
    if (!Client.client) {
      Client.client = new CassandraClient(Client.options);
    }
    return Client.client;
  }

  public static async execute(query: string, params?: any, options?: QueryOptions): Promise<types.ResultSet> {
    try {
      const results = await Client.getClient().execute(query, params, options);
      return results;
    } catch (err) {
      Client.handleError(err);
    }
  }

  public static async batch(queries: string[] | Array<{ query: string, params?: any }>, options?: QueryOptions): Promise<types.ResultSet> {
    try {
      const results = await Client.getClient().batch(queries, options);
      return results;
    } catch (err) {
      Client.handleError(err);
    }
  }
}
