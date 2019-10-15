import { Request, Response } from 'express';
import cassandra from '../cassandra/client';
import { KafkaClient } from 'kafka-node';
import Logger from '../lib/Logger';
import { KAFKA_HOST } from '../lib/Kafka';

export default class StatsController {
  public static healthCheck(name: string) {
    return async (req: Request, res: Response) => {
      let cassandraError = null;
      let kafkaError = null;
      try {
        await cassandra.getClient().execute('SELECT now() FROM system.local;', [], { prepare: true });
      } catch (error) {
        cassandraError = true;
        Logger.log('Cassandra is down!');
      }
      try {
        await new Promise((resolve: () => void, reject: () => void) => {
          const client = new KafkaClient({ kafkaHost: KAFKA_HOST });
          client.connect();
          client.on('ready', () => {
            resolve();
          });
          client.on('error', () => {
            reject();
          });
        });
      } catch (err) {
        kafkaError = true;
        Logger.log('Kafka is down!');
      }
      if (kafkaError || cassandraError) {
        res.sendStatus(500);
      } else {
        res.status(200).json({
          message: `${name} API`,
        });
      }
    };
  }

  public static getInfo(name: string) {
    return (request: Request, response: Response) => {
      response.status(200).json({
        message: `${name} API`,
      });
    };
  }
}
