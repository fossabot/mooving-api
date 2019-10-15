import Client from './client';

const USER_JOB_TTL = 5 * 60;

export interface IUserJob {
  id?: string;
  state?: string;
  type?: string;
}

export default class UserJobs {
  public static getUserJob(jobId: string): Promise<IUserJob> {
    return Client.execute(`SELECT * from ${Client.keyspace}.user_jobs WHERE id=?`, [jobId], { prepare: true }).then((res): IUserJob => {
      const first = res.first();
      if (!first) {
        return null;
      }
      return {
        id: first.id,
        state: first.state,
        type: first.type,
      };
    });
  }

  public static insert(userJob: IUserJob): Promise<void> {
    return Client.execute(`INSERT INTO ${Client.keyspace}.user_jobs (id, state, type)
    VALUES (?,?,?) USING TTL ${USER_JOB_TTL};`,
      [userJob.id, userJob.state, userJob.type], { prepare: true })
      .then(res => {/**/ });
  }

  public static delete(jobId: string): Promise<void> {
    return Client.execute(`DELETE FROM ${Client.keyspace}.user_jobs WHERE ID=?;`,
      [jobId], { prepare: true })
      .then(res => {/**/ });
  }
}
