local params = std.extVar('__ksonnet/params');
local globals = import 'globals.libsonnet';
local envParams = params {
  components+: {
    // Insert component parameter overrides here. Ex:
    // guestbook +: {
    //   name: "guestbook-dev",
    //   replicas: params.global.replicas,
    // },
    'owner-deployment'+: {
      replicas: 1,
      limits: {
        cpu: '300m',
        memory: '0.7Gi',
      },
      requests: {
        cpu: '100m',
        memory: '0.1Gi',
      },
      nginx: {
        limits: {
          cpu: '200m',
          memory: '0.5Gi',
        },
        requests: {
          cpu: '100m',
          memory: '0.1Gi',
        },
      },
      GCP_PROJECT: '<GCP_PROJECT>',
      MAILGUN_DOMAIN: '<MAILGUN_DOMAIN>',
      CASSANDRA_ENDPOINTS: 'cassandra-0.cassandra.cassandra.svc.cluster.local',
      KAFKA_HOST: 'broker.kafka.svc.cluster.local:9092',
    },
    'rider-deployment'+: {
      replicas: 1,
      limits: {
        cpu: '300m',
        memory: '0.7Gi',
      },
      requests: {
        cpu: '100m',
        memory: '0.1Gi',
      },
      nginx: {
        limits: {
          cpu: '200m',
          memory: '0.5Gi',
        },
        requests: {
          cpu: '100m',
          memory: '0.1Gi',
        },
      },
      GCP_PROJECT: '<GCP_PROJECT>',
      MAILGUN_DOMAIN: '<MAILGUN_DOMAIN>',
      CASSANDRA_ENDPOINTS: 'cassandra-0.cassandra.cassandra.svc.cluster.local',
      KAFKA_HOST: 'broker.kafka.svc.cluster.local:9092',
      BLUE_SNAP_API: 'https://sandbox.bluesnap.com',
      BLUE_SNAP_API_TEST_USER: 'https://sandbox.bluesnap.com',
      BLUE_SNAP_USER_NAME: '<BLUE_SNAP_USER_NAME>',
      BLUE_SNAP_USER_NAME_TEST_USER: '<BLUE_SNAP_USER_NAME_TEST_USER>',
      IOS_APP_ID: '<IOS_APP_ID>',
      RAYVEN_FEEDBACK_TOPIC: 'rayven-feedback',
      GCP_CREDENTIALS_FILE_NAME: 'mooving-development-cassandra-backup-service-account.json',
      INVOICES_BUCKET_NAME: '<INVOICES_BUCKET_NAME>',
    },
    'dav-rate-update-job'+: {
      GCP_PROJECT: 'GCP_PROJECT',
      CASSANDRA_ENDPOINTS: 'cassandra-0.cassandra.cassandra.svc.cluster.local',
    },
    'rider-ingress'+: {
      hostName: 'rider.dev.mooving.io',
    },
    'owner-ingress'+: {
      hostName: 'owner.dev.mooving.io',
    },
    'get-dav-city-ingress'+: {
      hostName: 'get-dev.dav.city',
    },
  },
};

{
  components: {
    [x]: envParams.components[x] + globals
    for x in std.objectFields(envParams.components)
  },
}
