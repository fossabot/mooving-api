import { KafkaClient, Producer, Consumer, Message } from 'kafka-node';
import { Subject, Observable as RxObservable } from 'rxjs';
import { ProduceRequest } from 'kafka-node';
import RetryPromise from './RetryPromise';
import Logger from './Logger';

export const KAFKA_HOST = process.env.KAFKA_HOST || 'localhost:9092';

export default class Kafka {
  private static kafkaClient: KafkaClient = null;

  private static async getKafkaClient(kafkaHost: string): Promise<KafkaClient> {
    if (!Kafka.kafkaClient) {
      Kafka.kafkaClient = await RetryPromise.createRetryPromise(
        currentAttempt =>
          new Promise<KafkaClient>((resolve, reject) => {
            const client = new KafkaClient({
              kafkaHost,
            });
            Logger.log(
              `Kafka connecting... ${
              currentAttempt > 1 ? `${currentAttempt} try` : ''
              }`,
            );
            client.connect();
            client.on('ready', () => {
              Logger.log(`Kafka connected`);
              resolve(client);
            });
            client.on('error', err => {
              Logger.log(`Kafka connection error ${err}`);
              reject(err);
            });
          }),
      );
    }
    return Kafka.kafkaClient;
  }

  private static async getProducer(kafkaHost: string): Promise<Producer> {
    const client = await this.getKafkaClient(kafkaHost);
    const producer = new Producer(client);
    return producer;
  }

  private static async getConsumer(
    topicId: string,
    kafkaHost: string,
  ): Promise<Consumer> {
    const client = await this.getKafkaClient(kafkaHost);
    const consumer = new Consumer(client, [{ topic: topicId }], {
      groupId: topicId,
      autoCommit: true,
    });
    return consumer;
  }

  public static async createTopic(topicId: string, kafkaHost: string): Promise<void> {
    return RetryPromise.createRetryPromise(
      currentAttempt =>
        new Promise<void>(async (resolve, reject) => {
          const client = await this.getKafkaClient(kafkaHost);
          Logger.log(
            `Kafka creating topic ${topicId}... ${
            currentAttempt > 1 ? `${currentAttempt} try` : ''
            }`,
          );
          try {
            (client as any).createTopics(
              [{ topic: topicId, partitions: 1, replicationFactor: 1 }],
              (err: any, data: any) => {
                if (err) {
                  Logger.log(`Kafka error creating topic ${topicId}`);
                  reject(err);
                } else {
                  Logger.log(`Kafka topic created ${topicId}`);
                  resolve();
                }
              },
            );
          } catch (error) {
            Logger.log('error in create topic: ', error);
          }
        }),
    );
  }

  public static sendMessage(
    topicId: string,
    message: string,
    kafkaHost: string,
  ): Promise<void> {
    return this.sendPayloads([{ topic: topicId, messages: message }], kafkaHost);
  }

  public static async sendPayloads(
    payloads: ProduceRequest[],
    kafkaHost: string,
  ): Promise<void> {
    return RetryPromise.createRetryPromise(
      currentAttempt =>
        new Promise<void>(async (resolve, reject) => {
          const producer = await this.getProducer(kafkaHost);
          Logger.log(
            `Kafka sending ${JSON.stringify(payloads)}... ${
            currentAttempt > 1 ? `${currentAttempt} try` : ''
            }`,
          );
          producer.send(payloads, (err: any, data: any) => {
            if (err) {
              Logger.log(`Kafka error sending ${JSON.stringify(payloads)}`);
              reject(err);
            } else {
              Logger.log(`Kafka sent ${JSON.stringify(payloads)}`);
              resolve();
            }
          });
        }),
    );
  }

  public static async rawMessages(
    topicId: string,
    kafkaHost: string,
  ): Promise<RxObservable<Message>> {
    const consumer = await this.getConsumer(topicId, kafkaHost);
    const kafkaStream: Subject<Message> = new Subject<Message>();
    Logger.log(`Kafka listening on ${topicId}`);
    consumer.on('message', message => {
      try {
        Logger.log(`Kafka message on ${topicId}: ${JSON.stringify(message)}`);
        const messageString = message.value.toString();
        kafkaStream.next(message);
      } catch (error) {
        kafkaStream.error(
          `error while trying to parse message. topic: ${topicId} error: ${JSON.stringify(
            error,
          )}, message: ${JSON.stringify(message)}`,
        );
      }
    });
    consumer.on('error', err => {
      Logger.log(`Kafka consumer error on ${topicId}: ${JSON.stringify(err)}`);
      kafkaStream.error(
        `Consumer error. topic: ${topicId} error: ${JSON.stringify(err)}`,
      );
    });
    return kafkaStream;
  }

  public static async isConnected(kafkaHost: string) {
    await this.getKafkaClient(kafkaHost);
    return true;
  }
}
