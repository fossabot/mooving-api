import { Application } from 'express';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as passport from 'passport';
import Client from '../common/cassandra/client';

export default class Api {

  public server: Application;

  constructor() {
    this.server = express();
    this.config();
    Client.init();
  }

  protected config(): void {
    const corsOptions: cors.CorsOptions = {
      origin: '*',
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Type'],
    };

    this.server.use(cors(corsOptions));
    this.server.use(bodyParser.json());
    this.server.use(passport.initialize() as any);
  }
}
