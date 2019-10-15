local env = std.extVar('__ksonnet/environments');
local params = std.extVar('__ksonnet/params').components['rider-service'];
{
  apiVersion: 'v1',
  kind: 'Service',
  metadata: {
    name: 'api-rider',
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
    selector: { api: 'api-rider' },
    type: 'NodePort',
    externalTrafficPolicy: 'Local',
  },
}
