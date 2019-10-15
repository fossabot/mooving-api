import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { IRequestWithAuthentication } from '../lib/Auth';
import { IUser } from '../User';
interface ITokenTransferRequest {
  recipientAddress: string;
  tokenAmount: number;
  password: string;
}

export default class DAVTokenController {

  public static tokenTransfer(getUserById: (id: string) => Promise<IUser>) {
    return async (request: IRequestWithAuthentication, response: Response) => {
      const userId = request.user && request.user.id;
      if (userId) {
        const user = await getUserById(userId);
        const tokenTransferRequest: ITokenTransferRequest = request.body;
        if (!!user) {
          // console.log(tokenTransferRequest);
          // console.log(driver);
          try {
            const passwordCorrect = await bcrypt.compare(tokenTransferRequest.password, user.password);
            if (passwordCorrect) {
              // TODO: transfer token amount
              response.sendStatus(200);
              return;
            } else {
              response.status(401).send('Driver authentication failed');
            }
          } catch (err) {
            // console.log(err);
            response.status(500).send('Action has failed');
          }
        } else {
          response.status(401).send('Driver id not valid');
        }
      } else {
        response.status(401).send('Driver id is not defined');
      }
    };
  }

  // TODO: Fetch balance from token contract
  public static async getAccountBalance(request: Request, response: Response) {
    response.status(200).json({
      accountBalance: {
        dav: 60,
      },
    });
  }
}
