local env = std.extVar('__ksonnet/environments');
local params = std.extVar('__ksonnet/params').components['owner-deployment'];
local version = std.extVar('IMAGE_VERSION');
{
  apiVersion: 'apps/v1beta1',
  kind: 'Deployment',
  metadata: {
    name: 'api-owner',
    namespace: 'mooving',
    labels: {
      version: version,
    },
  },
  spec: {
    selector: {
      matchLabels: {
        api: 'api-owner',
      },
    },
    replicas: params.replicas,
    strategy: {
      type: 'RollingUpdate',
      rollingUpdate: {
        maxSurge: 1,
        maxUnavailable: '25%',
      },
    },
    template: {
      metadata: {
        labels: {
          api: 'api-owner',
          version: version,
        },
      },
      spec: {
        securityContext: {
          runAsUser: 1000,
        },
        containers: [
          {
            image: 'gcr.io/' + params.GCP_PROJECT + '/api:' + version,
            name: 'api-owner',
            command: ['bash', '-c', 'cd /app && npx ts-node ./src/owner/index.ts'],
            livenessProbe: {
              httpGet: {
                path: '/health',
                port: 3005,
                scheme: 'HTTP',
              },
              initialDelaySeconds: 60,
              periodSeconds: 30,
              timeoutSeconds: 10,
              successThreshold: 1,
              failureThreshold: 3,
            },
            readinessProbe: {
              httpGet: {
                path: '/health',
                scheme: 'HTTP',
                port: 3005,
              },
              initialDelaySeconds: 30,
              periodSeconds: 30,
              timeoutSeconds: 10,
              successThreshold: 1,
              failureThreshold: 1,
            },
            env: [
              {
                name: 'CASSANDRA_ENDPOINTS',
                value: params.CASSANDRA_ENDPOINTS,
              },
              {
                name: 'CASSANDRA_KEYSPACE',
                value: 'vehicle_rider',
              },
              {
                name: 'TWILIO_API_KEY',
                valueFrom: {
                  secretKeyRef: {
                    name: 'api-owner',
                    key: 'TWILIO_API_KEY',
                  },
                },
              },
              {
                name: 'JWT_SEED',
                valueFrom: {
                  secretKeyRef: {
                    name: 'api-owner',
                    key: 'JWT_SEED',
                  },
                },
              },
              {
                name: 'MAILGUN_API_KEY',
                valueFrom: {
                  secretKeyRef: {
                    name: 'api-owner',
                    key: 'MAILGUN_API_KEY',
                  },
                },
              },
              {
                name: 'KAFKA_HOST',
                value: params.KAFKA_HOST,
              },
              {
                name: 'MAILGUN_DOMAIN',
                value: params.MAILGUN_DOMAIN,
              },
            ],
            ports: [
              {
                containerPort: 3005,
              },
            ],
            resources: {
              limits: {
                cpu: params.limits.cpu,
                memory: params.limits.memory,
              },
              requests: {
                cpu: params.requests.cpu,
                memory: params.requests.memory,
              },
            },
          },
          {
            name: 'nginx',
            image: 'gcr.io/' + params.GCP_PROJECT + '/nginx:' + version,
            resources: {
              limits: {
                cpu: params.nginx.limits.cpu,
                memory: params.nginx.limits.memory,
              },
              requests: {
                cpu: params.nginx.requests.cpu,
                memory: params.nginx.requests.memory,
              },
            },
            ports: [
              {
                containerPort: 8080,
              },
            ],
          },
        ],
      },
    },
  },
}
