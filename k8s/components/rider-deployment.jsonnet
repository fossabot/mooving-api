local env = std.extVar('__ksonnet/environments');
local params = std.extVar('__ksonnet/params').components['rider-deployment'];
local version = std.extVar('IMAGE_VERSION');
{
  apiVersion: 'apps/v1beta1',
  kind: 'Deployment',
  metadata: {
    name: 'api-rider',
    namespace: 'mooving',
    labels: {
      version: version,
    },
  },
  spec: {
    selector: {
      matchLabels: {
        api: 'api-rider',
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
          api: 'api-rider',
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
            name: 'api-rider',
            command: ['bash', '-c', 'cd /app && npx ts-node ./src/rider/index.ts'],
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
            volumeMounts: [
              {
                name: 'gcp-credentials-volume',
                mountPath: '/gcp-credentials',
                readOnly: true,
              },
            ],
            env: [
              {
                name: 'CASSANDRA_ENDPOINTS',
                value: params.CASSANDRA_ENDPOINTS,
              },
              {
                name: 'INVOICES_BUCKET_NAME',
                value: params.INVOICES_BUCKET_NAME,
              },
              {
                name: 'CASSANDRA_KEYSPACE',
                value: 'vehicle_rider',
              },
              {
                name: 'BLUE_SNAP_API',
                value: params.BLUE_SNAP_API,
              },
              {
                name: 'BLUE_SNAP_USER_NAME',
                value: params.BLUE_SNAP_USER_NAME,
              },
              {
                name: 'BLUE_SNAP_API_TEST_USER',
                value: params.BLUE_SNAP_API_TEST_USER,
              },
              {
                name: 'BLUE_SNAP_USER_NAME_TEST_USER',
                value: params.BLUE_SNAP_USER_NAME_TEST_USER,
              },
              {
                name: 'IOS_APP_ID',
                value: params.IOS_APP_ID,
              },
              {
                name: 'BLUE_SNAP_PASSWORD',
                valueFrom: {
                  secretKeyRef: {
                    name: 'api-rider',
                    key: 'BLUE_SNAP_PASSWORD',
                  },
                },
              },
              {
                name: 'BLUE_SNAP_PASSWORD_TEST_USER',
                valueFrom: {
                  secretKeyRef: {
                    name: 'api-rider',
                    key: 'BLUE_SNAP_PASSWORD_TEST_USER',
                  },
                },
              },
              {
                name: 'TWILIO_API_KEY',
                valueFrom: {
                  secretKeyRef: {
                    name: 'api-rider',
                    key: 'TWILIO_API_KEY',
                  },
                },
              },
              {
                name: 'MAILGUN_API_KEY',
                valueFrom: {
                  secretKeyRef: {
                    name: 'api-rider',
                    key: 'MAILGUN_API_KEY',
                  },
                },
              },
              {
                name: 'JWT_SEED',
                valueFrom: {
                  secretKeyRef: {
                    name: 'api-rider',
                    key: 'JWT_SEED',
                  },
                },
              },
              {
                name: 'MAILGUN_DOMAIN',
                value: params.MAILGUN_DOMAIN,
              },
              {
                name: 'KAFKA_HOST',
                value: params.KAFKA_HOST,
              },
              {
                name: 'RAYVEN_FEEDBACK_TOPIC',
                value: params.RAYVEN_FEEDBACK_TOPIC,
              },
              {
                name: 'GOOGLE_APPLICATION_CREDENTIALS',
                value: '/gcp-credentials/' + params.GCP_CREDENTIALS_FILE_NAME,
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
        volumes: [
          {
            name: 'gcp-credentials-volume',
            secret: {
              secretName: 'gcp-credentials',
            },
          },
        ],
      },
    },
  },
}
