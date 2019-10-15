import Api from './Api';

const api = new Api();
const PORT = process.env.PORT || 3005;
// Create server
api.server.listen(PORT, () => {
  // tslint:disable-next-line:no-console
  console.log(`Web server started. Listening on port ${PORT}`);
});
