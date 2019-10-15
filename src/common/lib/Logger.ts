export default class Logger {
  public static log(message?: any, ...optionalParams: any[]) {
    const sdkDebugLog = process.env.SDK_DEBUG_LOG === 'true' || true;
    if (sdkDebugLog) {
      // tslint:disable-next-line:no-console
      console.log(message, ...optionalParams);
    }
  }
}
