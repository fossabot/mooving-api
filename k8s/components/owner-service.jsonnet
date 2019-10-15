local env = std.extVar('__ksonnet/environments');
local params = std.extVar('__ksonnet/params').components['owner-service'];
{
  apiVersion: 'v1',
  kind: 'Service',
  metadata: {
    name: 'api-owner',
    namespace: 'mooving',
  },
  spec: {
    ports: [
      {
        protocol: 'TCP',
        port: 80,
        targetPort: 8080,
      },
    ],
    selector: { api: 'api-owner' },
    type: 'NodePort',
    externalTrafficPolicy: 'Local',
  },
}
