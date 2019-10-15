local env = std.extVar('__ksonnet/environments');
local params = std.extVar('__ksonnet/params').components['get-dav-city-ingress'];
{
  apiVersion: 'extensions/v1beta1',
  kind: 'Ingress',
  metadata: {
    annotations: {
      'certmanager.k8s.io/acme-challenge-type': 'http01',
      'certmanager.k8s.io/cluster-issuer': 'letsencrypt-prod',
      'certmanager.k8s.io/acme-http01-edit-in-place': 'true',
      'kubernetes.io/ingress.class': 'gce',
      'kubernetes.io/ingress.global-static-ip-name': 'get-dav-city',
      // 'kubernetes.io/ingress.allow-http': 'true',
      // 'ingress.kubernetes.io/ssl-redirect': 'false',
      // 'ingress.kubernetes.io/enable-cors': 'true',
      // 'ingress.kubernetes.io/cors-allow-methods': 'PUT, GET, POST, OPTIONS',
    },
    name: 'get-dav-city-ingress',
    namespace: 'mooving',
  },
  spec: {
    rules: [
      {
        host: params.hostName,
        http: {
          paths: [
            {
              backend: {
                serviceName: 'api-rider',
                servicePort: 80,
              },
            },
          ],
        },
      },
    ],
    tls: [
      {
        hosts: [
          params.hostName,
        ],
        secretName: 'get-dav-city-tls',
      },
    ],
  },
}
